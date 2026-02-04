
import { receiptPrinter } from '../server/printer';

const discountReceipt = {
    storeName: "Heavy's Grill",
    orderId: "TEST-DISCOUNT",
    timestamp: new Date(),
    items: [
        { name: "Burger Combo", quantity: 2, price: 10, total: 20 },
    ],
    subtotal: 20,
    discount: 5,
    total: 15,
    paymentMethod: "CASH",
    footerText: "Discount Test Receipt"
};

console.log("------------------------------------------");
console.log("Testing Discount Receipt Print");
console.log("------------------------------------------");

receiptPrinter.printReceipt(discountReceipt)
    .then(() => {
        console.log("\n✅ SUCCESS: Print job sent.");
    })
    .catch((err) => {
        console.error("\n❌ FAILED: Could not print.");
        console.error(err);
        process.exit(1);
    });
