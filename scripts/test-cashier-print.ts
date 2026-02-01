
import { receiptPrinter } from '../server/printer';

// Sample data mimicking a real cashier order
const sampleReceipt = {
    storeName: "Heavy's Grill & Chill",
    address: "123 Heavy St, Burger Town",
    phone: "(555) 123-4567",
    orderId: "ORDER-" + Math.floor(Math.random() * 10000),
    items: [
        { name: "Classic Burger", quantity: 2, price: 12.50, total: 25.00 },
        { name: "Lg Fries", quantity: 1, price: 4.00, total: 4.00 },
        { name: "Cola", quantity: 2, price: 2.50, total: 5.00 },
        { name: "Milkshake", quantity: 1, price: 6.00, total: 6.00 }
    ],
    subtotal: 40.00,
    tax: 4.00,
    total: 44.00,
    paymentMethod: "CASH",
    cashReceived: 50.00,
    change: 6.00,
    timestamp: new Date(),
    footerText: "Thanks for visiting Heavy's! Come back soon."
};

console.log("------------------------------------------");
console.log("Testing Cashier Order Print");
console.log("------------------------------------------");
console.log("Target Printer: Printer-POS-80-Raw (via lp)");
console.log("Order Data:", JSON.stringify(sampleReceipt, null, 2));

receiptPrinter.printReceipt(sampleReceipt)
    .then(() => {
        console.log("\n✅ SUCCESS: Print job sent to queue.");
    })
    .catch((err) => {
        console.error("\n❌ FAILED: Could not print.");
        console.error(err);
        process.exit(1);
    });
