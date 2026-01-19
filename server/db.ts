import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check if running in Docker or with standard PostgreSQL
const isDocker = process.env.REPLIT_DEPLOYMENT === 'true' || process.env.NODE_ENV === 'production';
const isStandardPostgres = process.env.DATABASE_URL.includes('postgresql://') && !process.env.DATABASE_URL.includes('neon.tech');
const useStandardPostgres = process.env.DATABASE_TYPE === 'postgres' || isDocker || isStandardPostgres;

let pool: any;
let db: any;
let rawClient: any;

if (useStandardPostgres) {
  // Use standard PostgreSQL client for Docker/production
  console.log('🐘 Using standard PostgreSQL connection');
  const client = postgres(process.env.DATABASE_URL, {
    // Reconnection is on by default in postgres.js, but let's log it.
    onnotice: (notice) => console.log('DB WARNING:', notice.message),
    onclose: (connId) => console.log('DB CONNECTION CLOSED:', connId),

    max: 10, // Default pool size
    idle_timeout: 20, // Close idle connections after 20s
    connect_timeout: 10, // Fail content if busy
  });
  rawClient = client;
  db = drizzlePg(client, { schema });
} else {
  // Use Neon serverless for development
  console.log('🌐 Using Neon serverless connection');
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

// Diagnostics: log effective DB and critical schema markers (non-fatal)
(async () => {
  try {
    const url = new URL(process.env.DATABASE_URL!);
    const dbName = url.pathname.replace('/', '') || '(default)';
    const optionFlag = process.env.ENABLE_OPTIONS_SYSTEM;
    let hasOptionGroups = false;
    let hasIsOptional = false;
    if (rawClient) {
      const tables = await rawClient`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`;
      hasOptionGroups = tables.some((t: any) => t.tablename === 'option_groups');
      if (tables.some((t: any) => t.tablename === 'recipe_ingredients')) {
        const cols = await rawClient`SELECT column_name FROM information_schema.columns WHERE table_name='recipe_ingredients'`;
        hasIsOptional = cols.some((c: any) => c.column_name === 'is_optional');
      }
    }
    console.log('[DB-BOOT]', JSON.stringify({ dbName, optionSystemEnabled: optionFlag, hasOptionGroups, recipeHasIsOptional: hasIsOptional }));
  } catch (e) {
    console.warn('[DB-BOOT] diagnostics failed:', (e as Error).message);
  }
})();

export { pool, db, rawClient };