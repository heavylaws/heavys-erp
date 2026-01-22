
import { db } from "../db";
import { users, type User, type UpsertUser } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export class UserService {
    async getUser(id: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }

    async upsertUser(userData: UpsertUser): Promise<User> {
        const [user] = await db
            .insert(users)
            .values(userData)
            .onConflictDoUpdate({
                target: users.id,
                set: {
                    ...userData,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return user;
    }

    async getAllUsers(): Promise<User[]> {
        return db.select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.username));
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
    }

    async createUser(userData: UpsertUser): Promise<User> {
        const [user] = await db.insert(users).values(userData).returning();
        return user;
    }

    async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
        const [user] = await db
            .update(users)
            .set({ ...userData, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();
        return user;
    }

    async deleteUser(id: string): Promise<void> {
        await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
    }
}

export const userService = new UserService();
