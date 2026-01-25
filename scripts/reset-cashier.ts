
import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🔄 Checking 'cashier' user...");

    const [existing] = await db.select().from(users).where(eq(users.username, "cashier"));

    if (existing) {
        console.log(`👤 Found user 'cashier' (ID: ${existing.id})`);
        console.log("🔑 Resetting password to 'cashier123'...");

        await db.update(users)
            .set({
                password: "cashier123",
                isActive: true,
                updatedAt: new Date()
            })
            .where(eq(users.username, "cashier"));

        console.log("✅ Password reset successfully.");
    } else {
        console.log("⚠️ User 'cashier' not found. Creating it...");

        await db.insert(users).values({
            username: "cashier",
            password: "cashier123",
            email: "cashier@highway-cafe.com",
            firstName: "Cashier",
            lastName: "User",
            role: "cashier",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log("✅ User 'cashier' created with password 'cashier123'.");
    }

    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
