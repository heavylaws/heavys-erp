
import { db, pool } from '../server/db';
import * as schema from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';
import { organizations } from '../shared/schema';

// Tables that need organizationId backfilled
// We can find them by looking at schema keys that have organizationId
const TABLES_WITH_ORG_ID: (keyof typeof schema)[] = [
    'users',
    'categories',
    'products',
    'favoriteCombos',
    'receiptSettings',
    'ingredients',
    'orders',
    'inventoryLog',
    'activityLog',
    'performanceMetrics',
    'achievements',
    'monthlyLeaderboard',
    'shifts',
    'currencyRates',
    'optionGroups',
    'suppliers',
    'customers',
    'purchaseOrders',
    'companySettings',
] as any; // Cast as any to avoid strict type checking on keys initially

async function main() {
    console.log('🚀 Starting Multi-tenancy Migration...');

    try {
        // 1. Create Default Organization if it doesn't exist
        const slug = 'default-org';
        let defaultOrg = await db.query.organizations.findFirst({
            where: eq(schema.organizations.slug, slug)
        });

        if (!defaultOrg) {
            console.log('📦 Creating Default Organization...');
            const [newOrg] = await db.insert(schema.organizations).values({
                name: 'Default Organization',
                slug: slug,
            }).returning();
            defaultOrg = newOrg;
            console.log(`✅ Default Org created with ID: ${defaultOrg.id}`);
        } else {
            console.log(`ℹ️ Default Org found: ${defaultOrg.id}`);
        }

        const orgId = defaultOrg.id;

        // 2. Iterate tables and update rows where organizationId is NULL
        for (const tableName of TABLES_WITH_ORG_ID) {
            const table = schema[tableName];
            if (!table) {
                console.warn(`⚠️ Table ${String(tableName)} not exported in schema`);
                continue;
            }

            // Check if organizationId column exists on the object (runtime check mostly for safety)
            // In Drizzle table objects, columns are properties.
            if (!('organizationId' in table)) {
                console.warn(`⚠️ Table ${String(tableName)} does not have organizationId column in definition`);
                continue;
            }

            console.log(`🔄 Migrating ${String(tableName)}...`);

            // Update all rows where organizationId is null
            const result = await db.update(table)
                .set({ organizationId: orgId })
                .where(isNull(table.organizationId));

            // Drizzle update result doesn't reliably give row count in all drivers, but let's try
            console.log(`   -> Updated rows in ${String(tableName)}`);
        }

        console.log('✅ Migration to Multi-tenancy complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

main();
