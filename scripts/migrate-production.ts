import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema';
import fs from 'fs';
import path from 'path';
// Use process.cwd() for reliable path resolution in packaged app
const __dirname = path.resolve();

async function runMigrations() {
    console.log('🚀 Starting production migrations (Custom Runner - Postgres)...');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    // Disable prefetch/SSL for internal docker network if needed, but standard URL usually works
    const sqlClient = postgres(databaseUrl, { max: 1 });
    const db = drizzle(sqlClient, { schema });

    try {
        // 1. Create migrations log table if not exists
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migrations_log(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT NOW()
);
`);

        // 2. Read migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            throw new Error(`Migrations directory not found at: ${migrationsDir} `);
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Sort by name (timestamp)

        console.log(`📂 Found ${files.length} migration files in ${migrationsDir} `);

        // 3. Apply migrations
        for (const file of files) {
            // Check if already applied
            const result = await db.execute(sql`SELECT 1 FROM migrations_log WHERE name = ${file} `);
            // serverless-js/drizzle returns array of rows
            // @ts-ignore
            if (result.length > 0) {
                // console.log(`⏭️  Skipping ${ file } (already applied)`);
                continue;
            }

            console.log(`▶️  Applying ${file}...`);
            const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

            // Execute the SQL
            // Using execute directly. Note: neon-http is stateless, transactions might be tricky if multiple statements?
            // Drizzle execute typically runs one statement or block.
            // Postgres.js allows multiple statements. Neon driver? 
            // Safe bet: The files contain multiple statements sometimes.

            try {
                await db.execute(sql.raw(content));

                // Log completion
                await db.execute(sql`INSERT INTO migrations_log(name) VALUES(${file})`);
                console.log(`✅ Applied ${file} `);
            } catch (e) {
                console.error(`❌ Failed to apply ${file}: `, e);
                throw e;
            }
        }

        console.log('🎉 All migrations checked/applied successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration run failed:', err);
        process.exit(1);
    }
}

runMigrations();

