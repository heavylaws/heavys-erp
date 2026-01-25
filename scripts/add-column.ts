
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding requires_fulfillment column...");
        await db.execute(sql`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS requires_fulfillment boolean NOT NULL DEFAULT false;
    `);
        console.log("Column added successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error adding column:", error);
        process.exit(1);
    }
}

main();
