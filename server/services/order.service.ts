
import { db } from "../db";
import {
    orders, orderItems, products, components, productComponents, inventoryLog, activityLog, orderItemOptions,
    type Order, type InsertOrder, type OrderItem, type InsertOrderItem
} from "@shared/schema";
import { eq, asc, desc, and, or, sql, inArray } from "drizzle-orm";

export class OrderService {
    async getOrders(organizationId: string, limit = 100): Promise<Order[]> {
        return db.select().from(orders).where(eq(orders.organizationId, organizationId)).orderBy(desc(orders.createdAt)).limit(limit);
    }

    async getOrdersByStatus(organizationId: string, status: string): Promise<Order[]> {
        return db
            .select()
            .from(orders)
            .where(and(eq(orders.status, status as any), eq(orders.organizationId, organizationId)))
            .orderBy(asc(orders.createdAt));
    }

    async getOrdersByStatusWithItems(organizationId: string, status: string): Promise<any[]> {
        // Fetch orders
        const orderList = await db
            .select()
            .from(orders)
            .where(and(eq(orders.status, status as any), eq(orders.organizationId, organizationId)))
            .orderBy(asc(orders.createdAt));

        if (orderList.length === 0) return [];

        // Fetch all items for these orders in one query
        const orderIds = orderList.map((o: any) => o.id);
        const allItems = await db
            .select({
                id: orderItems.id,
                orderId: orderItems.orderId,
                productId: orderItems.productId,
                quantity: orderItems.quantity,
                unitPrice: orderItems.unitPrice,
                total: orderItems.total,
                modifications: orderItems.modifications,
                product: products,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(inArray(orderItems.orderId, orderIds));

        // Group items by orderId
        const itemsByOrderId = new Map<string, any[]>();
        for (const item of allItems) {
            const list = itemsByOrderId.get(item.orderId) || [];
            list.push(item);
            itemsByOrderId.set(item.orderId, list);
        }

        // Merge items into orders
        return orderList.map((order: any) => ({
            ...order,
            items: itemsByOrderId.get(order.id) || []
        }));
    }

    async getOrder(organizationId: string, id: string): Promise<Order | undefined> {
        const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)));
        return order;
    }

    async getOrderWithDetails(organizationId: string, id: string): Promise<any> {
        const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)));
        if (!order) return undefined;

        const items = await db
            .select({
                ...orderItems,
                product: products,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, id));

        return {
            ...order,
            items
        };
    }

    async createOrder(organizationId: string, order: InsertOrder): Promise<Order> {
        const [newOrder] = await db.insert(orders).values({ ...order, organizationId }).returning();
        return newOrder;
    }

    async createOrderTransaction(organizationId: string, order: InsertOrder, items: InsertOrderItem[], userId: string): Promise<Order> {
        const createdOrder = await db.transaction(async (tx: any) => {
            const [newOrder] = await tx.insert(orders).values({ ...order, organizationId }).returning();

            const productComponentCache: Record<string, any[]> = {};

            for (const item of items) {
                // Robust price handling: handle string/number inputs and varied field names
                const priceValue = (item as any).price || item.unitPrice || (item as any).__effectiveUnitPrice || '0';
                const validPrice = typeof priceValue === 'string' ? priceValue : String(priceValue);

                const [orderItem] = await tx.insert(orderItems).values({
                    orderId: newOrder.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: validPrice,
                    total: (Number(validPrice) * item.quantity).toFixed(2),
                    modifications: item.modifications,
                }).returning();

                // Load product to determine type
                const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
                if (!product) throw new Error(`Product ${item.productId} not found`);

                if (product.type === 'finished_good') {
                    // Atomic update: decrement stock only if enough
                    const needed = item.quantity;
                    const updateSql = sql`UPDATE ${products} SET stock_quantity = stock_quantity - ${needed}::int, updated_at = now() WHERE id = ${item.productId} AND stock_quantity >= ${needed} RETURNING stock_quantity`;
                    // @ts-ignore
                    const result: any = await tx.execute(updateSql);
                    if (!Array.isArray(result) || (result.length === 0)) {
                        throw new Error(`Insufficient stock for product ${product.name}`);
                    }
                    const newQty = result[0].stock_quantity;
                    await tx.insert(inventoryLog).values({
                        organizationId,
                        type: 'product',
                        itemId: product.id,
                        action: 'sale',
                        quantityChange: String(-needed),
                        previousQuantity: String((product.stockQuantity ?? 0)),
                        newQuantity: String(newQty),
                        userId,
                        reason: `Sale - Order #${newOrder.orderNumber}`,
                    });
                } else {
                    // Component-based product - deduct bundle components
                    if (!productComponentCache[item.productId]) {
                        productComponentCache[item.productId] = await tx.select().from(productComponents).where(eq(productComponents.productId, item.productId));
                    }
                    const pcList = productComponentCache[item.productId] || [];
                    for (const pc of pcList) {
                        // Logic for optional components if implemented in frontend - usually filtered before this or handled similarly
                        // Assuming basic logic first. If optional components field exists on item, filter.
                        // For now we assume all components in bundle are deducted unless marked options (logic complexity omitted for brevity as per previous implementation)

                        // Compatibility note: Check logic for optional components if applicable
                        // if (pc.isOptional && !((item as any).__selectedOptionalComponentIds || []).includes(pc.id)) continue;

                        const perUnitQty = parseFloat(String(pc.quantity || '0'));
                        if (isNaN(perUnitQty) || perUnitQty <= 0) continue;
                        const totalQty = perUnitQty * item.quantity;

                        // Atomic component decrement
                        const [componentRow] = await tx.select().from(components).where(eq(components.id, pc.componentId));
                        if (!componentRow) {
                            throw new Error(`Component ${pc.componentId} not found`);
                        }
                        const prevStock = Number(componentRow.stockQuantity);
                        const updateSql = sql`UPDATE ${components} SET stock_quantity = (stock_quantity::numeric - ${String(totalQty)})::numeric, updated_at = now() WHERE id = ${pc.componentId} AND stock_quantity >= ${String(totalQty)}::numeric RETURNING stock_quantity`;
                        const result: any = await tx.execute(updateSql);
                        if (!Array.isArray(result) || result.length === 0) {
                            throw new Error(`Insufficient component stock for ${pc.componentId} used by product ${product.name}`);
                        }
                        const newQty = result[0].stock_quantity;
                        await tx.insert(inventoryLog).values({
                            organizationId,
                            type: 'component',
                            itemId: pc.componentId,
                            action: 'sale',
                            quantityChange: String(-totalQty),
                            previousQuantity: String(prevStock),
                            newQuantity: String(newQty),
                            userId,
                            reason: `Sale - Order #${newOrder.orderNumber} - ${product.name}`,
                        });
                    }
                }

                // Attach any selected option IDs to order item (if options are present)
                // Note: checking if ENABLE_OPTIONS_SYSTEM is needed here, or just check logic presence
                // Assuming options logic should be preserved
                if ((item as any).__resolvedOptionIds && (item as any).__resolvedOptionIds.length) {
                    for (const optId of (item as any).__resolvedOptionIds) {
                        await tx.insert(orderItemOptions).values({
                            orderItemId: orderItem.id,
                            optionId: String(optId),
                            priceAdjust: String('0')
                        });
                    }
                }
            }

            // If sentToFulfillment is true, create an activity log entry (audit)
            if ((order as any).sentToFulfillment) {
                await tx.insert(activityLog).values({
                    organizationId,
                    userId,
                    action: 'send_to_fulfillment',
                    success: true,
                    details: { orderId: newOrder.id, orderNumber: newOrder.orderNumber },
                });
            }

            return newOrder;
        });

        return createdOrder;
    }

    async updateOrder(organizationId: string, id: string, order: Partial<InsertOrder>): Promise<Order> {
        const [updatedOrder] = await db
            .update(orders)
            .set({ ...order, updatedAt: new Date() })
            .where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)))
            .returning();
        return updatedOrder;
    }

    async deleteOrder(organizationId: string, id: string): Promise<void> {
        await db.transaction(async (tx: any) => {
            // Delete order items first
            await tx.delete(orderItems).where(eq(orderItems.orderId, id));
            // Then delete the order
            await tx.delete(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)));
        });
    }

    async getOrdersByUserId(organizationId: string, userId: string): Promise<Order[]> {
        return db.select().from(orders)
            .where(and(
                eq(orders.organizationId, organizationId),
                or(eq(orders.cashierId, userId), eq(orders.technicianId, userId), eq(orders.courierId, userId))
            ))
            .orderBy(desc(orders.createdAt));
    }

    async getAllOrders(organizationId: string): Promise<Order[]> {
        return db.select().from(orders).where(eq(orders.organizationId, organizationId)).orderBy(desc(orders.createdAt));
    }

    async getOrderItems(orderId: string): Promise<OrderItem[]> {
        const items = await db
            .select({
                id: orderItems.id,
                orderId: orderItems.orderId,
                productId: orderItems.productId,
                quantity: orderItems.quantity,
                unitPrice: orderItems.unitPrice,
                total: orderItems.total,
                modifications: orderItems.modifications,
                product: {
                    id: products.id,
                    name: products.name,
                    description: products.description,
                    price: products.price,
                    type: products.type
                }
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, orderId));

        return items as any;
    }

    async archiveReadyOrdersOlderThan(organizationId: string, minutes: number): Promise<string[]> {
        const result = await db.execute(sql`
      UPDATE ${orders}
      SET archived = TRUE
      WHERE organizationId = ${organizationId}
      AND archived = FALSE
      AND status = 'ready'
      AND (
        (called_at IS NOT NULL AND called_at <= now() - (${minutes} * INTERVAL '1 minute'))
        OR (ready_at IS NOT NULL AND ready_at <= now() - (${minutes} * INTERVAL '1 minute'))
      )
      RETURNING id;
    `);
        if (!Array.isArray(result)) return [];
        return result.map((r: any) => r.id as string);
    }

    async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
        const [newOrderItem] = await db.insert(orderItems).values(orderItem).returning();
        return newOrderItem;
    }

    async deleteOrderItems(orderId: string): Promise<void> {
        await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    }

    async getNextOrderNumber(organizationId: string): Promise<number> {
        const [result] = await db
            .select({ maxNumber: sql<number>`COALESCE(MAX(${orders.orderNumber}), 0)` })
            .from(orders)
            .where(eq(orders.organizationId, organizationId));
        return (result?.maxNumber || 0) + 1;
    }
}

export const orderService = new OrderService();
