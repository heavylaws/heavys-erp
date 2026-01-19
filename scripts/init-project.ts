#!/usr/bin/env tsx
/**
 * Highway Cafe POS - Project Initialization Script
 * This script ensures the project runs correctly when downloaded
 * It sets up the database, creates demo data, and initializes all systems
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import postgres from 'postgres';
import ws from "ws";
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema.js';
import { hash } from 'crypto';

async function initializeProject() {
  console.log('🏪 Highway Cafe POS - Project Initialization');
  console.log('===========================================');
  
  // Check environment
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
    console.log('📡 Testing database connection...');
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection successful');

    // Check if demo data exists
    console.log('🔍 Checking for existing data...');
    const existingUsers = await db.select().from(schema.users).limit(1);
    
    if (existingUsers.length === 0) {
      console.log('📝 Creating demo users...');
      
      // Create demo users with simple password hashing
      const users = [
        {
          id: 'admin-user-1',
          username: 'admin',
          password: 'admin123', // In production, this should be properly hashed
          email: 'admin@highway-cafe.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin' as const,
        },
        {
          id: 'manager-user-1',
          username: 'manager',
          password: 'manager123',
          email: 'manager@highway-cafe.com',
          firstName: 'Manager',
          lastName: 'User',
          role: 'manager' as const,
        },
        {
          id: 'cashier-user-1',
          username: 'cashier',
          password: 'cashier123',
          email: 'cashier@highway-cafe.com',
          firstName: 'Cashier',
          lastName: 'User',
          role: 'cashier' as const,
        }
      ];

      for (const user of users) {
        await db.insert(schema.users).values(user);
      }
      console.log('✅ Demo users created');
    }

    // Check for currency rates
    console.log('🔍 Checking currency rates...');
    const existingRates = await db.select().from(schema.currencyRates).limit(1);
    
    if (existingRates.length === 0) {
      console.log('💱 Creating default currency rate (USD to LBP)...');
      
  await db.insert(schema.currencyRates).values({
        fromCurrency: 'USD',
        toCurrency: 'LBP',
        rate: '89500.000000', // Default rate as of 2024
        updatedBy: 'admin-user-1',
      });
      console.log('✅ Default currency rate created');
    }

    // Test basic functionality
    console.log('🧪 Testing basic functionality...');
    const userCount = await db.select({ count: sql`count(*)` }).from(schema.users);
    const rateCount = await db.select({ count: sql`count(*)` }).from(schema.currencyRates);
    
    console.log(`📊 Database status:`);
    console.log(`   Users: ${userCount[0]?.count || 0}`);
    console.log(`   Currency rates: ${rateCount[0]?.count || 0}`);

    console.log('✅ Project initialization completed successfully');
    console.log('');
    console.log('🎯 Your Highway Cafe POS is ready to use!');
    console.log('   Access: http://localhost:5000');
    console.log('   Admin:  admin / admin123');
    console.log('   Manager: manager / manager123');
    console.log('   Cashier: cashier / cashier123');

  } catch (error) {
    console.error('❌ Project initialization failed:', error);
    throw error;
  } finally {
    if (client && typeof client.end === 'function') {
      await client.end();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeProject()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Initialization failed:', error);
      process.exit(1);
    });
}

export { initializeProject };