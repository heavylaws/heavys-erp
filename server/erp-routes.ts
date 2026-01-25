/**
 * ERP Routes Module
 * API endpoints for suppliers, customers, purchase orders, and serial numbers
 */

import { Router } from "express";
import { z } from "zod";
import {
    insertSupplierSchema,
    insertCustomerSchema,
    insertPurchaseOrderSchema,
    insertSerialNumberSchema,
} from "@shared/schema";
import * as erpStorage from "./erp-storage";

const router = Router();

// Auth middleware check helper
const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    next();
};

const requireManagerOrAdmin = (req: any, res: any, next: any) => {
    const user = req.session?.user;
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
};

// ============================================
// Supplier Routes
// ============================================

router.get("/suppliers", requireAuth, async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const suppliers = await erpStorage.getSuppliers(includeInactive);
        res.json(suppliers);
    } catch (error) {
        console.error("Error fetching suppliers:", error);
        res.status(500).json({ message: "Failed to fetch suppliers" });
    }
});

router.get("/suppliers/:id", requireAuth, async (req, res) => {
    try {
        const supplier = await erpStorage.getSupplier(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        res.json(supplier);
    } catch (error) {
        console.error("Error fetching supplier:", error);
        res.status(500).json({ message: "Failed to fetch supplier" });
    }
});

router.post("/suppliers", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const data = insertSupplierSchema.parse(req.body);
        const supplier = await erpStorage.createSupplier(data);
        res.status(201).json(supplier);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error creating supplier:", error);
        res.status(500).json({ message: "Failed to create supplier" });
    }
});

router.put("/suppliers/:id", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const data = insertSupplierSchema.partial().parse(req.body);
        const supplier = await erpStorage.updateSupplier(req.params.id, data);
        res.json(supplier);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error updating supplier:", error);
        res.status(500).json({ message: "Failed to update supplier" });
    }
});

router.delete("/suppliers/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        await erpStorage.deleteSupplier(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting supplier:", error);
        res.status(500).json({ message: "Failed to delete supplier" });
    }
});

// Product-Supplier linking
router.get("/products/:productId/suppliers", requireAuth, async (req, res) => {
    try {
        const suppliers = await erpStorage.getProductSuppliers(req.params.productId);
        res.json(suppliers);
    } catch (error) {
        console.error("Error fetching product suppliers:", error);
        res.status(500).json({ message: "Failed to fetch product suppliers" });
    }
});

router.post("/product-suppliers", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const link = await erpStorage.linkProductSupplier(req.body);
        res.status(201).json(link);
    } catch (error) {
        console.error("Error linking product supplier:", error);
        res.status(500).json({ message: "Failed to link product supplier" });
    }
});

router.delete("/product-suppliers/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        await erpStorage.unlinkProductSupplier(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("Error unlinking product supplier:", error);
        res.status(500).json({ message: "Failed to unlink product supplier" });
    }
});

// ============================================
// Customer Routes
// ============================================

router.get("/customers", requireAuth, async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const customers = await erpStorage.getCustomers(includeInactive);
        res.json(customers);
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Failed to fetch customers" });
    }
});

router.get("/customers/:id", requireAuth, async (req, res) => {
    try {
        const customer = await erpStorage.getCustomer(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        res.json(customer);
    } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ message: "Failed to fetch customer" });
    }
});

router.post("/customers", requireAuth, async (req: any, res) => {
    try {
        const rawData = { ...req.body };
        // Sanitize numeric inputs that might come as empty strings
        if (rawData.creditLimit === "") rawData.creditLimit = null;
        if (rawData.currentBalance === "") rawData.currentBalance = "0";
        if (rawData.discountPercent === "") rawData.discountPercent = "0";

        const data = insertCustomerSchema.parse(rawData);
        const customer = await erpStorage.createCustomer(data);
        res.status(201).json(customer);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error creating customer:", error);
        res.status(500).json({ message: "Failed to create customer" });
    }
});

router.put("/customers/:id", requireAuth, async (req: any, res) => {
    try {
        const rawData = { ...req.body };
        // Sanitize numeric inputs that might come as empty strings
        if (rawData.creditLimit === "") rawData.creditLimit = null;
        if (rawData.currentBalance === "") rawData.currentBalance = "0";
        if (rawData.discountPercent === "") rawData.discountPercent = "0";

        const data = insertCustomerSchema.partial().parse(rawData);
        const customer = await erpStorage.updateCustomer(req.params.id, data);
        res.json(customer);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error updating customer:", error);
        res.status(500).json({ message: "Failed to update customer" });
    }
});

router.delete("/customers/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        await erpStorage.deleteCustomer(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).json({ message: "Failed to delete customer" });
    }
});

// ============================================
// Purchase Order Routes
// ============================================

router.get("/purchase-orders", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        const status = req.query.status as string | undefined;
        const orders = await erpStorage.getPurchaseOrders(status);
        res.json(orders);
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
});

router.get("/purchase-orders/next-number", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        const orderNumber = await erpStorage.getNextPurchaseOrderNumber();
        res.json({ orderNumber });
    } catch (error) {
        console.error("Error getting next PO number:", error);
        res.status(500).json({ message: "Failed to get next PO number" });
    }
});

router.get("/purchase-orders/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        const order = await erpStorage.getPurchaseOrder(req.params.id);
        if (!order) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        res.json(order);
    } catch (error) {
        console.error("Error fetching purchase order:", error);
        res.status(500).json({ message: "Failed to fetch purchase order" });
    }
});

const createPurchaseOrderSchema = z.object({
    supplierId: z.string().min(1),
    expectedDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        unitCost: z.string(),
    })).min(1),
});

router.post("/purchase-orders", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const { items, ...orderData } = createPurchaseOrderSchema.parse(req.body);
        const orderNumber = await erpStorage.getNextPurchaseOrderNumber();

        const order = await erpStorage.createPurchaseOrder({
            ...orderData,
            orderNumber,
            createdBy: req.session.user.id,
            expectedDate: orderData.expectedDate ? new Date(orderData.expectedDate) : undefined,
        }, items);

        res.status(201).json(order);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error creating purchase order:", error);
        res.status(500).json({ message: "Failed to create purchase order" });
    }
});

router.put("/purchase-orders/:id", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const data = insertPurchaseOrderSchema.partial().parse(req.body);
        const order = await erpStorage.updatePurchaseOrder(req.params.id, data);
        res.json(order);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error updating purchase order:", error);
        res.status(500).json({ message: "Failed to update purchase order" });
    }
});

const receiveItemsSchema = z.object({
    items: z.array(z.object({
        itemId: z.string().min(1),
        receivedQuantity: z.number().int().min(1),
        serialNumbers: z.array(z.string()).optional(),
    })).min(1),
});

router.post("/purchase-orders/:id/receive", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const { items } = receiveItemsSchema.parse(req.body);
        await erpStorage.receivePurchaseOrderItems(req.params.id, items, req.session.user.id);
        const order = await erpStorage.getPurchaseOrder(req.params.id);
        res.json(order);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error receiving items:", error);
        res.status(500).json({ message: "Failed to receive items" });
    }
});

router.delete("/purchase-orders/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
        await erpStorage.deletePurchaseOrder(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting purchase order:", error);
        res.status(500).json({ message: error.message || "Failed to delete purchase order" });
    }
});

// ============================================
// Serial Number Routes
// ============================================

router.get("/serial-numbers", requireAuth, async (req, res) => {
    try {
        const productId = req.query.productId as string | undefined;
        const status = req.query.status as string | undefined;
        const serialNumbers = await erpStorage.getSerialNumbers(productId, status);
        res.json(serialNumbers);
    } catch (error) {
        console.error("Error fetching serial numbers:", error);
        res.status(500).json({ message: "Failed to fetch serial numbers" });
    }
});

router.get("/serial-numbers/lookup/:code", requireAuth, async (req, res) => {
    try {
        const sn = await erpStorage.getSerialNumberByCode(req.params.code);
        if (!sn) {
            return res.status(404).json({ message: "Serial number not found" });
        }
        res.json(sn);
    } catch (error) {
        console.error("Error looking up serial number:", error);
        res.status(500).json({ message: "Failed to lookup serial number" });
    }
});

router.get("/products/:productId/serial-numbers", requireAuth, async (req, res) => {
    try {
        const available = req.query.available === 'true';
        if (available) {
            const serialNumbers = await erpStorage.getAvailableSerialNumbers(req.params.productId);
            return res.json(serialNumbers);
        }
        const serialNumbers = await erpStorage.getSerialNumbers(req.params.productId);
        res.json(serialNumbers);
    } catch (error) {
        console.error("Error fetching product serial numbers:", error);
        res.status(500).json({ message: "Failed to fetch product serial numbers" });
    }
});

router.post("/serial-numbers", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const data = insertSerialNumberSchema.parse(req.body);
        const sn = await erpStorage.createSerialNumber(data);
        res.status(201).json(sn);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error creating serial number:", error);
        res.status(500).json({ message: "Failed to create serial number" });
    }
});

router.put("/serial-numbers/:id", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
    try {
        const data = insertSerialNumberSchema.partial().parse(req.body);
        const sn = await erpStorage.updateSerialNumber(req.params.id, data);
        res.json(sn);
    } catch (error: any) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Error updating serial number:", error);
        res.status(500).json({ message: "Failed to update serial number" });
    }
});

router.post("/serial-numbers/:id/assign", requireAuth, async (req: any, res) => {
    try {
        const { orderId, customerId } = req.body;
        if (!orderId) {
            return res.status(400).json({ message: "Order ID is required" });
        }
        const sn = await erpStorage.assignSerialNumberToOrder(req.params.id, orderId, customerId);
        res.json(sn);
    } catch (error) {
        console.error("Error assigning serial number:", error);
        res.status(500).json({ message: "Failed to assign serial number" });
    }
});

export default router;
