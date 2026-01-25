
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Starting safe migration...");

    try {
        // Helper to get query result safely for both Postgres.js and Neon
        const getResult = (res: any) => {
            if (res.rows) return res.rows[0]; // pg or similar
            if (Array.isArray(res)) return res[0]; // postgres.js
            return res; // Fallback
        };

        // 1. Rename 'ingredients' -> 'components'
        const ingredientsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ingredients'
      );
    `);

        if (getResult(ingredientsExists)?.exists) {
            console.log("Renaming 'ingredients' table to 'components'...");
            await db.execute(sql`ALTER TABLE ingredients RENAME TO components`);
        } else {
            console.log("'ingredients' table not found (might already be renamed).");
        }

        // 2. Rename 'recipeIngredients'/'recipe_ingredients' -> 'product_components'
        // Check known potential names
        const recipeIngredientsSnake = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'recipe_ingredients'
      );
    `);

        if (getResult(recipeIngredientsSnake)?.exists) {
            console.log("Renaming 'recipe_ingredients' table to 'product_components'...");
            await db.execute(sql`ALTER TABLE recipe_ingredients RENAME TO product_components`);
        }

        // 3. Rename columns in 'orders'
        // barista_id -> technician_id
        const baristaIdExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'barista_id'
      );
    `);

        if (getResult(baristaIdExists)?.exists) {
            console.log("Renaming 'barista_id' column to 'technician_id' in 'orders'...");
            await db.execute(sql`ALTER TABLE orders RENAME COLUMN barista_id TO technician_id`);
        }

        // sent_to_barista -> sent_to_fulfillment
        const sentToBaristaExists = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name = 'sent_to_barista'
        );
    `);

        if (getResult(sentToBaristaExists)?.exists) {
            console.log("Renaming 'sent_to_barista' column to 'sent_to_fulfillment' in 'orders'...");
            await db.execute(sql`ALTER TABLE orders RENAME COLUMN sent_to_barista TO sent_to_fulfillment`);
        }

        // 4. Update Enums (product_type)
        // Add 'component_based' if not exists
        try {
            await db.execute(sql`ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'component_based'`);
            console.log("Added 'component_based' to product_type enum.");
        } catch (e) {
            console.log("Note: Could not add 'component_based' to enum (might already exist or not supported in this context).");
        }

        // Migrate 'ingredient_based' products to 'component_based'
        console.log("Migrating 'ingredient_based' products to 'component_based'...");
        await db.execute(sql`
        UPDATE products 
        SET type = 'component_based' 
        WHERE type::text = 'ingredient_based'
    `);

        // 5. Products table: unique columns? 'for_barista' -> 'requires_fulfillment'
        const forBaristaExists = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'for_barista'
        );
    `);

        if (getResult(forBaristaExists)?.exists) {
            console.log("Renaming 'for_barista' column to 'requires_fulfillment' in 'products'...");
            await db.execute(sql`ALTER TABLE products RENAME COLUMN for_barista TO requires_fulfillment`);
        }

        console.log("Migration check complete.");
        process.exit(0);

    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

main();
