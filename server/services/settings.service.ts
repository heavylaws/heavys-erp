
import { db } from "../db";
import {
    companySettings, receiptSettings,
    type CompanySettings, type InsertCompanySettings,
    type ReceiptSettings, type InsertReceiptSettings
} from "@shared/schema";
import { eq } from "drizzle-orm";

export class SettingsService {
    // Company Settings
    async getCompanySettings(organizationId: string): Promise<CompanySettings | undefined> {
        const [settings] = await db.select().from(companySettings).where(eq(companySettings.organizationId, organizationId));
        return settings;
    }

    async updateCompanySettings(organizationId: string, settings: InsertCompanySettings): Promise<CompanySettings> {
        const [existing] = await db.select().from(companySettings).where(eq(companySettings.organizationId, organizationId));

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
                .values({ ...settings, organizationId })
                .returning();
            return created;
        }
    }

    // Receipt Settings
    async getReceiptSettings(organizationId: string): Promise<ReceiptSettings | undefined> {
        const [settings] = await db.select().from(receiptSettings).where(eq(receiptSettings.organizationId, organizationId));
        return settings;
    }

    async updateReceiptSettings(organizationId: string, settings: InsertReceiptSettings): Promise<ReceiptSettings> {
        const [existing] = await db.select().from(receiptSettings).where(eq(receiptSettings.organizationId, organizationId));

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
                .values({ ...settings, organizationId })
                .returning();
            return created;
        }
    }
}

export const settingsService = new SettingsService();
