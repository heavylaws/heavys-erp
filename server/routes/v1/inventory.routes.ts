/**
 * Inventory Routes Module (v1)
 * 
 * Handles inventory management:
 * - Ingredients CRUD
 * - Stock level monitoring (low stock alerts)
 * - Stock adjustments (ingredients)
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../../storage';
import { isAuthenticated } from '../../auth-middleware';
import { insertIngredientSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/inventory/low-stock
 * Get items (products and ingredients) with low stock levels
 */
router.get('/low-stock', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const [products, ingredients] = await Promise.all([
            storage.getLowStockProducts(),
            storage.getLowStockIngredients()
        ]);

        // Attach recipeIngredients for ingredient_based products
        const withRecipes = await Promise.all(products.map(async (p) => {
            if (p.type === 'ingredient_based') {
                const recipeIngredients = await storage.getRecipeIngredients(p.id);
                return { ...p, recipeIngredients };
            }
            return p;
        }));

        res.json({ products: withRecipes, ingredients });
    } catch (error) {
        console.error("Error fetching low stock items:", error);
        res.status(500).json({ message: "Failed to fetch low stock items" });
    }
});

// --- Ingredients Routes ---

/**
 * GET /api/ingredients-public
 * DEV-ONLY: Public ingredients endpoint
 */
router.get('/ingredients-public', async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const ingredients = await storage.getIngredients(search);
        res.json(ingredients);
    } catch (error) {
        console.error('Error fetching public ingredients:', error);
        res.status(500).json({ message: 'Failed to fetch ingredients' });
    }
});

/**
 * GET /api/ingredients
 * List all ingredients
 */
router.get('/ingredients', isAuthenticated, async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const ingredients = await storage.getIngredients(search);
        res.json(ingredients);
    } catch (error) {
        console.error("Error fetching ingredients:", error);
        res.status(500).json({ message: "Failed to fetch ingredients" });
    }
});

/**
 * POST /api/ingredients
 * Create new ingredient
 */
router.post('/ingredients', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const ingredientData = insertIngredientSchema.parse(req.body);
        const ingredient = await storage.createIngredient(ingredientData);
        res.json(ingredient);
    } catch (error) {
        console.error("Error creating ingredient:", error);
        res.status(500).json({ message: "Failed to create ingredient" });
    }
});

/**
 * PATCH /api/ingredients/:id
 * Update ingredient details
 */
router.patch('/ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { id } = req.params;
        const updateData = req.body;
        const ingredient = await storage.updateIngredient(id, updateData);
        res.json(ingredient);
    } catch (error) {
        console.error("Error updating ingredient:", error);
        res.status(500).json({ message: "Failed to update ingredient" });
    }
});

/**
 * PUT /api/ingredients/:id
 * Full update of ingredient
 */
router.put('/ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { id } = req.params;
        const ingredientData = insertIngredientSchema.parse(req.body);
        const ingredient = await storage.updateIngredient(id, ingredientData);
        res.json(ingredient);
    } catch (error) {
        console.error("Error updating ingredient:", error);
        res.status(500).json({ message: "Failed to update ingredient" });
    }
});

/**
 * DELETE /api/ingredients/:id
 * Delete ingredient
 */
router.delete('/ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { id } = req.params;
        await storage.deleteIngredient(id);
        res.json({ message: 'Ingredient deleted successfully' });
    } catch (error) {
        console.error("Error deleting ingredient:", error);
        res.status(500).json({ message: "Failed to delete ingredient. It may be used in recipes." });
    }
});

/**
 * PATCH /api/ingredients/:id/stock
 * Adjust ingredient stock
 */
router.patch('/ingredients/:id/stock', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { id } = req.params;
        const { quantityChange, reason } = req.body;

        if (typeof quantityChange !== 'number') {
            return res.status(400).json({ message: "quantityChange must be a number" });
        }

        await storage.updateIngredientStock(id, quantityChange, user.id, reason);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating ingredient stock:", error);
        res.status(500).json({ message: "Failed to update ingredient stock" });
    }
});

// Legacy POST for stock adjustment (backward compatibility)
router.post('/ingredients/:id/stock', isAuthenticated, async (req: any, res) => {
    try {
        const user = req.session.user;
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { id } = req.params;
        const { quantity, reason } = req.body;

        await storage.updateIngredientStock(id, quantity, user.id, reason);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating ingredient stock:", error);
        res.status(500).json({ message: "Failed to update ingredient stock" });
    }
});

export default router;
