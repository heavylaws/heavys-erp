
import { db } from "../server/db";
import { products, categories, suppliers } from "../shared/schema";
import { eq } from "drizzle-orm";

async function seedProducts() {
    console.log("Seeding products...");

    // 1. Create Categories
    const cats = [
        { name: "Furniture", description: "Office and Home Furniture" },
        { name: "Electronics", description: "Gadgets and Devices" },
        { name: "Accessories", description: "Small add-ons" }
    ];

    const catIds = [];
    for (const c of cats) {
        const [existing] = await db.select().from(categories).where(eq(categories.name, c.name));
        if (existing) {
            catIds.push(existing.id);
        } else {
            const [newCat] = await db.insert(categories).values(c).returning();
            catIds.push(newCat.id);
        }
    }

    // 2. Create Products
    const prods = [
        {
            name: "Glass Dining Table",
            description: "Premium tempered glass table with oak legs",
            price: "299.99",
            stockQuantity: "15",
            minThreshold: 5,
            categoryId: catIds[0],
            sku: "FURN-GT-001",
            type: "finished_good"
        },
        {
            name: "Ergonomic Mesh Chair",
            description: "High-back office chair with lumbar support",
            price: "159.50",
            stockQuantity: "3", // Low stock
            minThreshold: 5,
            categoryId: catIds[0],
            sku: "FURN-EC-002",
            type: "finished_good"
        },
        {
            name: "Wireless Mechanical Keyboard",
            description: "RGB Backlit, Blue Switches",
            price: "89.99",
            stockQuantity: "50",
            minThreshold: 10,
            categoryId: catIds[1],
            sku: "ELEC-KB-001",
            type: "finished_good"
        },
        {
            name: "USB-C Hub",
            description: "7-in-1 Multiport Adapter",
            price: "34.50",
            stockQuantity: "0", // Out of stock
            minThreshold: 10,
            categoryId: catIds[2],
            sku: "ACC-HUB-001",
            type: "finished_good"
        }
    ];

    for (const p of prods) {
        // @ts-ignore
        await db.insert(products).values(p).onConflictDoNothing(); // Basic conflict avoidance
    }

    console.log("Seeding complete!");
    process.exit(0);
}

seedProducts().catch(console.error);
