/**
 * Inventory Routes Module (v1)
 * 
 * Handles inventory management:
 * - Components CRUD
 * - Stock level monitoring (low stock alerts)
 * - Stock adjustments (components)
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../../storage';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { isAuthenticated, checkPermission } from '../../auth-middleware';
import { insertComponentSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/inventory/low-stock
 * Get items (products and components) with low stock levels
 */
router.get('/low-stock', isAuthenticated, checkPermission('inventory:read'), async (req: any, res) => {
    try {
        const organizationId = req.session.user.organizationId;
        const [products, components] = await Promise.all([
            productService.getLowStockProducts(organizationId),
            inventoryService.getLowStockComponents(organizationId)
        ]);

        // Attach productComponents for component_based products
        const withBundles = await Promise.all(products.map(async (p: any) => {
            if (p.type === 'component_based') {
                const productComponents = await productService.getProductComponents(organizationId, p.id);
                return { ...p, productComponents };
            }
            return p;
        }));

        res.json({ products: withBundles, components });
    } catch (error) {
        console.error("Error fetching low stock items:", error);
        res.status(500).json({ message: "Failed to fetch low stock items" });
    }
});

// --- Components Routes ---

/**
 * GET /api/components-public
 * DEV-ONLY: Public components endpoint
 */
router.get('/components-public', async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;

        // Public endpoint requires header or default
        const organizationId = req.headers['x-organization-id'];
        if (!organizationId) return res.status(400).json({ message: "Organization context required" });

        const components = await inventoryService.getComponents(organizationId as string, search);
        res.json(components);
    } catch (error) {
        console.error('Error fetching public components:', error);
        res.status(500).json({ message: 'Failed to fetch components' });
    }
});

/**
 * GET /api/components
 * List all components
 */
router.get('/components', isAuthenticated, checkPermission('inventory:read'), async (req: any, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;

        const components = await inventoryService.getComponents(req.session.user.organizationId, search);
        res.json(components);
    } catch (error) {
        console.error("Error fetching components:", error);
        res.status(500).json({ message: "Failed to fetch components" });
    }
});

/**
 * POST /api/components
 * Create new component
 */
router.post('/components', isAuthenticated, checkPermission('inventory:manage'), async (req: any, res) => {
    try {
        const componentData = insertComponentSchema.parse(req.body);
        const component = await inventoryService.createComponent(req.session.user.organizationId, componentData);
        res.json(component);
    } catch (error) {
        console.error("Error creating component:", error);
        res.status(500).json({ message: "Failed to create component" });
    }
});

/**
 * PATCH /api/components/:id
 * Update component details
 */
router.patch('/components/:id', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const component = await inventoryService.updateComponent(req.session.user.organizationId, id, updateData);
        res.json(component);
    } catch (error) {
        console.error("Error updating component:", error);
        res.status(500).json({ message: "Failed to update component" });
    }
});

/**
 * PUT /api/components/:id
 * Full update of component
 */
router.put('/components/:id', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const componentData = insertComponentSchema.parse(req.body);
        const component = await inventoryService.updateComponent(req.session.user.organizationId, id, componentData);
        res.json(component);
    } catch (error) {
        console.error("Error updating component:", error);
        res.status(500).json({ message: "Failed to update component" });
    }
});

/**
 * DELETE /api/components/:id
 * Delete component
 */
router.delete('/components/:id', isAuthenticated, checkPermission('inventory:manage'), async (req: any, res) => {
    try {
        const { id } = req.params;
        await inventoryService.deleteComponent(req.session.user.organizationId, id);
        res.json({ message: 'Component deleted successfully' });
    } catch (error) {
        console.error("Error deleting component:", error);
        res.status(500).json({ message: "Failed to delete component. It may be used in bundles." });
    }
});

/**
 * PATCH /api/components/:id/stock
 * Adjust component stock
 */
router.patch('/components/:id/stock', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { quantityChange, reason } = req.body;

        if (typeof quantityChange !== 'number') {
            return res.status(400).json({ message: "quantityChange must be a number" });
        }

        await inventoryService.updateComponentStock(req.session.user.organizationId, id, quantityChange, req.session.user.id, reason);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating component stock:", error);
        res.status(500).json({ message: "Failed to update component stock" });
    }
});

// Legacy POST for stock adjustment (backward compatibility, now redirected to components)
router.post('/components/:id/stock', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { quantity, reason } = req.body;

        await inventoryService.updateComponentStock(req.session.user.organizationId, id, quantity, req.session.user.id, reason);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating component stock:", error);
        res.status(500).json({ message: "Failed to update component stock" });
    }
});

export default router;
