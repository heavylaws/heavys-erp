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
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from '../../storage';
import { productService } from '../../services/product.service';
import { isAuthenticated, checkPermission } from '../../auth-middleware';
import { insertProductSchema } from '@shared/schema';
import { ENABLE_OPTIONS_SYSTEM } from '@shared/feature-flags';

const router = Router();

// Setup upload storage
const uploadDir = path.resolve(process.cwd(), 'client/public/uploads/products');
// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({
    storage: fileStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});


/**
 * GET /api/products
 * List all products, optionally filtered by category
 * Enriches response with option groups and recipe ingredients
 * Note: Keeps existing public access level (no auth required) consistent with previous implementation
 */
router.get('/', async (req: any, res) => {
    try {
        const { categoryId } = req.query;
        // Tenant context resolution: Session -> Header -> Fail
        const organizationId = req.session?.user?.organizationId || req.headers['x-organization-id'];

        if (!organizationId) {
            return res.status(400).json({ message: "Organization context required (header x-organization-id or login)" });
        }

        let products;
        if (categoryId) {
            products = await productService.getProductsByCategory(organizationId as string, categoryId as string);
        } else {
            products = await productService.getProducts(organizationId as string);
        }

        // For component_based products, fetch and attach productComponents
        const enriched = await Promise.all(products.map(async (p) => {
            let base: any = p;
            if (p.type === 'component_based') {
                const productComponents = await productService.getProductComponents(organizationId as string, p.id);
                base = { ...base, productComponents };
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
router.get('/:categoryId', isAuthenticated, async (req: any, res) => {
    try {
        const { categoryId } = req.params;
        const organizationId = req.session.user.organizationId;
        const products = await productService.getProductsByCategory(organizationId, categoryId);

        if (!ENABLE_OPTIONS_SYSTEM) return res.json(products);

        const enriched = await Promise.all(products.map(async (p) => {
            let base: any = p;
            if (p.type === 'component_based') {
                const productComponents = await productService.getProductComponents(organizationId, p.id);
                base = { ...base, productComponents };
            }
            return base;
        }));
        res.json(enriched);
    } catch (error) {
        console.error("Error fetching products by category:", error);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

/**
 * POST /api/products/upload
 * Upload product image
 */
router.post('/upload', isAuthenticated, upload.single('image'), (req: any, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
    }
    // Return relative path for frontend use
    const publicPath = `/uploads/products/${req.file.filename}`;
    res.json({ url: publicPath });
});

/**
 * POST /api/products
 * Create new product (Manager/Admin)
 */
router.post('/', isAuthenticated, checkPermission('product:create'), async (req: any, res) => {
    try {
        // Relax schema to allow numbers for decimal fields (drizzle-zod expects strings for decimals)
        const relaxedProductSchema = insertProductSchema.extend({
            stockQuantity: z.union([z.string(), z.number()]).optional().transform((v) => String(v || '0')),
            price: z.union([z.string(), z.number()]).transform((v) => String(v)),
            costPerUnit: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => v !== null && v !== undefined ? String(v) : v),
            barcodes: z.array(z.string()).optional(),
            sku: z.string().optional().nullable().transform(v => v === "" ? null : v),
            barcode: z.string().optional().nullable().transform(v => v === "" ? null : v),
        });

        const parsed = relaxedProductSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid product data",
                errors: parsed.error.issues
            });
        }

        const product = await productService.createProduct(req.session.user!.organizationId, parsed.data);
        res.json(product);
    } catch (error) {
        console.error("Error creating product:", error);
        // Log detailed error to a file for debugging
        const fs = await import('fs');
        const path = await import('path');
        const logPath = path.resolve(process.cwd(), 'server_error.log');
        const errorMessage = `[${new Date().toISOString()}] Error creating product: ${error instanceof Error ? error.stack : JSON.stringify(error)}\nRequest Body: ${JSON.stringify(req.body)}\n\n`;
        await fs.promises.appendFile(logPath, errorMessage);

        res.status(500).json({ message: "Failed to create product" });
    }
});

/**
 * PATCH /api/products/:id
 * Update product (Manager/Admin)
 */
router.patch('/:id', isAuthenticated, checkPermission('product:update'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const product = await productService.updateProduct(req.session.user!.organizationId, id, updateData);
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
router.delete('/:id', isAuthenticated, checkPermission('product:delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await productService.deleteProduct(req.session.user!.organizationId, id);
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
router.patch('/:id/stock', isAuthenticated, checkPermission('inventory:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { quantityChange, reason } = req.body;

        if (typeof quantityChange !== 'number') {
            return res.status(400).json({ message: "quantityChange must be a number" });
        }

        await productService.updateProductStock(req.session.user.organizationId, id, quantityChange, req.session.user.id, reason);
        const updatedProduct = await productService.getProduct(req.session.user.organizationId, id);
        res.json(updatedProduct);
    } catch (error) {
        console.error("Error updating product stock:", error);
        res.status(500).json({ message: "Failed to update product stock" });
    }
});

// --- Product Component Links ---

/**
 * GET /api/products/:id/components
 * Get components for a product
 */
router.get('/:id/components', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const productComponents = await productService.getProductComponents(req.session.user!.organizationId, id);
        res.json(productComponents);
    } catch (error) {
        console.error("Error fetching product components:", error);
        res.status(500).json({ message: "Failed to fetch product components" });
    }
});

/**
 * GET /api/products/:id/optional-components
 * Get optional components for a product
 */
router.get('/:id/optional-components', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const optionalComponents = await productService.getOptionalProductComponents(id);
        res.json(optionalComponents);
    } catch (error) {
        console.error('Error fetching optional product components:', error);
        res.status(500).json({ message: 'Failed to fetch optional components' });
    }
});

/**
 * POST /api/products/:id/components
 * Add component to product bundle
 */
router.post('/:id/components', isAuthenticated, checkPermission('product:update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { componentId, quantity, isOptional = false } = req.body;

        const productComponent = await productService.createProductComponent({
            productId: id,
            componentId,
            quantity: quantity.toString(),
            isOptional
        });

        res.json(productComponent);
    } catch (error) {
        console.error("Error adding product component:", error);
        res.status(500).json({ message: "Failed to add product component" });
    }
});

/**
 * PATCH /api/product-components/:id
 * Update a product component link
 */
router.patch('/product-components/:id', isAuthenticated, checkPermission('product:update'), async (req, res) => {
    try {
        const { id } = req.params;
        const data: any = {};
        if (typeof req.body.isOptional === 'boolean') data.isOptional = req.body.isOptional;
        if (req.body.quantity) data.quantity = req.body.quantity.toString();

        const updated = await productService.updateProductComponent(id, data);
        res.json(updated);
    } catch (error) {
        console.error('Error updating product component:', error);
        res.status(500).json({ message: 'Failed to update product component' });
    }
});

/**
 * DELETE /api/product-components/:id
 * Remove a component from a product
 */
router.delete('/product-components/:id', isAuthenticated, checkPermission('product:update'), async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.session.user!;
        // Ideally verify that component belongs to org via product
        // For now trusting permission checks
        await productService.deleteProductComponent(id);
        res.json({ message: "Product component removed successfully" });
    } catch (error) {
        console.error("Error removing product component:", error);
        res.status(500).json({ message: "Failed to remove product component" });
    }
});

export default router;
