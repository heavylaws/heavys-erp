
import { db } from "../db";
import {
    companySettings, receiptSettings,
    type CompanySettings, type InsertCompanySettings,
    type ReceiptSettings, type InsertReceiptSettings
} from "@shared/schema";
import { eq } from "drizzle-orm";

export class SettingsService {
    // Company Settings
    async getCompanySettings(): Promise<CompanySettings | undefined> {
        const [settings] = await db.select().from(companySettings).limit(1);
        return settings;
    }

    async updateCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings> {
        const [existing] = await db.select().from(companySettings).limit(1);

        if (existing) {
            const [updated] = await db
                .update(companySettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(companySettings.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db
                .insert(companySettings)
                .values(settings)
                .returning();
            return created;
        }
    }

    // Receipt Settings
    async getReceiptSettings(): Promise<ReceiptSettings | undefined> {
        const [settings] = await db.select().from(receiptSettings).limit(1);
        return settings;
    }

    async updateReceiptSettings(settings: InsertReceiptSettings): Promise<ReceiptSettings> {
        const [existing] = await db.select().from(receiptSettings).limit(1);

        if (existing) {
            const [updated] = await db
                .update(receiptSettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(receiptSettings.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db
                .insert(receiptSettings)
                .values(settings)
                .returning();
            return created;
        }
    }
}

export const settingsService = new SettingsService();
