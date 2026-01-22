/**
 * Category Routes Module (v1)
 * 
 * Handles category CRUD operations:
 * - List/get categories
 * - Create/update/delete categories
 * - Reorder categories
 */

import { Router } from 'express';
import { storage } from '../../storage';
import { isAuthenticated, isAdmin } from '../../auth-middleware';
import { insertCategorySchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/categories
 * List all categories
 */
router.get('/', async (req, res) => {
    try {
        const categories = await storage.getCategories();
        res.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ message: "Failed to fetch categories" });
    }
});

/**
 * GET /api/categories/:id
 * Get a single category
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const categories = await storage.getCategories();
        const category = categories.find(c => c.id === id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ message: "Failed to fetch category" });
    }
});

/**
 * POST /api/categories
 * Create a new category
 */
router.post('/', isAuthenticated, async (req: any, res) => {
    try {
        const categoryData = insertCategorySchema.parse(req.body);
        const newCategory = await storage.createCategory(categoryData);
        res.status(201).json(newCategory);
    } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ message: "Failed to create category" });
    }
});

/**
 * PUT /api/categories/:id
 * Update an existing category
 */
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const categoryData = req.body;
        const updatedCategory = await storage.updateCategory(id, categoryData);
        res.json(updatedCategory);
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ message: "Failed to update category" });
    }
});

/**
 * DELETE /api/categories/:id
 * Delete a category
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await storage.deleteCategory(id);
        res.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ message: "Failed to delete category" });
    }
});

export default router;
