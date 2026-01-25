/**
 * Order Routes Module (v1)
 * 
 * Handles order management:
 * - Order creation/updates (Technician/Assembly flow)
 * - Order listing and filtering
 * - Order items management
 * - Customer calling (notification)
 * - Favorites/Combos
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../../storage';
import { orderService } from '../../services/order.service';
import { productService } from '../../services/product.service';
import { isAuthenticated, checkPermission } from '../../auth-middleware';
import { broadcastOrderUpdate, broadcast } from '../../services/websocket';
import { insertFavoriteComboSchema, insertOrderSchema, insertOrderItemSchema } from '@shared/schema';
import { ENABLE_OPTIONS_SYSTEM } from '@shared/feature-flags';
import { AuthPolicy } from '../../services/auth.policy';

const router = Router();

// Validation Schemas
const favoriteComboItemInputSchema = z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity too large'),
});

const favoriteComboCreateSchema = insertFavoriteComboSchema
    .pick({ name: true, description: true, isActive: true, displayOrder: true })
    .extend({
        items: z.array(favoriteComboItemInputSchema).min(1, 'Add at least one product'),
    });

const favoriteComboUpdateSchema = insertFavoriteComboSchema
    .pick({ name: true, description: true, isActive: true, displayOrder: true })
    .partial()
    .extend({
        items: z.array(favoriteComboItemInputSchema).min(1, 'Add at least one product').optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        { message: 'Provide at least one field to update' }
    );

// --- Order Routes ---

/**
 * GET /api/orders
 * List orders with optional filters
 */
router.get('/', isAuthenticated, checkPermission('order:read'), async (req, res) => {
    try {
        const { status, limit, sentToFulfillment, include_items } = req.query as any;
        let orders;

        if (status) {
            // If include_items is set, use the optimized endpoint that returns items inline
            if (include_items === 'true') {
                orders = await orderService.getOrdersByStatusWithItems(req.session.user!.organizationId, status as string);
            } else {
                orders = await orderService.getOrdersByStatus(req.session.user!.organizationId, status as string);
            }
        } else {
            orders = await orderService.getOrders(req.session.user!.organizationId, limit ? parseInt(limit as string) : undefined);
        }

        // Optional filter: only orders explicitly sent to fulfillment
        if (sentToFulfillment === 'true') {
            orders = orders.filter((order: any) => order.sentToFulfillment);
        }

        // Exclude archived orders by default unless explicitly asked
        const includeArchived = typeof req.query.includeArchived === 'string' && req.query.includeArchived === 'true';
        if (!includeArchived) {
            orders = orders.filter((order: any) => !order.archived);
        }

        res.json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
});

/**
 * GET /api/orders/:id
 * Get single order details
 */
router.get('/:id', isAuthenticated, checkPermission('order:read'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const order = await orderService.getOrderWithDetails(req.session.user.organizationId, id);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        res.json(order);
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ message: "Failed to fetch order details" });
    }
});

/**
 * GET /api/orders/:id/items
 * Get items for a specific order
 */
router.get('/:id/items', isAuthenticated, checkPermission('order:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const items = await orderService.getOrderItems(id);
        res.json(items);
    } catch (error) {
        console.error("Error fetching order items:", error);
        res.status(500).json({ message: "Failed to fetch order items" });
    }
});

/**
 * POST /api/orders
 * Create new order
 */
router.post('/', isAuthenticated, checkPermission('order:create'), async (req: any, res) => {
    try {
        const user = req.session.user;

        // Handle both old format (with separate order/items) and new format (all in one)
        let orderData, items;
        if (req.body.order && req.body.items) {
            orderData = req.body.order;
            items = req.body.items;
        } else {
            const { items: itemsData, ...restData } = req.body;
            orderData = restData;
            items = itemsData;
        }

        // Get next order number
        const orderNumber = await orderService.getNextOrderNumber(user.organizationId);

        // Calculate subtotal from items (including selected option price adjustments if flag enabled)
        let subtotal = 0;
        const optionalComponentCache: Record<string, any[]> = {};

        for (const item of items) {
            const baseUnitPrice = parseFloat(item.unitPrice || item.price || '0');
            let optionAdjustTotal = 0;
            let selectedOptionIds: string[] = [];
            const optionSummaries: string[] = [];

            if (ENABLE_OPTIONS_SYSTEM && Array.isArray(item.selectedOptionIds) && item.selectedOptionIds.length) {
                const uniqueOptionIds = Array.from(new Set(item.selectedOptionIds.map((id: any) => String(id))));
                // Options still on storage
                const optionEntities = await (storage as any).getOptionsByIds(uniqueOptionIds);
                selectedOptionIds = optionEntities.map((o: any) => o.id);
                for (const opt of optionEntities) {
                    const adj = parseFloat(opt.priceAdjust || '0');
                    if (!isNaN(adj)) optionAdjustTotal += adj;
                    const adjLabel = !isNaN(adj) && adj !== 0 ? ` (${adj >= 0 ? '+' : ''}$${Math.abs(adj).toFixed(2)})` : '';
                    optionSummaries.push(`${opt.name}${adjLabel}`);
                }
            }

            const optionalSummaries: string[] = [];
            let selectedOptionalComponentIds: string[] = [];
            if (Array.isArray(item.selectedOptionalComponentIds) && item.selectedOptionalComponentIds.length) {
                const uniqueOptionalIds = Array.from(new Set(item.selectedOptionalComponentIds.map((id: any) => String(id))));
                if (!optionalComponentCache[item.productId]) {
                    // Use ProductService
                    optionalComponentCache[item.productId] = await productService.getOptionalProductComponents(item.productId);
                }
                const optionalMap = new Map(
                    (optionalComponentCache[item.productId] || []).map((row: any) => [row.productComponentId, row])
                );

                for (const optId of uniqueOptionalIds) {
                    const detail = optionalMap.get(optId);
                    if (!detail) {
                        return res.status(400).json({
                            message: `Invalid optional component selection for product ${item.productId}`
                        });
                    }
                    selectedOptionalComponentIds.push(detail.productComponentId);
                    const parsedQty = detail.quantity ? parseFloat(detail.quantity) : NaN;
                    const hasQty = !isNaN(parsedQty) && parsedQty > 0;
                    const qtyLabel = hasQty
                        ? `${Number(parsedQty.toFixed(3)).toString()}${detail.unit ? ` ${detail.unit}` : ''}`
                        : '';
                    optionalSummaries.push(qtyLabel ? `${detail.componentName} (${qtyLabel})` : detail.componentName);
                }
            }

            const effectiveUnitPrice = baseUnitPrice + optionAdjustTotal;
            const lineTotal = effectiveUnitPrice * item.quantity;
            item.__effectiveUnitPrice = effectiveUnitPrice.toFixed(2);
            item.__lineTotal = lineTotal.toFixed(2);
            item.__resolvedOptionIds = selectedOptionIds;
            item.__selectedOptionalComponentIds = selectedOptionalComponentIds;

            const noteParts: string[] = [];
            if (item.notes && typeof item.notes === 'string' && item.notes.trim().length) {
                noteParts.push(item.notes.trim());
            }
            if (item.modifications && typeof item.modifications === 'string' && item.modifications.trim().length) {
                noteParts.push(item.modifications.trim());
            }
            if (optionSummaries.length && !(item.modifications && item.modifications.includes('Options:'))) {
                noteParts.push(`Options: ${optionSummaries.join(', ')}`);
            }
            if (optionalSummaries.length && !(item.modifications && item.modifications.includes('Optional:'))) {
                noteParts.push(`Optional: ${optionalSummaries.join(', ')}`);
            }

            item.__compiledModifications = noteParts.length
                ? Array.from(new Set(noteParts)).join(' | ')
                : null;

            subtotal += lineTotal;
        }

        const orderWithNumber = {
            ...orderData,
            orderNumber,
            subtotal: subtotal.toFixed(2),
            tax: '0.00', // Tax-inclusive pricing
            total: subtotal.toFixed(2),
            status: orderData.status || 'pending',
            cashierId: user.id,
            courierId: user.role === 'courier' ? user.id : undefined
        };

        if (orderWithNumber.sentToFulfillment) {
            // Logic for sending to fulfillment, check if user is allowed beyond just general order management
            // We use specific permission check or role check if needed contextually
            // Assuming order:create implies basic rights, but sentToFulfillment might be special
            // Keeping original logic via policy or inline
            if (!AuthPolicy.canAny(user, ['order:manage', 'order:create'])) {
                return res.status(403).json({ message: 'Insufficient permissions to send order to fulfillment' });
            }
        }

        let order;
        try {
            order = await orderService.createOrderTransaction(user.organizationId, orderWithNumber, items, user.id);
        } catch (err) {
            console.error('Order transaction failed:', err);
            if (err && (err as Error).message && (err as Error).message.includes('Insufficient')) {
                return res.status(409).json({ message: (err as Error).message });
            }
            throw err;
        }

        broadcastOrderUpdate(order);
        res.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Failed to create order" });
    }
});

/**
 * PATCH /api/orders/:id
 * Update order status and details
 */
router.patch('/:id', isAuthenticated, checkPermission('order:update'), async (req: any, res) => {
    try {
        const user = req.session.user;
        const { id } = req.params;
        const updateData = req.body;

        // Only allow marking sentToFulfillment by cashier/manager/admin roles
        if (typeof updateData.sentToFulfillment !== 'undefined' && updateData.sentToFulfillment === true) {
            // Using logic: Casher/Manager/Admin have 'order:create' or 'order:manage'. 
            // Technician (order:update) should not trigger this?
            // AuthPolicy check:
            if (!AuthPolicy.canAny(user, ['order:create', 'order:manage'])) {
                return res.status(403).json({ message: 'Insufficient permissions to send order to fulfillment' });
            }
        }

        // Set timestamps based on status changes
        if (updateData.status === 'ready' && !updateData.readyAt) {
            updateData.readyAt = new Date();
        } else if (updateData.status === 'delivered' && !updateData.deliveredAt) {
            updateData.deliveredAt = new Date();
        }

        // Set user assignments based on role and status
        if (updateData.status === 'preparing' && user.role === 'technician') {
            updateData.technicianId = user.id;
        } else if (updateData.status === 'delivered' && user.role === 'courier') {
            updateData.courierId = user.id;
        }

        const order = await orderService.updateOrder(user.organizationId, id, updateData);

        if (typeof updateData.sentToFulfillment !== 'undefined' && updateData.sentToFulfillment === true) {
            try {
                await storage.createActivityLog({
                    userId: user.id,
                    action: 'send_to_fulfillment',
                    success: true,
                    details: { orderId: id },
                });
            } catch (e) {
                console.warn('Failed to create activity log for send_to_fulfillment', e);
            }
        }

        broadcastOrderUpdate(order);
        res.json(order);
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: "Failed to update order" });
    }
});

/**
 * PUT /api/orders/:id
 * Complete update of order and items
 */
router.put('/:id', isAuthenticated, checkPermission('order:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const { order: orderData, items } = req.body;

        // Update the order
        const updatedOrder = await orderService.updateOrder(req.session.user.organizationId, id, orderData);

        // If items are provided, update them too
        if (items && Array.isArray(items)) {
            // Delete existing order items
            await orderService.deleteOrderItems(id);

            // Create new order items
            for (const item of items) {
                await orderService.createOrderItem({
                    orderId: id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    modifications: item.modifications
                });
            }
        }

        broadcastOrderUpdate(updatedOrder);
        res.json(updatedOrder);
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: "Failed to update order" });
    }
});

/**
 * DELETE /api/orders/:id
 * Delete order (Admin/Cashier only)
 */
router.delete('/:id', isAuthenticated, checkPermission('order:delete'), async (req: any, res) => {
    try {
        const user = req.session.user;
        const { id } = req.params;

        await orderService.deleteOrder(user.organizationId, id);

        broadcast({
            type: 'order_deleted',
            orderId: id
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: "Failed to delete order" });
    }
});

/**
 * POST /api/orders/:id/call
 * Notification: Customer called
 */
router.post('/:id/call', isAuthenticated, checkPermission('order:update'), async (req: any, res) => {
    try {
        const { id } = req.params;
        const updateData: any = { calledAt: new Date(), status: 'ready' };
        const updated = await orderService.updateOrder(req.session.user.organizationId, id, updateData);
        broadcastOrderUpdate(updated);
        res.json(updated);
    } catch (error) {
        console.error('Error calling customer for order:', error);
        res.status(500).json({ message: 'Failed to call customer' });
    }
});

// --- Favorites Routes (Still using storage for now) ---

/**
 * GET /api/favorites
 * Get favorite combos
 */
router.get('/favorites', isAuthenticated, checkPermission('product:read'), async (req: any, res) => {
    try {
        const isAdminUser = req.session?.user?.role === 'admin';
        const includeInactive = req.query.includeInactive === 'true' && isAdminUser;
        const combos = await storage.getFavoriteCombos(includeInactive);
        res.json(combos);
    } catch (error) {
        console.error('Error fetching favorite combos:', error);
        res.status(500).json({ message: 'Failed to load favorites' });
    }
});

/**
 * POST /api/favorites
 * Create favorite combo (Admin only)
 */
router.post('/favorites', isAuthenticated, checkPermission('product:manage'), async (req: any, res) => {
    try {
        const payload = favoriteComboCreateSchema.parse(req.body);
        const { items, ...comboData } = payload;
        const combo = await storage.createFavoriteCombo(comboData, items);
        res.status(201).json(combo);
    } catch (error) {
        console.error('Error creating favorite combo:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: error.errors.map((e) => e.message).join(', ') });
        }
        res.status(500).json({ message: (error as Error).message || 'Failed to create favorite combo' });
    }
});

/**
 * PUT /api/favorites/:id
 * Update favorite combo (Admin only)
 */
router.put('/favorites/:id', isAuthenticated, checkPermission('product:manage'), async (req: any, res) => {
    try {
        const payload = favoriteComboUpdateSchema.parse(req.body);
        const { items, ...comboData } = payload;
        const combo = await storage.updateFavoriteCombo(req.params.id, comboData, items);
        res.json(combo);
    } catch (error) {
        console.error('Error updating favorite combo:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: error.errors.map((e) => e.message).join(', ') });
        }
        res.status(500).json({ message: (error as Error).message || 'Failed to update favorite combo' });
    }
});

/**
 * DELETE /api/favorites/:id
 * Delete favorite combo (Admin only)
 */
router.delete('/favorites/:id', isAuthenticated, checkPermission('product:manage'), async (req: any, res) => {
    try {
        await storage.deleteFavoriteCombo(req.params.id);
        res.status(204).end();
    } catch (error) {
        console.error('Error deleting favorite combo:', error);
        res.status(500).json({ message: 'Failed to delete favorite combo' });
    }
});

export default router;
