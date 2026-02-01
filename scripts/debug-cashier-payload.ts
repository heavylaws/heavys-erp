
import { receiptPrinter } from '../server/printer';

// Payload structure exactly as seen in cashier.tsx
const cashierPayload = {
    storeName: "Highway Cafe",
    address: "123 Test St",
    phone: "555-0000",
    orderId: "PREVIEW-TEST-123",
    timestamp: new Date(),
    items: [
        {
            name: "Test Burger",
            quantity: 2,
            total: 20.00
            // NOTE: price is missing, just like in cashier.tsx
        }
    ],
    subtotal: 20.00,
    tax: 0,
    total: 20.00,
    paymentMethod: "CASH",
    cashReceived: 0,
    change: 0
};

console.log("------------------------------------------");
console.log("Testing Cashier Payload (Missing 'price' field)");
console.log("------------------------------------------");

// @ts-ignore - Verification if missing property causes runtime error
receiptPrinter.printReceipt(cashierPayload)
    .then(() => {
        console.log("\n✅ SUCCESS: Payload accepted and printed.");
    })
    .catch((err) => {
        console.error("\n❌ FAILED: Payload rejected.");
        console.error(err);
    });
