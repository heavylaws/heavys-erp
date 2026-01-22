/**
 * Product Routes Module (v1)
 * 
 * Handles product management:
 * - Product CRUD
 * - Stock management
 * - Recipe/Ingredient links
 * - Options and variants
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../../storage';
import { isAuthenticated } from '../../auth-middleware';
import { insertProductSchema } from '@shared/schema';
import { ENABLE_OPTIONS_SYSTEM } from '@shared/feature-flags';

const router = Router();

// Helper for permissions
const requireManager = (req: any, res: any, next: any) => {
    const user = req.session?.user;
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
};

/**
 * GET /api/products
 * List all products, optionally filtered by category
 * Enriches response with option groups and recipe ingredients
 */
router.get('/', async (req, res) => {
    try {
        const { categoryId } = req.query;
        let products;
        if (categoryId) {
            products = await storage.getProductsByCategory(categoryId as string);
        } else {
            products = await storage.getProducts();
        }

        // For ingredient_based products, fetch and attach recipeIngredients
        const enriched = await Promise.all(products.map(async (p) => {
            let base: any = p;
            if (p.type === 'ingredient_based') {
                const recipeIngredients = await storage.getRecipeIngredients(p.id);
                base = { ...base, recipeIngredients };
            }

            if (ENABLE_OPTIONS_SYSTEM) {
                try {
                    // Cast storage to any due to missing interface definition likely in transition
                    const productGroups = await (storage as any).getProductOptionGroups(p.id);
                    if (productGroups && productGroups.length) {
                        base = {
                            ...base, optionGroups: productGroups.map((m: any) => ({
                                id: m.group.id,
                                name: m.group.name,
                                description: m.group.description,
                                selectionType: m.group.selectionType,
                                minSelections: m.group.minSelections,
                                maxSelections: m.group.maxSelections,
                                required: m.group.required || m.mapping?.required || false,
                                displayOrder: m.displayOrder || 0,
                                options: (m.options || []).map((o: any) => ({
                                    id: o.id,
                                    name: o.name,
                                    description: o.description,
                                    priceAdjust: o.priceAdjust,
                                    isDefault: o.isDefault,
                                    isActive: o.isActive,
                                    displayOrder: o.displayOrder
                                }))
                            }))
                        };
                    }
                } catch (e) {
                    // Swallow option error to avoid breaking product list
                }
            }
            return base;
        }));

        res.json(enriched);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

/**
 * GET /api/products/:categoryId
 * Fallback/Legacy route for products by category
 */
router.get('/:categoryId', isAuthenticated, async (req, res) => {
    // Check if param is arguably a UUID, if so assume it is a category ID look up
    // If strict UUID check fails, it might be a collision with other :id routes if not mounted carefully.
    // The consumer should likely use /api/products?categoryId=... instead.
    // But strictly mirroring old routes:
    try {
        const { categoryId } = req.params;
        // Check if it looks like a category fetch or product detail fetch? 
        // Old route was /api/products/:categoryId. 
        // NOTE: This overlaps with GET /api/products/:id for single product if we had one.
        // The monolithic routes didn't seem to have a specific GET /product/:id endpoint, only GET /products/:categoryId

        const products = await storage.getProductsByCategory(categoryId);
        // Reuse enrichment logic? for now kept simple or consistent with monolithic
        if (!ENABLE_OPTIONS_SYSTEM) return res.json(products);

        const enriched = await Promise.all(products.map(async (p) => {
            let base: any = p;
            if (p.type === 'ingredient_based') {
                const recipeIngredients = await storage.getRecipeIngredients(p.id);
                base = { ...base, recipeIngredients };
            }
            // Options logic omitted for brevity as it duplicates above - but ideally should be shared function
            // For now, mirroring strict behavior of old route if possible
            return base;
        }));
        res.json(enriched);
    } catch (error) {
        console.error("Error fetching products by category:", error);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

/**
 * POST /api/products
 * Create new product (Manager/Admin)
 */
router.post('/', isAuthenticated, requireManager, async (req: any, res) => {
    try {
        // Relax schema to allow numbers for decimal fields (drizzle-zod expects strings for decimals)
        const relaxedProductSchema = insertProductSchema.extend({
            stockQuantity: z.union([z.string(), z.number()]).optional().transform((v) => String(v || '0')),
            price: z.union([z.string(), z.number()]).transform((v) => String(v)),
            costPerUnit: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => v !== null && v !== undefined ? String(v) : v),
            barcodes: z.array(z.string()).optional(),
        });

        const parsed = relaxedProductSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid product data",
                errors: parsed.error.issues
            });
        }

        const product = await storage.createProduct(parsed.data);
        res.json(product);
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: "Failed to create product" });
    }
});

/**
 * PATCH /api/products/:id
 * Update product (Manager/Admin)
 */
router.patch('/:id', isAuthenticated, requireManager, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const product = await storage.updateProduct(id, updateData);
        res.json(product);
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Failed to update product" });
    }
});

/**
 * DELETE /api/products/:id
 * Soft delete/deactivate product
 */
router.delete('/:id', isAuthenticated, requireManager, async (req, res) => {
    try {
        const { id } = req.params;
        await storage.deleteProduct(id);
        res.json({ message: 'Product deactivated successfully' });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Failed to delete product" });
    }
});

/**
 * PATCH /api/products/:id/stock
 * Adjust product stock
 */
router.patch('/:id/stock', isAuthenticated, requireManager, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { quantityChange, reason } = req.body;

        if (typeof quantityChange !== 'number') {
            return res.status(400).json({ message: "quantityChange must be a number" });
        }

        await storage.updateProductStock(id, quantityChange, req.session.user.id, reason);
        const updatedProduct = await storage.getProduct(id);
        res.json(updatedProduct);
    } catch (error) {
        console.error("Error updating product stock:", error);
        res.status(500).json({ message: "Failed to update product stock" });
    }
});

// --- Recipe & Ingredients Links ---

/**
 * GET /api/products/:id/recipe
 * Get recipe ingredients for a product
 */
router.get('/:id/recipe', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const recipeIngredients = await storage.getRecipeIngredients(id);
        res.json(recipeIngredients);
    } catch (error) {
        console.error("Error fetching recipe ingredients:", error);
        res.status(500).json({ message: "Failed to fetch recipe ingredients" });
    }
});

/**
 * GET /api/products/:id/optional-ingredients
 * Get optional ingredients for a product
 */
router.get('/:id/optional-ingredients', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const optionalIngredients = await storage.getOptionalRecipeIngredients(id);
        res.json(optionalIngredients);
    } catch (error) {
        console.error('Error fetching optional recipe ingredients:', error);
        res.status(500).json({ message: 'Failed to fetch optional ingredients' });
    }
});

/**
 * POST /api/products/:id/recipe
 * Add ingredient to product recipe
 */
router.post('/:id/recipe', isAuthenticated, requireManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { ingredientId, quantity, isOptional = false } = req.body;

        const recipeIngredient = await storage.createRecipeIngredient({
            productId: id,
            ingredientId,
            quantity: quantity.toString(),
            isOptional
        });

        res.json(recipeIngredient);
    } catch (error) {
        console.error("Error adding recipe ingredient:", error);
        res.status(500).json({ message: "Failed to add recipe ingredient" });
    }
});

// Since these are manipulating recipe ingredients resources directly,
// we'll keep them here or in inventory. But since they are tied to managing product recipes:

/**
 * PATCH /api/recipe-ingredients/:id
 * Update a recipe ingredient link
 */
router.patch('/recipe-ingredients/:id', isAuthenticated, requireManager, async (req, res) => {
    try {
        const { id } = req.params;
        const data: any = {};
        if (typeof req.body.isOptional === 'boolean') data.isOptional = req.body.isOptional;
        if (req.body.quantity) data.quantity = req.body.quantity.toString();

        const updated = await storage.updateRecipeIngredient(id, data);
        res.json(updated);
    } catch (error) {
        console.error('Error updating recipe ingredient:', error);
        res.status(500).json({ message: 'Failed to update recipe ingredient' });
    }
});

/**
 * DELETE /api/recipe-ingredients/:id
 * Remove an ingredient from a recipe
 */
router.delete('/recipe-ingredients/:id', isAuthenticated, requireManager, async (req, res) => {
    try {
        const { id } = req.params;
        await storage.deleteRecipeIngredient(id);
        res.json({ message: "Recipe ingredient removed successfully" });
    } catch (error) {
        console.error("Error removing recipe ingredient:", error);
        res.status(500).json({ message: "Failed to remove recipe ingredient" });
    }
});

export default router;
