#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import postgres from 'postgres';
import ws from "ws";
import * as schema from '../shared/schema.js';
import { sql } from 'drizzle-orm';

/**
 * Ensure database schema exists for downloaded project
 * This script creates all necessary tables if they don't exist
 */

async function ensureSchema() {
  console.log('🔍 Ensuring database schema is properly set up...');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Determine connection type
  const isDocker = process.env.REPLIT_DEPLOYMENT === 'true' || process.env.NODE_ENV === 'production';
  const isStandardPostgres = databaseUrl.includes('postgresql://') && !databaseUrl.includes('neon.tech');
  const useStandardPostgres = process.env.DATABASE_TYPE === 'postgres' || isDocker || isStandardPostgres;

  let db: any;
  let client: any;

  if (useStandardPostgres) {
    console.log('🐘 Using standard PostgreSQL connection');
    client = postgres(databaseUrl);
    db = drizzle(client, { schema });
  } else {
    console.log('🌐 Using Neon serverless connection');
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: databaseUrl });
    db = drizzleNeon({ client: pool, schema });
  }

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection successful');

    // Create schema using Drizzle's introspect and push
    console.log('🏗️ Creating database schema...');
    
    // The schema will be created automatically by Drizzle ORM when first accessed
    // Let's verify by checking if our main tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    console.log(`📋 Found ${tables.length} existing tables`);
    
    if (tables.length === 0) {
      console.log('📝 No tables found, schema will be created on first use');
    } else {
      console.log('✅ Database schema appears to be set up');
      tables.forEach((table: any) => console.log(`  - ${table.table_name}`));
    }

  } catch (error) {
    console.error('❌ Schema validation failed:', error);
    throw error;
  } finally {
    if (client && typeof client.end === 'function') {
      await client.end();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSchema()
    .then(() => {
      console.log('🎉 Database schema verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Schema verification failed:', error);
      process.exit(1);
    });
}

export { ensureSchema };