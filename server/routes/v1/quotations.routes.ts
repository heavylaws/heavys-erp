import { Router } from "express";
import { quotationService } from "../../services/quotation.service";
import { isAuthenticated } from "../../auth-middleware";

const router = Router();

// Get all quotes
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const user = req.user as any;
        const quotes = await quotationService.getQuotes(user.organizationId);
        res.json(quotes);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Create quote
router.post("/", isAuthenticated, async (req, res) => {
    try {
        const user = req.user as any;
        const data = { ...req.body, organizationId: user.organizationId };
        const quote = await quotationService.createQuote(data);
        res.status(201).json(quote);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get quote by ID
router.get("/:id", isAuthenticated, async (req, res) => {
    try {
        const quote = await quotationService.getQuoteById(req.params.id);
        if (!quote) return res.status(404).json({ message: "Quote not found" });
        res.json(quote);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Update quote status
router.put("/:id/status", isAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await quotationService.updateQuoteStatus(req.params.id, status);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Delete quote
router.delete("/:id", isAuthenticated, async (req, res) => {
    try {
        await quotationService.deleteQuote(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Convert to Order
router.post("/:id/convert", isAuthenticated, async (req, res) => {
    try {
        const user = req.user as any;
        const order = await quotationService.convertToOrder(req.params.id, user.id);
        res.json(order);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

export default router;
