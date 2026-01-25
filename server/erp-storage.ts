/**
 * ERP Storage Module
 * Handles database operations for suppliers, customers, purchase orders, and serial numbers
 */

import {
    suppliers,
    productSuppliers,
    customers,
    purchaseOrders,
    purchaseOrderItems,
    serialNumbers,
    products,
    users,
    type Supplier,
    type InsertSupplier,
    type ProductSupplier,
    type InsertProductSupplier,
    type Customer,
    type InsertCustomer,
    type PurchaseOrder,
    type InsertPurchaseOrder,
    type PurchaseOrderItem,
    type InsertPurchaseOrderItem,
    type SerialNumber,
    type InsertSerialNumber,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql, inArray } from "drizzle-orm";

// ============================================
// Supplier Operations
// ============================================

export async function getSuppliers(includeInactive = false): Promise<Supplier[]> {
    if (includeInactive) {
        return db.select().from(suppliers).orderBy(asc(suppliers.name));
    }
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
}

export async function createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
}

export async function updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier> {
    const [supplier] = await db
        .update(suppliers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(suppliers.id, id))
        .returning();
    return supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
    // Soft delete
    await db.update(suppliers).set({ isActive: false, updatedAt: new Date() }).where(eq(suppliers.id, id));
}

// ============================================
// Product-Supplier Operations
// ============================================

export async function getProductSuppliers(productId: string): Promise<(ProductSupplier & { supplier: Supplier })[]> {
    const results = await db
        .select({
            productSupplier: productSuppliers,
            supplier: suppliers,
        })
        .from(productSuppliers)
        .innerJoin(suppliers, eq(productSuppliers.supplierId, suppliers.id))
        .where(eq(productSuppliers.productId, productId));

    return results.map((r: any) => ({
        ...r.productSupplier,
        supplier: r.supplier,
    }));
}

export async function linkProductSupplier(data: InsertProductSupplier): Promise<ProductSupplier> {
    const [link] = await db.insert(productSuppliers).values(data).returning();
    return link;
}

export async function unlinkProductSupplier(id: string): Promise<void> {
    await db.delete(productSuppliers).where(eq(productSuppliers.id, id));
}

// ============================================
// Customer Operations
// ============================================

export async function getCustomers(includeInactive = false): Promise<Customer[]> {
    if (includeInactive) {
        return db.select().from(customers).orderBy(asc(customers.name));
    }
    return db.select().from(customers).where(eq(customers.isActive, true)).orderBy(asc(customers.name));
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
}

export async function createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
}

export async function updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer> {
    const [customer] = await db
        .update(customers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning();
    return customer;
}

export async function deleteCustomer(id: string): Promise<void> {
    await db.update(customers).set({ isActive: false, updatedAt: new Date() }).where(eq(customers.id, id));
}

// ============================================
// Purchase Order Operations
// ============================================

export async function getPurchaseOrders(status?: string): Promise<(PurchaseOrder & { supplier: Supplier })[]> {
    const baseQuery = db
        .select({
            purchaseOrder: purchaseOrders,
            supplier: suppliers,
        })
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id));

    let results;
    if (status) {
        results = await baseQuery.where(eq(purchaseOrders.status, status as any)).orderBy(desc(purchaseOrders.createdAt));
    } else {
        results = await baseQuery.orderBy(desc(purchaseOrders.createdAt));
    }

    return results.map((r: any) => ({
        ...r.purchaseOrder,
        supplier: r.supplier,
    }));
}

export async function getPurchaseOrder(id: string): Promise<(PurchaseOrder & { supplier: Supplier; items: (PurchaseOrderItem & { product: any })[] }) | undefined> {
    const [result] = await db
        .select({
            purchaseOrder: purchaseOrders,
            supplier: suppliers,
        })
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(eq(purchaseOrders.id, id));

    if (!result) return undefined;

    const items = await db
        .select({
            item: purchaseOrderItems,
            product: products,
        })
        .from(purchaseOrderItems)
        .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
        .where(eq(purchaseOrderItems.purchaseOrderId, id));

    return {
        ...result.purchaseOrder,
        supplier: result.supplier,
        items: items.map((i: any) => ({
            ...i.item,
            product: i.product,
        })),
    };
}

export async function getNextPurchaseOrderNumber(): Promise<string> {
    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(purchaseOrders);
    const num = (result?.count || 0) + 1;
    return `PO-${String(num).padStart(6, '0')}`;
}

export async function createPurchaseOrder(
    data: InsertPurchaseOrder,
    items: { productId: string; quantity: number; unitCost: string }[]
): Promise<PurchaseOrder> {
    return await db.transaction(async (tx: any) => {
        // Calculate totals
        let subtotal = 0;
        for (const item of items) {
            subtotal += Number(item.unitCost) * item.quantity;
        }
        const tax = 0; // Can be calculated based on business rules
        const total = subtotal + tax;

        const [order] = await tx.insert(purchaseOrders).values({
            ...data,
            subtotal: String(subtotal),
            tax: String(tax),
            total: String(total),
        }).returning();

        // Insert items
        for (const item of items) {
            await tx.insert(purchaseOrderItems).values({
                purchaseOrderId: order.id,
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost,
                total: String(Number(item.unitCost) * item.quantity),
            });
        }

        return order;
    });
}

export async function updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const [order] = await db
        .update(purchaseOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id))
        .returning();
    return order;
}

export async function receivePurchaseOrderItems(
    purchaseOrderId: string,
    receiveItems: { itemId: string; receivedQuantity: number; serialNumbers?: string[] }[],
    userId: string
): Promise<void> {
    await db.transaction(async (tx: any) => {
        for (const item of receiveItems) {
            const [poItem] = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, item.itemId));
            if (!poItem) continue;

            const newReceivedQty = (poItem.receivedQuantity || 0) + item.receivedQuantity;

            // Update PO item received quantity
            await tx.update(purchaseOrderItems).set({
                receivedQuantity: newReceivedQty,
            }).where(eq(purchaseOrderItems.id, item.itemId));

            // Update product stock
            await tx.execute(sql`
        UPDATE products 
        SET stock_quantity = stock_quantity + ${item.receivedQuantity}, updated_at = now() 
        WHERE id = ${poItem.productId}
      `);

            // Create serial numbers if provided
            if (item.serialNumbers && item.serialNumbers.length > 0) {
                const [product] = await tx.select().from(products).where(eq(products.id, poItem.productId));
                const warrantyExpiry = product?.warrantyMonths
                    ? new Date(Date.now() + product.warrantyMonths * 30 * 24 * 60 * 60 * 1000)
                    : null;

                for (const sn of item.serialNumbers) {
                    await tx.insert(serialNumbers).values({
                        productId: poItem.productId,
                        serialNumber: sn,
                        status: 'in_stock',
                        purchaseOrderId,
                        warrantyExpiry,
                    });
                }
            }
        }

        // Check if all items are fully received
        const allItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
        const allReceived = allItems.every((item: any) => (item.receivedQuantity || 0) >= item.quantity);
        const someReceived = allItems.some((item: any) => (item.receivedQuantity || 0) > 0);

        // Update PO status
        const newStatus = allReceived ? 'received' : (someReceived ? 'partial' : undefined);
        if (newStatus) {
            await tx.update(purchaseOrders).set({
                status: newStatus,
                receivedDate: allReceived ? new Date() : undefined,
                updatedAt: new Date(),
            }).where(eq(purchaseOrders.id, purchaseOrderId));
        }
    });
}

export async function deletePurchaseOrder(id: string): Promise<void> {
    // Only allow deletion of draft orders
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (order && order.status !== 'draft') {
        throw new Error('Can only delete draft purchase orders');
    }
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
}

// ============================================
// Serial Number Operations
// ============================================

export async function getSerialNumbers(productId?: string, status?: string): Promise<(SerialNumber & { product: any })[]> {
    const conditions: any[] = [];
    if (productId) conditions.push(eq(serialNumbers.productId, productId));
    if (status) conditions.push(eq(serialNumbers.status, status as any));

    const results = await db
        .select({
            serialNumber: serialNumbers,
            product: products,
        })
        .from(serialNumbers)
        .innerJoin(products, eq(serialNumbers.productId, products.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(serialNumbers.createdAt));

    return results.map((r: any) => ({
        ...r.serialNumber,
        product: r.product,
    }));
}

export async function getSerialNumber(id: string): Promise<SerialNumber | undefined> {
    const [sn] = await db.select().from(serialNumbers).where(eq(serialNumbers.id, id));
    return sn;
}

export async function getSerialNumberByCode(code: string): Promise<SerialNumber | undefined> {
    const [sn] = await db.select().from(serialNumbers).where(eq(serialNumbers.serialNumber, code));
    return sn;
}

export async function createSerialNumber(data: InsertSerialNumber): Promise<SerialNumber> {
    const [sn] = await db.insert(serialNumbers).values(data).returning();
    return sn;
}

export async function updateSerialNumber(id: string, data: Partial<InsertSerialNumber>): Promise<SerialNumber> {
    const [sn] = await db
        .update(serialNumbers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(serialNumbers.id, id))
        .returning();
    return sn;
}

export async function assignSerialNumberToOrder(
    serialNumberId: string,
    orderId: string,
    customerId?: string
): Promise<SerialNumber> {
    const [sn] = await db
        .update(serialNumbers)
        .set({
            orderId,
            customerId,
            status: 'sold',
            updatedAt: new Date(),
        })
        .where(eq(serialNumbers.id, serialNumberId))
        .returning();
    return sn;
}

export async function getAvailableSerialNumbers(productId: string): Promise<SerialNumber[]> {
    return db
        .select()
        .from(serialNumbers)
        .where(and(
            eq(serialNumbers.productId, productId),
            eq(serialNumbers.status, 'in_stock')
        ))
        .orderBy(asc(serialNumbers.createdAt));
}
