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
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { isAuthenticated, checkPermission } from '../../auth-middleware';
import { insertIngredientSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/inventory/low-stock
 * Get items (products and ingredients) with low stock levels
 */
router.get('/low-stock', isAuthenticated, checkPermission('inventory:read'), async (req: any, res) => {
    try {
        const organizationId = req.session.user.organizationId;
        const [products, ingredients] = await Promise.all([
            productService.getLowStockProducts(organizationId),
            inventoryService.getLowStockIngredients(organizationId)
        ]);

        // Attach recipeIngredients for ingredient_based products
        const withRecipes = await Promise.all(products.map(async (p: any) => {
            if (p.type === 'ingredient_based') {
                const recipeIngredients = await productService.getRecipeIngredients(organizationId, p.id);
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

        // Public endpoint requires header or default
        const organizationId = req.headers['x-organization-id'];
        if (!organizationId) return res.status(400).json({ message: "Organization context required" });

        const ingredients = await inventoryService.getIngredients(organizationId as string, search);
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
router.get('/ingredients', isAuthenticated, checkPermission('inventory:read'), async (req: any, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;

        const ingredients = await inventoryService.getIngredients(req.session.user.organizationId, search);
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
router.post('/ingredients', isAuthenticated, checkPermission('inventory:manage'), async (req: any, res) => {
    try {
        const ingredientData = insertIngredientSchema.parse(req.body);
        const ingredient = await inventoryService.createIngredient(req.session.user.organizationId, ingredientData);
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
router.patch('/ingredients/:id', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const ingredient = await inventoryService.updateIngredient(req.session.user.organizationId, id, updateData);
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
router.put('/ingredients/:id', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const ingredientData = insertIngredientSchema.parse(req.body);
        const ingredient = await inventoryService.updateIngredient(req.session.user.organizationId, id, ingredientData);
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
router.delete('/ingredients/:id', isAuthenticated, checkPermission('inventory:manage'), async (req: any, res) => {
    try {
        const { id } = req.params;
        await inventoryService.deleteIngredient(req.session.user.organizationId, id);
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
router.patch('/ingredients/:id/stock', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { quantityChange, reason } = req.body;

        if (typeof quantityChange !== 'number') {
            return res.status(400).json({ message: "quantityChange must be a number" });
        }

        await inventoryService.updateIngredientStock(req.session.user.organizationId, id, quantityChange, req.session.user.id, reason);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating ingredient stock:", error);
        res.status(500).json({ message: "Failed to update ingredient stock" });
    }
});

// Legacy POST for stock adjustment (backward compatibility)
router.post('/ingredients/:id/stock', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { quantity, reason } = req.body;

        await inventoryService.updateIngredientStock(req.session.user.organizationId, id, quantity, req.session.user.id, reason);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating ingredient stock:", error);
        res.status(500).json({ message: "Failed to update ingredient stock" });
    }
});

export default router;
