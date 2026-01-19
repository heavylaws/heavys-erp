
import { db } from "./server/db";
import { orders } from "@shared/schema";
import { desc } from "drizzle-orm";

async function checkOrders() {
    const result = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10);
    console.log("Recent Orders:");
    result.forEach(o => {
        console.log(`ID: ${o.id}, CreatedAt: ${o.createdAt?.toISOString()}, Status: ${o.status}, Total: ${o.total}`);
    });
    process.exit(0);
}

checkOrders();
