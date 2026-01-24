
import { db } from "../server/db";
import { users, organizations } from "../shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/password-utils";

async function fixManager() {
    console.log("Fixing manager user...");

    // 1. Get Default Organization
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
        console.error("No organization found! Cannot fix manager.");
        process.exit(1);
    }
    console.log("Found Organization:", org.name, org.id);

    // 2. Hash password 'manager123' to be sure
    const newHash = await hashPassword('manager123');

    // 3. Update Manager
    await db.update(users)
        .set({
            organizationId: org.id,
            password: newHash
        })
        .where(eq(users.username, 'manager'));

    console.log("Manager user updated with Organization ID and reset password.");
    process.exit(0);
}

fixManager().catch(console.error);
