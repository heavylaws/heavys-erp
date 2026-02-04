
import { receiptPrinter } from '../server/printer';

const arabicReceipt = {
    storeName: "مطعم هيفي",
    address: "شارع البرغر، وسط المدينة",
    phone: "(555) 123-4567",
    orderId: "ORDER-AR-001",
    items: [
        { name: "شاورما دجاج", quantity: 2, price: 5.00, total: 10.00 },
        { name: "فلافل", quantity: 1, price: 3.00, total: 3.00 },
        { name: "بيبسي", quantity: 3, price: 1.00, total: 3.00 }
    ],
    subtotal: 16.00,
    total: 16.00,
    paymentMethod: "CASH",
    timestamp: new Date(),
    footerText: "شكرا لزيارتكم!"
};

console.log("------------------------------------------");
console.log("Testing Arabic Bitmap Print");
console.log("------------------------------------------");

receiptPrinter.printReceipt(arabicReceipt)
    .then(() => {
        console.log("\n✅ SUCCESS: Bitmap print job sent.");
    })
    .catch((err) => {
        console.error("\n❌ FAILED: Could not print.");
        console.error(err);
        process.exit(1);
    });
