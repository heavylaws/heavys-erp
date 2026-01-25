
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding imageUrl column...");
        await db.execute(sql`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS image_url varchar(500);
    `);
        console.log("Column added successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error adding column:", error);
        process.exit(1);
    }
}

main();
