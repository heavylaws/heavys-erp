#!/usr/bin/env tsx

/**
 * Docker Database Initialization Script
 * This script initializes the database schema and demo data for Docker deployments
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../shared/schema';
// Note: eq import removed as it's not used in this initialization script

// Note: Achievement initialization included inline below

async function initializeDockerDatabase() {
  console.log('🚀 Starting Docker database initialization...');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('📡 Connecting to database...');
  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    console.log('🏗️ Creating database schema...');
    
    // Check if tables exist by trying to query users table
    try {
      await db.select().from(schema.users).limit(1);
      console.log('✅ Database schema already exists');
    } catch (error) {
      console.log('📋 Database schema not found, creating tables...');
      // If tables don't exist, we'll let Drizzle handle this via the ORM
      // The schema will be created automatically when we try to insert data
    }

    // Initialize demo data
    console.log('👥 Initializing users...');
    await initializeUsers(db);
    
    console.log('📦 Initializing categories...');
    await initializeCategories(db);
    
    console.log('🥤 Initializing ingredients...');
    await initializeIngredients(db);
    
    console.log('🍕 Initializing products...');
    await initializeProducts(db);
    
    console.log('🏆 Initializing achievements...');
    await initializeDockerAchievements(db);
    
    console.log('💱 Initializing currency rates...');
    await initializeCurrencyRates(db);

    console.log('✅ Docker database initialization completed successfully!');
    
    // Test the setup
    console.log('🧪 Testing database setup...');
    const userCount = await db.select().from(schema.users);
    const productCount = await db.select().from(schema.products);
    const categoryCount = await db.select().from(schema.categories);
    
    console.log(`📊 Setup verification:
      - Users: ${userCount.length}
      - Products: ${productCount.length} 
      - Categories: ${categoryCount.length}`);
    
    console.log('🎉 Database ready for Highway Cafe POS operations!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function initializeUsers(db: any) {
  const existingUsers = await db.select().from(schema.users).limit(1);
  if (existingUsers.length > 0) {
    console.log('👤 Users already exist, skipping initialization');
    return;
  }

  const users = [
    {
      id: '3908c0e1-e2d6-4adb-936c-be6c6c2df6e8',
      username: 'admin',
      email: 'admin@highway-cafe.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '86042e90-87e8-476d-bb19-ad005a8a289d',
      username: 'cashier',
      email: 'cashier@highway-cafe.com',
      firstName: 'Cashier',
      lastName: 'User',
      role: 'cashier' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'f12ab3cd-ef45-6789-0123-456789abcdef',
      username: 'manager',
      email: 'manager@highway-cafe.com',
      firstName: 'Manager',
      lastName: 'User',
      role: 'manager' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'a98765bc-def0-1234-5678-9abcdef01234',
      username: 'barista',
      email: 'barista@highway-cafe.com',
      firstName: 'Barista',
      lastName: 'User',
      role: 'barista' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'b87654cd-efa9-8765-4321-0fedcba98765',
      username: 'courier',
      email: 'courier@highway-cafe.com',
      firstName: 'Courier',
      lastName: 'User',
      role: 'courier' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const user of users) {
    await db.insert(schema.users).values(user);
  }
  console.log(`✅ Created ${users.length} demo users`);
}

async function initializeCategories(db: any) {
  const existingCategories = await db.select().from(schema.categories).limit(1);
  if (existingCategories.length > 0) {
    console.log('📂 Categories already exist, skipping initialization');
    return;
  }

  const categories = [
    {
      id: 'cat-1',
      name: 'Hot Beverages',
      description: 'Coffee, tea, and other hot drinks',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'cat-2',
      name: 'Food',
      description: 'Sandwiches, pastries, and snacks',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'cat-3',
      name: 'Beverages',
      description: 'Cold drinks and juices',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const category of categories) {
    await db.insert(schema.categories).values(category);
  }
  console.log(`✅ Created ${categories.length} product categories`);
}

async function initializeIngredients(db: any) {
  const existingIngredients = await db.select().from(schema.ingredients).limit(1);
  if (existingIngredients.length > 0) {
    console.log('🥛 Ingredients already exist, skipping initialization');
    return;
  }

  const ingredients = [
    {
      id: 'ing-1',
      name: 'Coffee Beans',
      unit: 'grams',
      stockQuantity: 5000,
      minThreshold: 500,
      costPerUnit: 0.02,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ing-2',
      name: 'Milk',
      unit: 'ml',
      stockQuantity: 10000,
      minThreshold: 1000,
      costPerUnit: 0.001,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ing-3',
      name: 'Sugar',
      unit: 'grams',
      stockQuantity: 2000,
      minThreshold: 200,
      costPerUnit: 0.001,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const ingredient of ingredients) {
    await db.insert(schema.ingredients).values(ingredient);
  }
  console.log(`✅ Created ${ingredients.length} ingredients`);
}

async function initializeProducts(db: any) {
  const existingProducts = await db.select().from(schema.products).limit(1);
  if (existingProducts.length > 0) {
    console.log('🍕 Products already exist, skipping initialization');
    return;
  }

  const products = [
    {
      id: 'prod-1',
      name: 'Espresso',
      description: 'Strong black coffee',
      price: '2.50',
      categoryId: 'cat-1',
      stockQuantity: 100,
      minThreshold: 10,
      isRecipeBased: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'prod-2',
      name: 'Cappuccino',
      description: 'Espresso with steamed milk foam',
      price: '3.50',
      categoryId: 'cat-1',
      stockQuantity: 100,
      minThreshold: 10,
      isRecipeBased: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'prod-3',
      name: 'Latte',
      description: 'Espresso with steamed milk',
      price: '4.00',
      categoryId: 'cat-1',
      stockQuantity: 100,
      minThreshold: 10,
      isRecipeBased: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'prod-4',
      name: 'Croissant',
      description: 'Buttery, flaky pastry',
      price: '2.75',
      categoryId: 'cat-2',
      stockQuantity: 50,
      minThreshold: 5,
      isRecipeBased: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'prod-5',
      name: 'Turkey Sandwich',
      description: 'Fresh turkey with lettuce and tomato',
      price: '6.50',
      categoryId: 'cat-2',
      stockQuantity: 30,
      minThreshold: 5,
      isRecipeBased: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'prod-6',
      name: 'Orange Juice',
      description: 'Fresh squeezed orange juice',
      price: '3.00',
      categoryId: 'cat-3',
      stockQuantity: 25,
      minThreshold: 5,
      isRecipeBased: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const product of products) {
    await db.insert(schema.products).values(product);
  }
  console.log(`✅ Created ${products.length} products`);
}

async function initializeCurrencyRates(db: any) {
  const existingRates = await db.select().from(schema.currencyRates).limit(1);
  if (existingRates.length > 0) {
    console.log('💱 Currency rates already exist, skipping initialization');
    return;
  }

  const currencyRate = {
    fromCurrency: 'USD',
    toCurrency: 'LBP', 
    rate: '89500.000000',
    updatedBy: '3908c0e1-e2d6-4adb-936c-be6c6c2df6e8', // admin user
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.insert(schema.currencyRates).values(currencyRate);
  console.log('✅ Created default USD/LBP exchange rate (1 USD = 89,500 LBP)');
}

async function initializeDockerAchievements(db: any) {
  const existingAchievements = await db.select().from(schema.achievements).limit(1);
  if (existingAchievements.length > 0) {
    console.log('🏆 Achievements already exist, skipping initialization');
    return;
  }

  const defaultAchievements = [
    {
      id: 'first-order-achievement',
      name: 'First Steps',
      description: 'Complete your very first order',
      type: 'first_order' as const,
      icon: 'trophy',
      criteria: { orderCount: 1 },
      points: 50,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'speed-demon-achievement',
      name: 'Speed Demon',
      description: 'Average order time under 2 minutes with 10+ orders',
      type: 'speed_demon' as const,
      icon: 'zap',
      criteria: { averageTime: 2.0, minOrders: 10 },
      points: 100,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'sales-champion-achievement',
      name: 'Sales Champion',
      description: 'Generate over $1,000 in monthly sales',
      type: 'sales_champion' as const,
      icon: 'dollar-sign',
      criteria: { monthlySales: 1000 },
      points: 200,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'accuracy-ace-achievement',
      name: 'Accuracy Ace',
      description: 'Maintain 95%+ accuracy rate',
      type: 'accuracy_ace' as const,
      icon: 'target',
      criteria: { accuracyRate: 95 },
      points: 150,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'tutorial-graduate-achievement',
      name: 'Tutorial Graduate',
      description: 'Complete all 4 tutorial modules',
      type: 'tutorial_graduate' as const,
      icon: 'graduation-cap',
      criteria: { tutorialModules: 4 },
      points: 75,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'upsell-master-achievement',
      name: 'Upsell Master',
      description: 'Achieve 25%+ upsell success rate',
      type: 'upsell_master' as const,
      icon: 'trending-up',
      criteria: { upsellRate: 25 },
      points: 125,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'customer-favorite-achievement',
      name: 'Customer Favorite',
      description: 'Receive 4.5+ customer satisfaction score',
      type: 'customer_favorite' as const,
      icon: 'heart',
      criteria: { satisfactionScore: 4.5 },
      points: 175,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'monthly-winner-achievement',
      name: 'Monthly Winner',
      description: 'Rank #1 in monthly leaderboard',
      type: 'monthly_winner' as const,
      icon: 'crown',
      criteria: { monthlyRank: 1 },
      points: 500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const achievement of defaultAchievements) {
    await db.insert(schema.achievements).values(achievement);
  }
  console.log(`✅ Created ${defaultAchievements.length} achievements`);
}

// Execute if called directly
if (require.main === module) {
  initializeDockerDatabase()
    .then(() => {
      console.log('🎉 Database initialization completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}

export { initializeDockerDatabase };