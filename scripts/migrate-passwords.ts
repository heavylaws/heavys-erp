
import { db } from '../server/db';
import { users } from '../shared/schema';
import { hashPassword } from '../server/password-utils';
import { eq } from 'drizzle-orm';

async function migratePasswords() {
    console.log('Starting password migration...');

    try {
        const allUsers = await db.select().from(users);
        let updatedCount = 0;

        for (const user of allUsers) {
            // Check if password is already hashed (bcrypt hashes start with $2a$ or similar)
            if (!user.password.startsWith('$2')) {
                console.log(`Migrating password for user: ${user.username}`);
                const hashedPassword = await hashPassword(user.password);

                await db.update(users)
                    .set({ password: hashedPassword })
                    .where(eq(users.id, user.id));

                updatedCount++;
            } else {
                // console.log(`User ${user.username} already has hashed password.`);
            }
        }

        console.log(`Migration completed. Updated ${updatedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migratePasswords();
