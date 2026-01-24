
import { db } from "../db";
import {
    orders, orderItems, products, ingredients, recipeIngredients, inventoryLog, activityLog, orderItemOptions,
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

            const recipeIngredientCache: Record<string, any[]> = {};

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
                    // Ingredient-based product - deduct recipe ingredients
                    if (!recipeIngredientCache[item.productId]) {
                        recipeIngredientCache[item.productId] = await tx.select().from(recipeIngredients).where(eq(recipeIngredients.productId, item.productId));
                    }
                    const riList = recipeIngredientCache[item.productId] || [];
                    for (const ri of riList) {
                        if (ri.isOptional && !((item as any).__selectedOptionalIngredientIds || []).includes(ri.id)) continue;
                        const perUnitQty = parseFloat(String(ri.quantity || '0'));
                        if (isNaN(perUnitQty) || perUnitQty <= 0) continue;
                        const totalQty = perUnitQty * item.quantity;

                        // Atomic ingredient decrement
                        const [ingredientRow] = await tx.select().from(ingredients).where(eq(ingredients.id, ri.ingredientId));
                        if (!ingredientRow) {
                            throw new Error(`Ingredient ${ri.ingredientId} not found`);
                        }
                        const prevStock = Number(ingredientRow.stockQuantity);
                        const updateSql = sql`UPDATE ${ingredients} SET stock_quantity = (stock_quantity::numeric - ${String(totalQty)})::numeric, updated_at = now() WHERE id = ${ri.ingredientId} AND stock_quantity >= ${String(totalQty)}::numeric RETURNING stock_quantity`;
                        const result: any = await tx.execute(updateSql);
                        if (!Array.isArray(result) || result.length === 0) {
                            throw new Error(`Insufficient ingredient stock for ${ri.ingredientId} used by product ${product.name}`);
                        }
                        const newQty = result[0].stock_quantity;
                        await tx.insert(inventoryLog).values({
                            organizationId,
                            type: 'ingredient',
                            itemId: ri.ingredientId,
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

            // If sentToBarista is true, create an activity log entry (audit)
            if ((order as any).sentToBarista) {
                await tx.insert(activityLog).values({
                    organizationId,
                    userId,
                    action: 'send_to_barista',
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
                or(eq(orders.cashierId, userId), eq(orders.baristaId, userId), eq(orders.courierId, userId))
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
