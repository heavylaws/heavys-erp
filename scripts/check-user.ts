
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
    console.log("Checking manager user...");
    const [user] = await db.select().from(users).where(eq(users.username, 'manager'));

    if (!user) {
        console.log("User 'manager' not found!");
    } else {
        console.log("User found:");
        console.log("ID:", user.id);
        console.log("Username:", user.username);
        console.log("Role:", user.role);
        console.log("OrganizationId:", user.organizationId);
        console.log("IsActive:", user.isActive);
        console.log("Password (start):", user.password.substring(0, 10) + "...");
        console.log("Password length:", user.password.length);
    }
    process.exit(0);
}

checkUser().catch(console.error);
