
import { db } from "../db";
import {
    ingredients, inventoryLog,
    type Ingredient, type InsertIngredient
} from "@shared/schema";
import { eq, asc, and, sql } from "drizzle-orm";

export class InventoryService {
    async getIngredients(organizationId: string, search?: string): Promise<Ingredient[]> {
        const conditions: any[] = [eq(ingredients.isActive, true), eq(ingredients.organizationId, organizationId)];
        if (search && search.trim().length > 0) {
            const term = `%${search.trim().toLowerCase()}%`;
            conditions.push(sql`lower(${ingredients.name}) like ${term}`);
        }

        const whereExpr = conditions.length === 1 ? conditions[0] : and(...conditions as any);

        return db
            .select()
            .from(ingredients)
            .where(whereExpr as any)
            .orderBy(asc(ingredients.name));
    }

    async getIngredient(organizationId: string, id: string): Promise<Ingredient | undefined> {
        const [ingredient] = await db.select().from(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.organizationId, organizationId)));
        return ingredient;
    }

    async createIngredient(organizationId: string, ingredient: InsertIngredient): Promise<Ingredient> {
        const [newIngredient] = await db.insert(ingredients).values({ ...ingredient, organizationId }).returning();
        return newIngredient;
    }

    async updateIngredient(organizationId: string, id: string, ingredient: Partial<InsertIngredient>): Promise<Ingredient> {
        const [updatedIngredient] = await db
            .update(ingredients)
            .set({ ...ingredient, updatedAt: new Date() })
            .where(and(eq(ingredients.id, id), eq(ingredients.organizationId, organizationId)))
            .returning();
        return updatedIngredient;
    }

    async deleteIngredient(organizationId: string, id: string): Promise<void> {
        try {
            const result = await db.update(ingredients).set({ isActive: false }).where(and(eq(ingredients.id, id), eq(ingredients.organizationId, organizationId)));
            if (!result.rowCount || result.rowCount === 0) {
                throw new Error('Ingredient not found');
            }
        } catch (error) {
            console.error('Error deleting ingredient:', error);
            throw error;
        }
    }

    async updateIngredientStock(organizationId: string, id: string, quantityChange: number, userId: string, reason: string): Promise<void> {
        const [ingredient] = await db.select().from(ingredients).where(and(eq(ingredients.id, id), eq(ingredients.organizationId, organizationId)));
        if (!ingredient) throw new Error('Ingredient not found');

        const currentQuantity = parseFloat(ingredient.stockQuantity);
        const newQuantity = currentQuantity + quantityChange;

        await db.transaction(async (tx: any) => {
            await tx
                .update(ingredients)
                .set({ stockQuantity: String(newQuantity), updatedAt: new Date() })
                .where(and(eq(ingredients.id, id), eq(ingredients.organizationId, organizationId)));

            await tx.insert(inventoryLog).values({
                organizationId,
                type: 'ingredient',
                itemId: id,
                action: quantityChange > 0 ? 'restock' : 'sale',
                quantityChange: String(quantityChange),
                previousQuantity: ingredient.stockQuantity,
                newQuantity: String(newQuantity),
                userId,
                reason,
            });
        });
    }

    async getLowStockIngredients(organizationId: string): Promise<Ingredient[]> {
        return db
            .select()
            .from(ingredients)
            .where(
                and(
                    eq(ingredients.organizationId, organizationId),
                    eq(ingredients.isActive, true),
                    sql`${ingredients.stockQuantity} <= ${ingredients.minThreshold}`
                )
            )
            .orderBy(asc(ingredients.stockQuantity));
    }
}

export const inventoryService = new InventoryService();
