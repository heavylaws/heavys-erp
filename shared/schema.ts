import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'cashier', 'barista', 'courier']);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull(), // In production, this should be hashed
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  settings: jsonb("settings").default(sql`'{}'::jsonb`),
  role: userRoleEnum("role").notNull().default('cashier'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product types enum
export const productTypeEnum = pgEnum('product_type', ['finished_good', 'ingredient_based']);

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  barcode: varchar("barcode", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  type: productTypeEnum("type").notNull().default('finished_good'),
  stockQuantity: decimal("stock_quantity", { precision: 10, scale: 3 }).notNull().default('0'),
  minThreshold: integer("min_threshold").notNull().default(5),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 4 }),
  forBarista: boolean("for_barista").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product barcodes (multiple barcodes support)
export const productBarcodes = pgTable("product_barcodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_product_barcodes_product_id").on(table.productId),
]);

// Favorite combos (quick order sets)
export const favoriteCombos = pgTable("favorite_combos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const favoriteComboItems = pgTable("favorite_combo_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  comboId: varchar("combo_id").references(() => favoriteCombos.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("favorite_combo_items_combo_idx").on(table.comboId),
  index("favorite_combo_items_product_idx").on(table.productId),
  uniqueIndex("favorite_combo_items_combo_product_uidx").on(table.comboId, table.productId),
]);

// Receipt settings table
export const receiptSettings = pgTable("receipt_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: varchar("business_name", { length: 255 }).notNull().default('Highway Cafe'),
  address: varchar("address", { length: 255 }).default(''),
  phone: varchar("phone", { length: 50 }).default(''),
  headerText: text("header_text").default('Receipt'),
  footerText: text("footer_text").default('Thank you for your business!'),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReceiptSettingsSchema = createInsertSchema(receiptSettings);
export const selectReceiptSettingsSchema = createInsertSchema(receiptSettings); // Using insert schema for consistent loose validation on updates
export type InsertReceiptSettings = z.infer<typeof insertReceiptSettingsSchema>;
export type ReceiptSettings = z.infer<typeof selectReceiptSettingsSchema>;

// Ingredients table
export const ingredients = pgTable("ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(), // ml, g, pieces, etc.
  stockQuantity: decimal("stock_quantity", { precision: 10, scale: 3 }).notNull().default('0'),
  minThreshold: decimal("min_threshold", { precision: 10, scale: 3 }).notNull().default('5'),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 4 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Recipe ingredients (for ingredient-based products)
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  ingredientId: varchar("ingredient_id").references(() => ingredients.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  recipeIngredients: many(recipeIngredients),
  barcodes: many(productBarcodes),
}));

export const productBarcodesRelations = relations(productBarcodes, ({ one }) => ({
  product: one(products, {
    fields: [productBarcodes.productId],
    references: [products.id],
  }),
}));

// Order status enum
export const orderStatusEnum = pgEnum('order_status', ['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']);

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: integer("order_number").notNull(),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name"),
  customerPhone: varchar("customer_phone"),
  customerAddress: text("customer_address"),
  cashierId: varchar("cashier_id").references(() => users.id).notNull(),
  baristaId: varchar("barista_id").references(() => users.id),
  courierId: varchar("courier_id").references(() => users.id),
  status: orderStatusEnum("status").notNull().default('pending'),
  sentToBarista: boolean("sent_to_barista").notNull().default(false),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  isDelivery: boolean("is_delivery").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  readyAt: timestamp("ready_at"),
  deliveredAt: timestamp("delivered_at"),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  modifications: text("modifications"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory log table
export const inventoryLog = pgTable("inventory_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // 'product' or 'ingredient'
  itemId: varchar("item_id").notNull(), // productId or ingredientId
  action: varchar("action", { length: 50 }).notNull(), // 'sale', 'restock', 'adjustment'
  quantityChange: decimal("quantity_change", { precision: 10, scale: 3 }).notNull(),
  previousQuantity: decimal("previous_quantity", { precision: 10, scale: 3 }).notNull(),
  newQuantity: decimal("new_quantity", { precision: 10, scale: 3 }).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity log table for admin and system operations (e.g., backup/restore)
export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g., 'db_backup', 'db_restore'
  success: boolean("success").notNull().default(true),
  details: jsonb("details"), // optional metadata
  createdAt: timestamp("created_at").defaultNow(),
});

// Performance metrics for gamification
export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).notNull().default('0'),
  averageOrderTime: decimal("average_order_time", { precision: 8, scale: 2 }).default('0'), // in minutes
  customerSatisfactionScore: decimal("customer_satisfaction_score", { precision: 3, scale: 2 }).default('0'), // 0-5 scale
  upsellSuccessRate: decimal("upsell_success_rate", { precision: 5, scale: 2 }).default('0'), // percentage
  accuracyRate: decimal("accuracy_rate", { precision: 5, scale: 2 }).default('100'), // percentage
  tutorialModulesCompleted: integer("tutorial_modules_completed").notNull().default(0),
  achievementsEarned: integer("achievements_earned").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  rank: integer("rank").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Achievement types enum
export const achievementTypeEnum = pgEnum('achievement_type', ['first_order', 'speed_demon', 'sales_champion', 'customer_favorite', 'upsell_master', 'accuracy_ace', 'tutorial_graduate', 'monthly_winner']);

// Achievements table
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  type: achievementTypeEnum("type").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  criteria: jsonb("criteria").notNull(), // JSON with achievement criteria
  points: integer("points").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User achievements (earned achievements)
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  achievementId: varchar("achievement_id").references(() => achievements.id).notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
  notified: boolean("notified").notNull().default(false),
});

// Monthly leaderboard
export const monthlyLeaderboard = pgTable("monthly_leaderboard", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  position: integer("position").notNull(),
  totalScore: integer("total_score").notNull(),
  totalOrders: integer("total_orders").notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shifts table for tracking employee work sessions
export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).notNull().default("0"),
  totalOrders: integer("total_orders").notNull().default(0),
  cashCollected: decimal("cash_collected", { precision: 10, scale: 2 }).notNull().default("0"),
  cardCollected: decimal("card_collected", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Currency exchange rates table
export const currencyRates = pgTable("currency_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCurrency: varchar("base_currency", { length: 3 }).notNull().default('USD'),
  toCurrency: varchar("target_currency", { length: 3 }).notNull().default('LBP'),
  rate: decimal("rate", { precision: 15, scale: 6 }).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---- Insert Schemas (core) ----
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFavoriteComboSchema = createInsertSchema(favoriteCombos).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFavoriteComboItemSchema = createInsertSchema(favoriteComboItems).omit({ id: true, createdAt: true });
export const insertIngredientSchema = createInsertSchema(ingredients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true, readyAt: true, deliveredAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true });
export const insertInventoryLogSchema = createInsertSchema(inventoryLog).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, createdAt: true });
export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, createdAt: true });
export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ id: true, earnedAt: true });
export const insertMonthlyLeaderboardSchema = createInsertSchema(monthlyLeaderboard).omit({ id: true, createdAt: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCurrencyRateSchema = createInsertSchema(currencyRates).omit({ id: true, createdAt: true, updatedAt: true }).extend({ rate: z.string().regex(/^[0-9]+(\.[0-9]{1,6})?$/, 'Rate must be a valid decimal') });

// ---- Option System Tables ----
export const optionGroups = pgTable("option_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  selectionType: varchar("selection_type", { length: 20 }).notNull().default('single'),
  minSelections: integer("min_selections").default(0),
  maxSelections: integer("max_selections"),
  required: boolean("required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const productOptionGroups = pgTable("product_option_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  optionGroupId: varchar("option_group_id").references(() => optionGroups.id).notNull(),
  displayOrder: integer("display_order").default(0),
  required: boolean("required").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const options = pgTable("options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optionGroupId: varchar("option_group_id").references(() => optionGroups.id).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  priceAdjust: decimal("price_adjust", { precision: 10, scale: 2 }).notNull().default('0'),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const optionIngredients = pgTable("option_ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optionId: varchar("option_id").references(() => options.id).notNull(),
  ingredientId: varchar("ingredient_id").references(() => ingredients.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const orderItemOptions = pgTable("order_item_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderItemId: varchar("order_item_id").references(() => orderItems.id).notNull(),
  optionId: varchar("option_id").references(() => options.id).notNull(),
  priceAdjust: decimal("price_adjust", { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp("created_at").defaultNow(),
});
// ---- Option System Relations ----
export const optionGroupsRelations = relations(optionGroups, ({ many }) => ({
  productOptionGroups: many(productOptionGroups),
  options: many(options),
}));
export const productOptionGroupsRelations = relations(productOptionGroups, ({ one }) => ({
  product: one(products, { fields: [productOptionGroups.productId], references: [products.id] }),
  optionGroup: one(optionGroups, { fields: [productOptionGroups.optionGroupId], references: [optionGroups.id] }),
}));
export const optionsRelations = relations(options, ({ one, many }) => ({
  optionGroup: one(optionGroups, { fields: [options.optionGroupId], references: [optionGroups.id] }),
  optionIngredients: many(optionIngredients),
  orderItemOptions: many(orderItemOptions),
}));
export const optionIngredientsRelations = relations(optionIngredients, ({ one }) => ({
  option: one(options, { fields: [optionIngredients.optionId], references: [options.id] }),
  ingredient: one(ingredients, { fields: [optionIngredients.ingredientId], references: [ingredients.id] }),
}));
export const orderItemOptionsRelations = relations(orderItemOptions, ({ one }) => ({
  orderItem: one(orderItems, { fields: [orderItemOptions.orderItemId], references: [orderItems.id] }),
  option: one(options, { fields: [orderItemOptions.optionId], references: [options.id] }),
}));
// ---- Option System Insert Schemas ----
export const insertOptionGroupSchema = createInsertSchema(optionGroups).omit({ id: true, createdAt: true });
export const insertProductOptionGroupSchema = createInsertSchema(productOptionGroups).omit({ id: true, createdAt: true });
export const insertOptionSchema = createInsertSchema(options).omit({ id: true, createdAt: true });
export const insertOptionIngredientSchema = createInsertSchema(optionIngredients).omit({ id: true, createdAt: true });
export const insertOrderItemOptionSchema = createInsertSchema(orderItemOptions).omit({ id: true, createdAt: true });
// ---- Option System Types ----
export type OptionGroup = typeof optionGroups.$inferSelect;
export type InsertOptionGroup = z.infer<typeof insertOptionGroupSchema>;
export type ProductOptionGroup = typeof productOptionGroups.$inferSelect;
export type InsertProductOptionGroup = z.infer<typeof insertProductOptionGroupSchema>;
export type Option = typeof options.$inferSelect;
export type InsertOption = z.infer<typeof insertOptionSchema>;
export type OptionIngredient = typeof optionIngredients.$inferSelect;
export type InsertOptionIngredient = z.infer<typeof insertOptionIngredientSchema>;
export type OrderItemOption = typeof orderItemOptions.$inferSelect;
export type InsertOrderItemOption = z.infer<typeof insertOrderItemOptionSchema>;

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Product = typeof products.$inferSelect & { barcodes?: string[] };
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type FavoriteCombo = typeof favoriteCombos.$inferSelect;
export type InsertFavoriteCombo = z.infer<typeof insertFavoriteComboSchema>;
export type FavoriteComboItem = typeof favoriteComboItems.$inferSelect;
export type InsertFavoriteComboItem = z.infer<typeof insertFavoriteComboItemSchema>;
export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InventoryLog = typeof inventoryLog.$inferSelect;
export type InsertInventoryLog = z.infer<typeof insertInventoryLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Gamification types
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type MonthlyLeaderboard = typeof monthlyLeaderboard.$inferSelect;
export type InsertMonthlyLeaderboard = z.infer<typeof insertMonthlyLeaderboardSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type CurrencyRate = typeof currencyRates.$inferSelect;
export type InsertCurrencyRate = z.infer<typeof insertCurrencyRateSchema>;

// (No option system tables yet; will be conditionally added under ENABLE_OPTIONS_SYSTEM flag in future patch)
