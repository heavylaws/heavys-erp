
import { db } from "../db";
import {
    ingredients, inventoryLog,
    type Ingredient, type InsertIngredient
} from "@shared/schema";
import { eq, asc, and, sql } from "drizzle-orm";

export class InventoryService {
    async getIngredients(search?: string): Promise<Ingredient[]> {
        const conditions: any[] = [eq(ingredients.isActive, true)];
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

    async getIngredient(id: string): Promise<Ingredient | undefined> {
        const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, id));
        return ingredient;
    }

    async createIngredient(ingredient: InsertIngredient): Promise<Ingredient> {
        const [newIngredient] = await db.insert(ingredients).values(ingredient).returning();
        return newIngredient;
    }

    async updateIngredient(id: string, ingredient: Partial<InsertIngredient>): Promise<Ingredient> {
        const [updatedIngredient] = await db
            .update(ingredients)
            .set({ ...ingredient, updatedAt: new Date() })
            .where(eq(ingredients.id, id))
            .returning();
        return updatedIngredient;
    }

    async deleteIngredient(id: string): Promise<void> {
        try {
            const result = await db.update(ingredients).set({ isActive: false }).where(eq(ingredients.id, id));
            if (!result.rowCount || result.rowCount === 0) {
                throw new Error('Ingredient not found');
            }
        } catch (error) {
            console.error('Error deleting ingredient:', error);
            throw error;
        }
    }

    async updateIngredientStock(id: string, quantityChange: number, userId: string, reason: string): Promise<void> {
        const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, id));
        if (!ingredient) throw new Error('Ingredient not found');

        const currentQuantity = parseFloat(ingredient.stockQuantity);
        const newQuantity = currentQuantity + quantityChange;

        await db.transaction(async (tx: any) => {
            await tx
                .update(ingredients)
                .set({ stockQuantity: String(newQuantity), updatedAt: new Date() })
                .where(eq(ingredients.id, id));

            await tx.insert(inventoryLog).values({
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

    async getLowStockIngredients(): Promise<Ingredient[]> {
        return db
            .select()
            .from(ingredients)
            .where(
                and(
                    eq(ingredients.isActive, true),
                    sql`${ingredients.stockQuantity} <= ${ingredients.minThreshold}`
                )
            )
            .orderBy(asc(ingredients.stockQuantity));
    }
}

export const inventoryService = new InventoryService();
