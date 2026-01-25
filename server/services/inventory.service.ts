
import { db } from "../db";
import {
    components, inventoryLog,
    type Component, type InsertComponent
} from "@shared/schema";
import { eq, asc, and, sql } from "drizzle-orm";

export class InventoryService {
    async getComponents(organizationId: string, search?: string): Promise<Component[]> {
        const conditions: any[] = [eq(components.isActive, true), eq(components.organizationId, organizationId)];
        if (search && search.trim().length > 0) {
            const term = `%${search.trim().toLowerCase()}%`;
            conditions.push(sql`lower(${components.name}) like ${term}`);
        }

        const whereExpr = conditions.length === 1 ? conditions[0] : and(...conditions as any);

        return db
            .select()
            .from(components)
            .where(whereExpr as any)
            .orderBy(asc(components.name));
    }

    async getComponent(organizationId: string, id: string): Promise<Component | undefined> {
        const [component] = await db.select().from(components).where(and(eq(components.id, id), eq(components.organizationId, organizationId)));
        return component;
    }

    async createComponent(organizationId: string, component: InsertComponent): Promise<Component> {
        const [newComponent] = await db.insert(components).values({ ...component, organizationId }).returning();
        return newComponent;
    }

    async updateComponent(organizationId: string, id: string, component: Partial<InsertComponent>): Promise<Component> {
        const [updatedComponent] = await db
            .update(components)
            .set({ ...component, updatedAt: new Date() })
            .where(and(eq(components.id, id), eq(components.organizationId, organizationId)))
            .returning();
        return updatedComponent;
    }

    async deleteComponent(organizationId: string, id: string): Promise<void> {
        try {
            const result = await db.update(components).set({ isActive: false }).where(and(eq(components.id, id), eq(components.organizationId, organizationId)));
            if (!result.rowCount || result.rowCount === 0) {
                throw new Error('Component not found');
            }
        } catch (error) {
            console.error('Error deleting component:', error);
            throw error;
        }
    }

    async updateComponentStock(organizationId: string, id: string, quantityChange: number, userId: string, reason: string): Promise<void> {
        const [component] = await db.select().from(components).where(and(eq(components.id, id), eq(components.organizationId, organizationId)));
        if (!component) throw new Error('Component not found');

        const currentQuantity = parseFloat(component.stockQuantity);
        const newQuantity = currentQuantity + quantityChange;

        await db.transaction(async (tx: any) => {
            await tx
                .update(components)
                .set({ stockQuantity: String(newQuantity), updatedAt: new Date() })
                .where(and(eq(components.id, id), eq(components.organizationId, organizationId)));

            await tx.insert(inventoryLog).values({
                organizationId,
                type: 'component',
                itemId: id,
                action: quantityChange > 0 ? 'restock' : 'sale',
                quantityChange: String(quantityChange),
                previousQuantity: component.stockQuantity,
                newQuantity: String(newQuantity),
                userId,
                reason,
            });
        });
    }

    async getLowStockComponents(organizationId: string): Promise<Component[]> {
        return db
            .select()
            .from(components)
            .where(
                and(
                    eq(components.organizationId, organizationId),
                    eq(components.isActive, true),
                    sql`${components.stockQuantity} <= ${components.minThreshold}`
                )
            )
            .orderBy(asc(components.stockQuantity));
    }
}

export const inventoryService = new InventoryService();
