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
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
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

// Organizations table (Multi-tenancy root)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 50 }).unique().notNull(), // for subdomains or URL paths
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'cashier', 'warehouse', 'technician', 'sales', 'courier']);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id), // Nullable for system admins or pre-migration
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
}, (table) => [
  index("idx_users_org").on(table.organizationId),
]);

// Product categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_categories_org").on(table.organizationId),
]);

// Product types enum
export const productTypeEnum = pgEnum('product_type', ['finished_good', 'component_based']);

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  barcode: varchar("barcode", { length: 100 }),
  sku: varchar("sku", { length: 50 }).unique(),
  imageUrl: varchar("image_url", { length: 500 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Selling price
  categoryId: varchar("category_id").references(() => categories.id),
  type: productTypeEnum("type").notNull().default('finished_good'),
  stockQuantity: decimal("stock_quantity", { precision: 10, scale: 3 }).notNull().default('0'),
  minThreshold: integer("min_threshold").notNull().default(5),
  // Margin-based pricing
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 4 }), // Purchase/cost price
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default('25'), // Percentage (e.g., 25 = 25%)
  // Hardware-specific fields
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  warrantyMonths: integer("warranty_months").default(0),
  weight: decimal("weight", { precision: 10, scale: 3 }), // in kg
  dimensions: jsonb("dimensions"), // { length, width, height }
  specifications: jsonb("specifications"), // Custom specs per product
  reorderPoint: integer("reorder_point").default(10),
  reorderQuantity: integer("reorder_quantity").default(20),
  location: varchar("location", { length: 50 }), // Warehouse bin/shelf
  requiresSerialNumber: boolean("requires_serial_number").notNull().default(false),
  requiresFulfillment: boolean("requires_fulfillment").notNull().default(false), // Replaces forBarista
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_products_org").on(table.organizationId),
]);

// Product barcodes (multiple barcodes support)
export const productBarcodes = pgTable("product_barcodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Implicitly bound to organization via productId, but could add direct link if needed for faster lookups
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull().unique(), // Unique globally? Or per org? Ideally per org, but barcodes are universal usually.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_product_barcodes_product_id").on(table.productId),
]);

// Favorite combos (quick order sets)
export const favoriteCombos = pgTable("favorite_combos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fav_combos_org").on(table.organizationId),
]);

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
  organizationId: varchar("organization_id").references(() => organizations.id),
  businessName: varchar("business_name", { length: 255 }).notNull().default('Heavy\'s Hardware'),
  address: varchar("address", { length: 255 }).default(''),
  phone: varchar("phone", { length: 50 }).default(''),
  headerText: text("header_text").default('Receipt'),
  footerText: text("footer_text").default('Thank you for your business!'),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_receipt_settings_org").on(table.organizationId),
]);

export const insertReceiptSettingsSchema = createInsertSchema(receiptSettings);
export const selectReceiptSettingsSchema = createInsertSchema(receiptSettings); // Using insert schema for consistent loose validation on updates
export type InsertReceiptSettings = z.infer<typeof insertReceiptSettingsSchema>;
export type ReceiptSettings = z.infer<typeof selectReceiptSettingsSchema>;

// Components table
export const components = pgTable("components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 200 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(), // ml, g, pieces, etc.
  stockQuantity: decimal("stock_quantity", { precision: 10, scale: 3 }).notNull().default('0'),
  minThreshold: decimal("min_threshold", { precision: 10, scale: 3 }).notNull().default('5'),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 4 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_components_org").on(table.organizationId),
]);

// Product components (for component-based products)
export const productComponents = pgTable("product_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  componentId: varchar("component_id").references(() => components.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  components: many(productComponents),
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
  organizationId: varchar("organization_id").references(() => organizations.id),
  orderNumber: integer("order_number").notNull(),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name"),
  customerPhone: varchar("customer_phone"),
  customerAddress: text("customer_address"),
  cashierId: varchar("cashier_id").references(() => users.id).notNull(),
  technicianId: varchar("technician_id").references(() => users.id),
  courierId: varchar("courier_id").references(() => users.id),
  status: orderStatusEnum("status").notNull().default('pending'),
  sentToFulfillment: boolean("sent_to_fulfillment").notNull().default(false),
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
}, (table) => [
  index("idx_orders_org").on(table.organizationId),
]);

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
  organizationId: varchar("organization_id").references(() => organizations.id),
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
}, (table) => [
  index("idx_inventory_log_org").on(table.organizationId),
]);

// Activity log table for admin and system operations (e.g., backup/restore)
export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g., 'db_backup', 'db_restore'
  success: boolean("success").notNull().default(true),
  details: jsonb("details"), // optional metadata
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_activity_log_org").on(table.organizationId),
]);

// Performance metrics for gamification
export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
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
}, (table) => [
  index("idx_perf_metrics_org").on(table.organizationId),
]);

// Achievement types enum
export const achievementTypeEnum = pgEnum('achievement_type', ['first_order', 'speed_demon', 'sales_champion', 'customer_favorite', 'upsell_master', 'accuracy_ace', 'tutorial_graduate', 'monthly_winner']);

// Achievements table
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  type: achievementTypeEnum("type").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  criteria: jsonb("criteria").notNull(), // JSON with achievement criteria
  points: integer("points").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_achievements_org").on(table.organizationId),
]);

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
  organizationId: varchar("organization_id").references(() => organizations.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  position: integer("position").notNull(),
  totalScore: integer("total_score").notNull(),
  totalOrders: integer("total_orders").notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_leaderboard_org").on(table.organizationId),
]);

// Shifts table for tracking employee work sessions
export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
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
}, (table) => [
  index("idx_shifts_org").on(table.organizationId),
]);

// Currency exchange rates table
export const currencyRates = pgTable("currency_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  fromCurrency: varchar("base_currency", { length: 3 }).notNull().default('USD'),
  toCurrency: varchar("target_currency", { length: 3 }).notNull().default('LBP'),
  rate: decimal("rate", { precision: 15, scale: 6 }).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_currency_rates_org").on(table.organizationId),
]);

// ---- Insert Schemas (core) ----
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFavoriteComboSchema = createInsertSchema(favoriteCombos).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFavoriteComboItemSchema = createInsertSchema(favoriteComboItems).omit({ id: true, createdAt: true });
export const insertComponentSchema = createInsertSchema(components).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductComponentSchema = createInsertSchema(productComponents).omit({ id: true, createdAt: true });
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
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  selectionType: varchar("selection_type", { length: 20 }).notNull().default('single'),
  minSelections: integer("min_selections").default(0),
  maxSelections: integer("max_selections"),
  required: boolean("required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_option_groups_org").on(table.organizationId),
]);
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
export const optionComponents = pgTable("option_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optionId: varchar("option_id").references(() => options.id).notNull(),
  componentId: varchar("component_id").references(() => components.id).notNull(),
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
  optionComponents: many(optionComponents),
  orderItemOptions: many(orderItemOptions),
}));
export const optionComponentsRelations = relations(optionComponents, ({ one }) => ({
  option: one(options, { fields: [optionComponents.optionId], references: [options.id] }),
  component: one(components, { fields: [optionComponents.componentId], references: [components.id] }),
}));
export const orderItemOptionsRelations = relations(orderItemOptions, ({ one }) => ({
  orderItem: one(orderItems, { fields: [orderItemOptions.orderItemId], references: [orderItems.id] }),
  option: one(options, { fields: [orderItemOptions.optionId], references: [options.id] }),
}));
// ---- Option System Insert Schemas ----
export const insertOptionGroupSchema = createInsertSchema(optionGroups).omit({ id: true, createdAt: true });
export const insertProductOptionGroupSchema = createInsertSchema(productOptionGroups).omit({ id: true, createdAt: true });
export const insertOptionSchema = createInsertSchema(options).omit({ id: true, createdAt: true });
export const insertOptionComponentSchema = createInsertSchema(optionComponents).omit({ id: true, createdAt: true });
export const insertOrderItemOptionSchema = createInsertSchema(orderItemOptions).omit({ id: true, createdAt: true });
// ---- Option System Types ----
export type OptionGroup = typeof optionGroups.$inferSelect;
export type InsertOptionGroup = z.infer<typeof insertOptionGroupSchema>;
export type ProductOptionGroup = typeof productOptionGroups.$inferSelect;
export type InsertProductOptionGroup = z.infer<typeof insertProductOptionGroupSchema>;
export type Option = typeof options.$inferSelect;
export type InsertOption = z.infer<typeof insertOptionSchema>;
export type OptionComponent = typeof optionComponents.$inferSelect;
export type InsertOptionComponent = z.infer<typeof insertOptionComponentSchema>;
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
export type Component = typeof components.$inferSelect;
export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type ProductComponent = typeof productComponents.$inferSelect;
export type InsertProductComponent = z.infer<typeof insertProductComponentSchema>;
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

// ---- ERP Module Tables ----

// Customer type enum
export const customerTypeEnum = pgEnum('customer_type', ['retail', 'wholesale', 'corporate']);

// Purchase order status enum
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', ['draft', 'sent', 'partial', 'received', 'cancelled']);

// Serial number status enum
export const serialNumberStatusEnum = pgEnum('serial_number_status', ['in_stock', 'sold', 'returned', 'defective', 'warranty_repair']);

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).unique(),
  contactPerson: varchar("contact_person", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_suppliers_org").on(table.organizationId),
]);

// Product-Supplier relationship
export const productSuppliers = pgTable("product_suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  supplierSku: varchar("supplier_sku", { length: 100 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  leadTimeDays: integer("lead_time_days"),
  isPreferred: boolean("is_preferred").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_product_suppliers_product").on(table.productId),
  index("idx_product_suppliers_supplier").on(table.supplierId),
]);

// Customers table (for B2B & warranty tracking)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  type: customerTypeEnum("type").notNull().default('retail'),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).unique(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  taxId: varchar("tax_id", { length: 50 }),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default('0'),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default('0'),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_customers_org").on(table.organizationId),
]);

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  status: purchaseOrderStatusEnum("status").notNull().default('draft'),
  orderDate: timestamp("order_date").defaultNow(),
  expectedDate: timestamp("expected_date"),
  receivedDate: timestamp("received_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  tax: decimal("tax", { precision: 12, scale: 2 }),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_purchase_orders_org").on(table.organizationId),
  index("idx_purchase_orders_supplier").on(table.supplierId),
  index("idx_purchase_orders_status").on(table.status),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id, { onDelete: 'cascade' }).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  receivedQuantity: integer("received_quantity").default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_po_items_order").on(table.purchaseOrderId),
]);

// Serial Numbers (for electronics tracking)
export const serialNumbers = pgTable("serial_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  serialNumber: varchar("serial_number", { length: 100 }).unique().notNull(),
  status: serialNumberStatusEnum("status").notNull().default('in_stock'),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id),
  orderId: varchar("order_id").references(() => orders.id),
  customerId: varchar("customer_id").references(() => customers.id),
  warrantyExpiry: timestamp("warranty_expiry"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_serial_product").on(table.productId),
  index("idx_serial_status").on(table.status),
  index("idx_serial_customer").on(table.customerId),
]);

// ---- ERP Relations ----
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  productSuppliers: many(productSuppliers),
  purchaseOrders: many(purchaseOrders),
}));

export const productSuppliersRelations = relations(productSuppliers, ({ one }) => ({
  product: one(products, { fields: [productSuppliers.productId], references: [products.id] }),
  supplier: one(suppliers, { fields: [productSuppliers.supplierId], references: [suppliers.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  serialNumbers: many(serialNumbers),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  createdByUser: one(users, { fields: [purchaseOrders.createdBy], references: [users.id] }),
  items: many(purchaseOrderItems),
  serialNumbers: many(serialNumbers),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderItems.purchaseOrderId], references: [purchaseOrders.id] }),
  product: one(products, { fields: [purchaseOrderItems.productId], references: [products.id] }),
}));

export const serialNumbersRelations = relations(serialNumbers, ({ one }) => ({
  product: one(products, { fields: [serialNumbers.productId], references: [products.id] }),
  purchaseOrder: one(purchaseOrders, { fields: [serialNumbers.purchaseOrderId], references: [purchaseOrders.id] }),
  order: one(orders, { fields: [serialNumbers.orderId], references: [orders.id] }),
  customer: one(customers, { fields: [serialNumbers.customerId], references: [customers.id] }),
}));

// ---- ERP Insert Schemas ----
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSupplierSchema = createInsertSchema(productSuppliers).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true, createdAt: true });
export const insertSerialNumberSchema = createInsertSchema(serialNumbers).omit({ id: true, createdAt: true, updatedAt: true });

// ---- ERP Types ----
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type InsertProductSupplier = z.infer<typeof insertProductSupplierSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type SerialNumber = typeof serialNumbers.$inferSelect;
export type InsertSerialNumber = z.infer<typeof insertSerialNumberSchema>;


// Company Settings table
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull().default("My Business"),
  address: text("address").default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  email: varchar("email", { length: 255 }).default(""),
  website: varchar("website", { length: 255 }).default(""),
  taxId: varchar("tax_id", { length: 100 }).default(""),
  logoUrl: text("logo_url").default(""), // Base64 or URL
  loginSubtitle: text("login_subtitle").default("Please log in to continue"),
  showDemoCredentials: boolean("show_demo_credentials").default(true),
  currency: varchar("currency", { length: 10 }).default("USD"),
  timezone: varchar("timezone", { length: 100 }).default("UTC"),
  receiptHeader: text("receipt_header").default("Welcome!"),
  receiptFooter: text("receipt_footer").default("Thank you for your visit!"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_settings_org").on(table.organizationId),
]);

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true, updatedAt: true });
export const selectCompanySettingsSchema = createSelectSchema(companySettings);
export type CompanySettings = z.infer<typeof selectCompanySettingsSchema>;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// Quotations System
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: varchar("customer_name"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quotes_org").on(table.organizationId),
]);

export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  priceAtQuote: decimal("price_at_quote", { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  index("idx_quote_items_quote").on(table.quoteId),
]);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  items: many(quoteItems),
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
  product: one(products, {
    fields: [quoteItems.productId],
    references: [products.id],
  }),
}));

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({
  id: true
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
