
import { db } from "../db";
import {
    products, productBarcodes, productComponents, components, inventoryLog,
    type Product, type InsertProduct, type ProductComponent, type InsertProductComponent
} from "@shared/schema";
import { eq, asc, desc, and, sql } from "drizzle-orm";

export class ProductService {
    // Product Operations
    async getProducts(organizationId: string): Promise<Product[]> {
        const results = await db.query.products.findMany({
            where: and(eq(products.isActive, true), eq(products.organizationId, organizationId)),
            orderBy: asc(products.name),
            with: {
                barcodes: true
            }
        });

        return results.map((p: any) => ({
            ...p,
            barcodes: p.barcodes.map((b: { barcode: string }) => b.barcode)
        }));
    }

    async getProductsByCategory(organizationId: string, categoryId: string): Promise<Product[]> {
        const results = await db.query.products.findMany({
            where: and(eq(products.categoryId, categoryId), eq(products.isActive, true), eq(products.organizationId, organizationId)),
            orderBy: asc(products.name),
            with: {
                barcodes: true
            }
        });

        return results.map((p: any) => ({
            ...p,
            barcodes: p.barcodes.map((b: { barcode: string }) => b.barcode)
        }));
    }

    async getProduct(organizationId: string, id: string): Promise<Product | undefined> {
        const product = await db.query.products.findFirst({
            where: and(eq(products.id, id), eq(products.organizationId, organizationId)),
            with: {
                barcodes: true
            }
        });

        if (!product) return undefined;

        return {
            ...product,
            barcodes: product.barcodes.map((b: { barcode: string }) => b.barcode)
        };
    }

    async createProduct(organizationId: string, product: InsertProduct & { barcodes?: string[] }): Promise<Product> {
        return await db.transaction(async (tx: any) => {
            // 1. Create product
            const { barcodes: barcodesList, ...productData } = product as any;
            const [newProduct] = await tx.insert(products).values({ ...productData, organizationId }).returning();

            // 2. Insert extra barcodes if any
            const codesToInsert = new Set<string>();

            // Always include primary barcode
            if (newProduct.barcode) codesToInsert.add(newProduct.barcode);
            // Include additional
            if (barcodesList && Array.isArray(barcodesList)) {
                barcodesList.forEach((b: string) => codesToInsert.add(b));
            }

            if (codesToInsert.size > 0) {
                await tx.insert(productBarcodes).values(
                    Array.from(codesToInsert).map(b => ({
                        productId: newProduct.id,
                        barcode: b
                    }))
                ).onConflictDoNothing();
            }

            return {
                ...newProduct,
                barcodes: Array.from(codesToInsert)
            };
        });
    }

    async updateProduct(organizationId: string, id: string, product: Partial<InsertProduct> & { barcodes?: string[] }): Promise<Product> {
        return await db.transaction(async (tx: any) => {
            const { barcodes: barcodesList, ...productData } = product as any;

            let updatedProduct: any;

            // Update fields if provided
            if (Object.keys(productData).length > 0) {
                [updatedProduct] = await tx
                    .update(products)
                    .set({ ...productData, updatedAt: new Date() })
                    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
                    .returning();
            } else {
                // Fetch current if no fields update
                updatedProduct = await tx.query.products.findFirst({
                    where: and(eq(products.id, id), eq(products.organizationId, organizationId))
                });
            }

            if (!updatedProduct) throw new Error("Product not found");

            // Handle barcode updates if provided
            if (barcodesList && Array.isArray(barcodesList)) {
                // 1. Delete existing for this product
                await tx.delete(productBarcodes).where(eq(productBarcodes.productId, id));

                const codesToInsert = new Set<string>();

                const primaryB = productData.barcode !== undefined ? productData.barcode : updatedProduct.barcode;
                if (primaryB) codesToInsert.add(primaryB);

                barcodesList.forEach((b: string) => codesToInsert.add(b));

                if (codesToInsert.size > 0) {
                    await tx.insert(productBarcodes).values(
                        Array.from(codesToInsert).map(b => ({
                            productId: id,
                            barcode: b
                        }))
                    ).onConflictDoNothing();
                }

                updatedProduct.barcodes = Array.from(codesToInsert);
            } else {
                // Re-fetch barcodes to return complete object
                const currentBarcodes = await tx.select().from(productBarcodes).where(eq(productBarcodes.productId, id));
                updatedProduct.barcodes = currentBarcodes.map((b: { barcode: string }) => b.barcode);
            }

            return updatedProduct;
        });
    }

    async deleteProduct(organizationId: string, id: string): Promise<void> {
        await db.update(products).set({ isActive: false }).where(and(eq(products.id, id), eq(products.organizationId, organizationId)));
    }

    async updateProductStock(organizationId: string, id: string, quantityChange: number, userId: string, reason: string): Promise<void> {
        const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.organizationId, organizationId)));
        if (!product) throw new Error('Product not found');

        const newQuantity = parseFloat(String(product.stockQuantity)) + quantityChange;

        await db.transaction(async (tx: any) => {
            await tx
                .update(products)
                .set({ stockQuantity: String(newQuantity), updatedAt: new Date() })
                .where(and(eq(products.id, id), eq(products.organizationId, organizationId)));

            await tx.insert(inventoryLog).values({
                organizationId,
                type: 'product',
                itemId: id,
                action: quantityChange > 0 ? 'restock' : 'sale',
                quantityChange: String(quantityChange),
                previousQuantity: String(product.stockQuantity),
                newQuantity: String(newQuantity),
                userId,
                reason,
            });
        });
    }

    // Component Operations
    async getProductComponents(organizationId: string, productId: string): Promise<ProductComponent[]> {
        return db.select().from(productComponents).where(eq(productComponents.productId, productId));
    }

    async getOptionalProductComponents(productId: string): Promise<Array<{
        productComponentId: string;
        componentId: string;
        quantity: string;
        componentName: string;
        unit: string | null;
        stockQuantity: string;
        minThreshold: string;
    }>> {
        return db
            .select({
                productComponentId: productComponents.id,
                componentId: productComponents.componentId,
                quantity: productComponents.quantity,
                componentName: components.name,
                unit: components.unit,
                stockQuantity: components.stockQuantity,
                minThreshold: components.minThreshold,
            })
            .from(productComponents)
            .innerJoin(components, eq(productComponents.componentId, components.id))
            .where(
                and(
                    eq(productComponents.productId, productId),
                    eq(productComponents.isOptional, true),
                    eq(components.isActive, true)
                )
            )
            .orderBy(asc(components.name));
    }

    async createProductComponent(productComponent: InsertProductComponent): Promise<ProductComponent> {
        const [newProductComponent] = await db.insert(productComponents).values(productComponent).returning();
        return newProductComponent;
    }

    async deleteProductComponent(id: string): Promise<void> {
        await db.delete(productComponents).where(eq(productComponents.id, id));
    }

    async updateProductComponent(id: string, data: Partial<InsertProductComponent>): Promise<ProductComponent> {
        const [updated] = await db.update(productComponents).set(data).where(eq(productComponents.id, id)).returning();
        if (!updated) throw new Error('Product component not found');
        return updated;
    }

    async getLowStockProducts(organizationId: string): Promise<Product[]> {
        return db
            .select()
            .from(products)
            .where(
                and(
                    eq(products.organizationId, organizationId),
                    eq(products.isActive, true),
                    sql`${products.stockQuantity} <= ${products.minThreshold}`
                )
            )
            .orderBy(asc(products.stockQuantity));
    }
}

export const productService = new ProductService();
