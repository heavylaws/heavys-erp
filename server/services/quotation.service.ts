import { db } from "../db";
import { quotes, quoteItems, orders, orderItems, products } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class QuotationService {
    async createQuote(data: any) {
        console.log("Creating quote with data:", JSON.stringify(data, null, 2));
        try {
            // 1. Create Quote Header
            const [newQuote] = await db.insert(quotes).values({
                organizationId: data.organizationId,
                customerId: data.customerId || null,
                customerName: data.customerName || null,
                totalAmount: data.totalAmount,
                status: "draft",
                validUntil: data.validUntil ? new Date(data.validUntil) : null,
                notes: data.notes,
            }).returning();
            console.log("Quote header created:", newQuote.id);

            // 2. Create Quote Items
            if (data.items && data.items.length > 0) {
                console.log("Inserting items:", data.items.length);
                const itemsToInsert = data.items.map((item: any) => ({
                    quoteId: newQuote.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    priceAtQuote: item.priceAtQuote,
                }));
                await db.insert(quoteItems).values(itemsToInsert);
            }

            return this.getQuoteById(newQuote.id);
        } catch (e: any) {
            console.error("Error creating quote:", e);
            throw e;
        }
    }

    async getQuotes(organizationId: string) {
        return await db.query.quotes.findMany({
            where: eq(quotes.organizationId, organizationId),
            orderBy: [desc(quotes.createdAt)],
            with: {
                customer: true,
                items: {
                    with: {
                        product: true
                    }
                }
            }
        });
    }

    async getQuoteById(id: string) {
        return await db.query.quotes.findFirst({
            where: eq(quotes.id, id),
            with: {
                customer: true,
                items: {
                    with: {
                        product: true
                    }
                }
            }
        });
    }

    async updateQuoteStatus(id: string, status: string) {
        const [updated] = await db.update(quotes)
            .set({ status, updatedAt: new Date() })
            .where(eq(quotes.id, id))
            .returning();
        return updated;
    }

    async deleteQuote(id: string) {
        await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
        await db.delete(quotes).where(eq(quotes.id, id));
        return true;
    }

    // Convert Quote to Order
    async convertToOrder(quoteId: string, userId: string) {
        const quote = await this.getQuoteById(quoteId);
        if (!quote) throw new Error("Quote not found");
        if (quote.status === 'converted') throw new Error("Quote already converted");

        // 1. Create Order
        const [newOrder] = await db.insert(orders).values({
            organizationId: quote.organizationId,
            customerId: quote.customerId,
            status: "pending",
            orderNumber: Math.floor(Date.now() / 1000), // Check if orderNumber is auto-inc? Schema says integer not null. I need to generate it.
            paymentStatus: "unpaid",
            subtotal: quote.totalAmount, // Assuming no tax for now or included
            tax: "0",
            total: quote.totalAmount,
            cashierId: userId, // The user performing the conversion
            customerName: quote.customerName || (quote.customer ? `${quote.customer.firstName} ${quote.customer.lastName}` : "Guest"),
        }).returning();

        // 2. Create Order Items
        for (const item of quote.items) {
            await db.insert(orderItems).values({
                orderId: newOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.priceAtQuote,
                total: (Number(item.quantity) * Number(item.priceAtQuote)).toString(),
            });
            // Stock deduction logic should be here or handled by trigger/service
        }

        // 3. Update Quote Status
        await this.updateQuoteStatus(quoteId, "converted");

        return newOrder;
    }
}

export const quotationService = new QuotationService();
