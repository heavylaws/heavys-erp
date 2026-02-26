import {
  customers,
  users,
  categories,
  products,
  productBarcodes,
  components,
  productComponents,
  orders,
  orderItems,
  inventoryLog,
  activityLog,
  performanceMetrics,
  achievements,
  userAchievements,
  monthlyLeaderboard,
  shifts,
  currencyRates,
  // Option system tables
  optionGroups,
  productOptionGroups,
  options as optionTable,
  optionComponents,
  orderItemOptions,
  favoriteCombos,
  favoriteComboItems,
  receiptSettings,
  // Types
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type Component,
  type InsertComponent,
  type ProductComponent,
  type InsertProductComponent,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type InventoryLog,
  type InsertInventoryLog,
  type PerformanceMetrics,
  type InsertPerformanceMetrics,
  type Achievement,
  type InsertAchievement,
  type UserAchievement,
  type InsertUserAchievement,
  type MonthlyLeaderboard,
  type InsertMonthlyLeaderboard,
  type Shift,
  type InsertShift,
  type CurrencyRate,
  type InsertCurrencyRate,
  type ActivityLog,
  type InsertActivityLog,
  type OptionGroup,
  type InsertOptionGroup,
  type ProductOptionGroup,
  type InsertProductOptionGroup,
  type Option,
  type InsertOption,
  type OptionComponent,
  type InsertOptionComponent,
  type OrderItemOption,
  type InsertOrderItemOption,
  type FavoriteCombo,
  type InsertFavoriteCombo,
  type FavoriteComboItem,
  type InsertFavoriteComboItem,
  type ReceiptSettings,
  type InsertReceiptSettings,
  companySettings,
  type CompanySettings,
  type InsertCompanySettings
} from "@shared/schema";
import { db, rawClient } from "./db";
import { eq, desc, asc, and, or, sql, gte, lte, inArray, ne } from "drizzle-orm";
import { ENABLE_OPTIONS_SYSTEM } from '@shared/feature-flags';

export type FavoriteComboWithItems = FavoriteCombo & {
  items: Array<FavoriteComboItem & { product?: Product | null }>;
};

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // User management operations
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Product operations
  getProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  updateProductStock(id: string, quantity: number, userId: string, reason: string): Promise<void>;

  // Component operations
  getComponents(search?: string): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, component: Partial<InsertComponent>): Promise<Component>;
  deleteComponent(id: string): Promise<void>;
  updateComponentStock(id: string, quantity: number, userId: string, reason: string): Promise<void>;

  // Bundle/Product Component operations
  getProductComponents(productId: string): Promise<ProductComponent[]>;
  getOptionalProductComponents(productId: string): Promise<Array<{
    productComponentId: string;
    componentId: string;
    quantity: string;
    componentName: string;
    unit: string | null;
    stockQuantity: string;
    minThreshold: string;
  }>>;
  createProductComponent(productComponent: InsertProductComponent): Promise<ProductComponent>;
  deleteProductComponent(id: string): Promise<void>;

  // Order operations
  getOrders(limit?: number): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getOrdersByStatusWithItems(status: string): Promise<any[]>;
  getOrdersByUserId(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderWithDetails(id: string): Promise<any>;
  createOrder(order: InsertOrder): Promise<Order>;
  // Create an order along with its items and inventory impact in a single transaction
  createOrderTransaction(order: InsertOrder, items: InsertOrderItem[], userId: string): Promise<Order>;
  updateOrderTransaction(orderId: string, orderData: Partial<InsertOrder>, items: InsertOrderItem[], userId: string): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order>;
  deleteOrder(id: string, userId?: string): Promise<void>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  archiveReadyOrdersOlderThan(minutes: number): Promise<string[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  deleteOrderItems(orderId: string): Promise<void>;
  getNextOrderNumber(): Promise<number>;

  // Inventory operations
  getLowStockProducts(): Promise<Product[]>;
  getLowStockComponents(): Promise<Component[]>;
  createInventoryLog(log: InsertInventoryLog): Promise<InventoryLog>;
  getInventoryLogs(limit?: number): Promise<InventoryLog[]>;

  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  getActivityLogsPaged(params: { limit?: number; offset?: number; userId?: string; success?: boolean; action?: string; from?: Date; to?: Date }): Promise<{ total: number; rows: ActivityLog[] }>;

  // Analytics operations
  getTodaysSales(): Promise<{ total: number; count: number }>;
  getTopProducts(limit?: number): Promise<Array<{ product: Product; sales: number; revenue: number }>>;
  getSalesData(days: number): Promise<Array<{ date: string; sales: number; orders: number }>>;

  // Gamification operations
  getPerformanceMetrics(userId: string, month?: number, year?: number): Promise<PerformanceMetrics | undefined>;
  upsertPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics>;
  getLeaderboard(month: number, year: number, limit?: number): Promise<Array<MonthlyLeaderboard & { user: User }>>;
  updateLeaderboard(month: number, year: number): Promise<void>;

  // Achievement operations
  getAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: string): Promise<Array<UserAchievement & { achievement: Achievement }>>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  awardAchievement(userId: string, achievementId: string): Promise<UserAchievement>;
  checkAndAwardAchievements(userId: string, orderData?: any): Promise<UserAchievement[]>;

  // Currency management methods
  getCurrencyRates(): Promise<CurrencyRate[]>;
  getCurrentExchangeRate(fromCurrency?: string, toCurrency?: string): Promise<CurrencyRate | null>;
  updateCurrencyRate(rate: InsertCurrencyRate): Promise<CurrencyRate>;
  getCurrencyRateHistory(limit?: number): Promise<CurrencyRate[]>;

  getShiftReport(shiftId: string): Promise<any>;
  // Shift management methods
  getShifts(): Promise<Array<Shift & { user: User }>>;
  getActiveShifts(): Promise<Array<Shift & { user: User }>>;
  getUserShifts(userId: string): Promise<Shift[]>;
  startShift(userId: string, notes?: string): Promise<Shift>;
  endShift(shiftId: string, notes?: string): Promise<Shift>;
  updateShiftSales(shiftId: string, amount: number, paymentMethod: string): Promise<void>;
  getShiftReports(params: { userId?: string; startDate?: string; endDate?: string; role?: string }): Promise<any[]>;
  getPerformanceReports(params: { date?: string; role?: string }): Promise<any[]>;

  // Option system (flag gated)
  getOptionGroups(): Promise<OptionGroup[]>;
  getOptionGroup(id: string): Promise<OptionGroup | undefined>;
  createOptionGroup(data: InsertOptionGroup): Promise<OptionGroup>;
  updateOptionGroup(id: string, data: Partial<InsertOptionGroup>): Promise<OptionGroup>;
  deleteOptionGroup(id: string): Promise<void>;

  getProductOptionGroups(productId: string): Promise<Array<ProductOptionGroup & { group: OptionGroup; options: Option[] }>>;
  attachOptionGroupToProduct(data: InsertProductOptionGroup): Promise<ProductOptionGroup>;
  detachOptionGroupFromProduct(id: string): Promise<void>;

  getOptions(groupId: string): Promise<Option[]>;
  getOption(id: string): Promise<Option | undefined>;
  createOption(data: InsertOption): Promise<Option>;
  updateOption(id: string, data: Partial<InsertOption>): Promise<Option>;
  deleteOption(id: string): Promise<void>;

  getOptionComponents(optionId: string): Promise<OptionComponent[]>;
  addOptionComponent(data: InsertOptionComponent): Promise<OptionComponent>;
  deleteOptionComponent(id: string): Promise<void>;
  // Order item options
  getOrderItemOptions(orderItemId: string): Promise<OrderItemOption[]>;
  createOrderItemOption(data: InsertOrderItemOption): Promise<OrderItemOption>;
  getOptionsByIds(ids: string[]): Promise<Option[]>;
  getOptionComponentsByOptionIds(optionIds: string[]): Promise<OptionComponent[]>;

  // Favorite combo operations
  getFavoriteCombos(includeInactive?: boolean): Promise<FavoriteComboWithItems[]>;
  createFavoriteCombo(data: InsertFavoriteCombo, items: Array<{ productId: string; quantity: number }>): Promise<FavoriteComboWithItems>;
  updateFavoriteCombo(id: string, data: Partial<InsertFavoriteCombo>, items?: Array<{ productId: string; quantity: number }>): Promise<FavoriteComboWithItems>;
  deleteFavoriteCombo(id: string): Promise<void>;

  // Strategic Reports
  getStaffingHeatmap(): Promise<Array<{ dayOfWeek: number; hourOfDay: number; orderCount: number }>>;
  getProfitLoss(startDate?: Date, endDate?: Date): Promise<Array<{ date: string; revenue: number; cost: number; profit: number }>>;
  getMenuMatrix(startDate?: Date, endDate?: Date): Promise<Array<{ productId: string; name: string; salesVolume: number; revenue: number; profit: number; margin: number }>>;
  getCustomReport(startTime: Date, endTime: Date): Promise<any>;

  // Company Settings
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings>;
}

// --- Stock Management Helpers ---

async function adjustStockForOrderItems(tx: any, items: any[], orderNumber: number, userId: string, actionReason: string, isRestore: boolean) {
  const productComponentCache: Record<string, ProductComponent[]> = {};

  for (const item of items) {
    const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
    if (!product) throw new Error(`Product ${item.productId} not found`);

    if (product.type === 'finished_good') {
      const qtyChange = isRestore ? item.quantity : -item.quantity;
      const updateSql = isRestore
        ? sql`UPDATE ${products} SET stock_quantity = stock_quantity + ${item.quantity}::numeric, updated_at = now() WHERE id = ${item.productId} RETURNING stock_quantity`
        : sql`UPDATE ${products} SET stock_quantity = stock_quantity - ${item.quantity}::numeric, updated_at = now() WHERE id = ${item.productId} AND stock_quantity >= ${item.quantity} RETURNING stock_quantity`;

      const result: any = await tx.execute(updateSql);
      if (!Array.isArray(result) || (result.length === 0)) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }

      const newQty = result[0].stock_quantity;
      await tx.insert(inventoryLog).values({
        type: 'product',
        itemId: product.id,
        action: isRestore ? 'adjustment' : 'sale',
        quantityChange: String(qtyChange),
        previousQuantity: String(product.stockQuantity ?? 0),
        newQuantity: String(newQty),
        userId,
        reason: actionReason,
      });
    } else {
      // Component-based product
      if (!productComponentCache[item.productId]) {
        productComponentCache[item.productId] = await tx.select().from(productComponents).where(eq(productComponents.productId, item.productId));
      }
      const pcList = productComponentCache[item.productId] || [];
      for (const pc of pcList) {
        if (pc.isOptional && !((item as any).__selectedOptionalIngredientIds || []).includes(pc.id)) continue;
        const perUnitQty = parseFloat(String(pc.quantity || '0'));
        if (isNaN(perUnitQty) || perUnitQty <= 0) continue;
        const totalQty = perUnitQty * item.quantity;
        const qtyChange = isRestore ? totalQty : -totalQty;

        const [componentRow] = await tx.select().from(components).where(eq(components.id, pc.componentId));
        if (!componentRow) throw new Error(`Component ${pc.componentId} not found`);
        const prevStock = Number(componentRow.stockQuantity);

        const updateSql = isRestore
          ? sql`UPDATE ${components} SET stock_quantity = (stock_quantity::numeric + ${String(totalQty)})::numeric, updated_at = now() WHERE id = ${pc.componentId} RETURNING stock_quantity`
          : sql`UPDATE ${components} SET stock_quantity = (stock_quantity::numeric - ${String(totalQty)})::numeric, updated_at = now() WHERE id = ${pc.componentId} AND stock_quantity >= ${String(totalQty)}::numeric RETURNING stock_quantity`;

        const result: any = await tx.execute(updateSql);
        if (!Array.isArray(result) || result.length === 0) {
          throw new Error(`Insufficient component stock for ${pc.componentId} used by product ${product.name}`);
        }

        const newQty = result[0].stock_quantity;
        await tx.insert(inventoryLog).values({
          type: 'component',
          itemId: pc.componentId,
          action: isRestore ? 'adjustment' : 'sale',
          quantityChange: String(qtyChange),
          previousQuantity: String(prevStock),
          newQuantity: String(newQty),
          userId,
          reason: actionReason,
        });
      }
    }
  }
}

export class DatabaseStorage implements IStorage {
  // Activity log operations
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [row] = await db.insert(activityLog).values(log).returning();
    return row;
  }

  async getActivityLogs(limit = 100): Promise<ActivityLog[]> {
    return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
  }

  async getActivityLogsPaged(params: { limit?: number; offset?: number; userId?: string; success?: boolean; action?: string; from?: Date; to?: Date }): Promise<{ total: number; rows: ActivityLog[] }> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const conditions: any[] = [];
    if (params.userId) conditions.push(eq(activityLog.userId, params.userId));
    if (typeof params.success === 'boolean') conditions.push(eq(activityLog.success, params.success));
    if (params.action) conditions.push(sql`lower(${activityLog.action}) like ${'%' + params.action.toLowerCase() + '%'}`);
    if (params.from) conditions.push(gte(activityLog.createdAt, params.from));
    if (params.to) conditions.push(lte(activityLog.createdAt, params.to));

    const whereExpr = conditions.length ? and(...conditions as any) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(activityLog)
      .where(whereExpr as any);

    const rows = await db
      .select()
      .from(activityLog)
      .where(whereExpr as any)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit)
      .offset(offset);

    return { total: count ?? 0, rows } as any;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // User management operations
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.username));
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.name));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    // Check for ACTIVE products only - we want to block deletion if category is in use
    const activeProducts = await db.select().from(products).where(and(eq(products.categoryId, id), eq(products.isActive, true))).limit(1);

    if (activeProducts.length > 0) {
      throw new Error("Cannot delete category containing active products. Please remove or move them first.");
    }

    // Unlink any INACTIVE products (prevent FK violation)
    await db.update(products)
      .set({ categoryId: null })
      .where(eq(products.categoryId, id));

    // Now safe to delete
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    const results = await db.query.products.findMany({
      where: eq(products.isActive, true),
      orderBy: asc(products.name),
      with: {
        barcodes: true
      }
    });

    return results.map((p: any) => ({
      ...p,
      barcodes: p.barcodes.map((b: { barcode: string }) => b.barcode)
    }));
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const results = await db.query.products.findMany({
      where: and(eq(products.categoryId, categoryId), eq(products.isActive, true)),
      orderBy: asc(products.name),
      with: {
        barcodes: true
      }
    });

    return results.map((p: any) => ({
      ...p,
      barcodes: p.barcodes.map((b: { barcode: string }) => b.barcode)
    }));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        barcodes: true
      }
    });

    if (!product) return undefined;

    return {
      ...product,
      barcodes: product.barcodes.map((b: { barcode: string }) => b.barcode)
    };
  }

  async createProduct(product: InsertProduct & { barcodes?: string[] }): Promise<Product> {
    return await db.transaction(async (tx: any) => {
      // 1. Create product
      const { barcodes: barcodesList, ...productData } = product as any;
      const [newProduct] = await tx.insert(products).values(productData).returning();

      // 2. Insert extra barcodes if any
      const codesToInsert = new Set<string>();

      // Always include primary barcode
      if (newProduct.barcode) codesToInsert.add(newProduct.barcode);
      // Include additional
      if (barcodesList && Array.isArray(barcodesList)) {
        barcodesList.forEach((b: string) => codesToInsert.add(b));
      }

      if (codesToInsert.size > 0) {
        await tx.insert(productBarcodes).values(
          Array.from(codesToInsert).map(b => ({
            productId: newProduct.id,
            barcode: b
          }))
        ).onConflictDoNothing();
      }

      return {
        ...newProduct,
        barcodes: Array.from(codesToInsert)
      };
    });
  }

  async updateProduct(id: string, product: Partial<InsertProduct> & { barcodes?: string[] }): Promise<Product> {
    return await db.transaction(async (tx: any) => {
      const { barcodes: barcodesList, ...productData } = product as any;

      let updatedProduct: any;

      // Update fields if provided
      if (Object.keys(productData).length > 0) {
        [updatedProduct] = await tx
          .update(products)
          .set({ ...productData, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();
      } else {
        // Fetch current if no fields update
        updatedProduct = await tx.query.products.findFirst({
          where: eq(products.id, id)
        });
      }

      if (!updatedProduct) throw new Error("Product not found");

      // Handle barcode updates if provided
      if (barcodesList && Array.isArray(barcodesList)) {
        // 1. Delete existing for this product
        await tx.delete(productBarcodes).where(eq(productBarcodes.productId, id));

        const codesToInsert = new Set<string>();

        // Strategy: Should we include the primary barcode from the update or existing?
        // If barcodesList is provided, it is the SOURCE OF TRUTH for the "Multiple Barcodes" list.
        // However, the `barcode` column on `products` still exists.
        // If `productData.barcode` is provided, we use that.
        // Else we use `updatedProduct.barcode`.

        const primaryB = productData.barcode !== undefined ? productData.barcode : updatedProduct.barcode;
        if (primaryB) codesToInsert.add(primaryB);

        barcodesList.forEach((b: string) => codesToInsert.add(b));

        if (codesToInsert.size > 0) {
          await tx.insert(productBarcodes).values(
            Array.from(codesToInsert).map(b => ({
              productId: id,
              barcode: b
            }))
          ).onConflictDoNothing();
        }

        updatedProduct.barcodes = Array.from(codesToInsert);
      } else {
        // Re-fetch barcodes to return complete object
        const currentBarcodes = await tx.select().from(productBarcodes).where(eq(productBarcodes.productId, id));
        updatedProduct.barcodes = currentBarcodes.map((b: { barcode: string }) => b.barcode);
      }

      return updatedProduct;
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  }

  async updateProductStock(id: string, quantityChange: number, userId: string, reason: string): Promise<void> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) throw new Error('Product not found');

    const newQuantity = parseFloat(String(product.stockQuantity)) + quantityChange;

    await db.transaction(async (tx: any) => {
      await tx
        .update(products)
        .set({ stockQuantity: newQuantity, updatedAt: new Date() })
        .where(eq(products.id, id));

      await tx.insert(inventoryLog).values({
        type: 'product',
        itemId: id,
        action: quantityChange > 0 ? 'restock' : 'sale',
        quantityChange: String(quantityChange),
        previousQuantity: String(product.stockQuantity),
        newQuantity: String(newQuantity),
        userId,
        reason,
      });
    });
  }

  // Component operations
  async getComponents(search?: string): Promise<Component[]> {
    const conditions: any[] = [eq(components.isActive, true)];
    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push(sql`lower(${components.name}) like ${term}`);
    }

    const whereExpr = conditions.length === 1 ? conditions[0] : and(...conditions as any);

    return db
      .select()
      .from(components)
      .where(whereExpr as any)
      .orderBy(asc(components.name));
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

  async getComponent(id: string): Promise<Component | undefined> {
    const [component] = await db.select().from(components).where(eq(components.id, id));
    return component;
  }

  async createComponent(component: InsertComponent): Promise<Component> {
    const [newComponent] = await db.insert(components).values(component).returning();
    return newComponent;
  }

  async updateComponent(id: string, component: Partial<InsertComponent>): Promise<Component> {
    const [updatedComponent] = await db
      .update(components)
      .set({ ...component, updatedAt: new Date() })
      .where(eq(components.id, id))
      .returning();
    return updatedComponent;
  }

  async deleteComponent(id: string): Promise<void> {
    try {
      const result = await db.update(components).set({ isActive: false }).where(eq(components.id, id));
      if (!result.rowCount || result.rowCount === 0) {
        throw new Error('Component not found');
      }
    } catch (error) {
      console.error('Error deleting component:', error);
      throw error;
    }
  }

  async updateComponentStock(id: string, quantityChange: number, userId: string, reason: string): Promise<void> {
    const [component] = await db.select().from(components).where(eq(components.id, id));
    if (!component) throw new Error('Component not found');

    const currentQuantity = parseFloat(component.stockQuantity);
    const newQuantity = currentQuantity + quantityChange;

    await db.transaction(async (tx: any) => {
      await tx
        .update(components)
        .set({ stockQuantity: String(newQuantity), updatedAt: new Date() })
        .where(eq(components.id, id));

      await tx.insert(inventoryLog).values({
        type: 'component',
        itemId: id,
        action: quantityChange > 0 ? 'restock' : 'sale',
        quantityChange: String(quantityChange),
        previousQuantity: component.stockQuantity,
        newQuantity: String(newQuantity),
        userId,
        reason,
      });
    });
  }

  // Product Component operations
  async getProductComponents(productId: string): Promise<ProductComponent[]> {
    return db.select().from(productComponents).where(eq(productComponents.productId, productId));
  }

  async getOptionalProductComponents(productId: string): Promise<Array<{
    productComponentId: string;
    componentId: string;
    quantity: string;
    componentName: string;
    unit: string | null;
    stockQuantity: string;
    minThreshold: string;
  }>> {
    return db
      .select({
        productComponentId: productComponents.id,
        componentId: productComponents.componentId,
        quantity: productComponents.quantity,
        componentName: components.name,
        unit: components.unit,
        stockQuantity: components.stockQuantity,
        minThreshold: components.minThreshold,
      })
      .from(productComponents)
      .innerJoin(components, eq(productComponents.componentId, components.id))
      .where(
        and(
          eq(productComponents.productId, productId),
          eq(productComponents.isOptional, true),
          eq(components.isActive, true)
        )
      )
      .orderBy(asc(components.name));
  }

  async createProductComponent(productComponent: InsertProductComponent): Promise<ProductComponent> {
    const [newProductComponent] = await db.insert(productComponents).values(productComponent).returning();
    return newProductComponent;
  }

  async deleteProductComponent(id: string): Promise<void> {
    await db.delete(productComponents).where(eq(productComponents.id, id));
  }

  async updateProductComponent(id: string, data: Partial<InsertProductComponent>): Promise<ProductComponent> {
    const [updated] = await db.update(productComponents).set(data).where(eq(productComponents.id, id)).returning();
    if (!updated) throw new Error('Product component not found');
    return updated;
  }

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

  // Order operations
  async getOrders(limit = 100): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.status, status as any))
      .orderBy(asc(orders.createdAt));
  }

  async getOrdersByStatusWithItems(status: string): Promise<any[]> {
    // Fetch orders
    const orderList = await db
      .select()
      .from(orders)
      .where(eq(orders.status, status as any))
      .orderBy(asc(orders.createdAt));

    if (orderList.length === 0) return [];

    // Fetch all items for these orders in one query
    const orderIds = orderList.map((o: any) => o.id);
    const allItems = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        total: orderItems.total,
        modifications: orderItems.modifications,
        product: products,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(inArray(orderItems.orderId, orderIds));

    // Group items by orderId
    const itemsByOrderId = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsByOrderId.get(item.orderId) || [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    // Merge items into orders
    return orderList.map((order: any) => ({
      ...order,
      items: itemsByOrderId.get(order.id) || []
    }));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderWithDetails(id: string): Promise<any> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db
      .select({
        ...orderItems,
        product: products,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    return {
      ...order,
      items
    };
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async createOrderTransaction(order: InsertOrder, items: InsertOrderItem[], userId: string): Promise<Order> {
    const createdOrder = await db.transaction(async (tx: any) => {
      if (order.paymentMethod === 'debt' && order.customerName) {
        const [existingCustomer] = await tx.select().from(customers).where(eq(customers.name, order.customerName));
        const debtAmount = Number(order.total || 0);

        if (existingCustomer) {
          await tx.update(customers).set({
            currentBalance: String(Number(existingCustomer.currentBalance || 0) + debtAmount),
            updatedAt: new Date()
          }).where(eq(customers.id, existingCustomer.id));
          order.customerId = existingCustomer.id;
        } else {
          const [newCustomer] = await tx.insert(customers).values({
            name: order.customerName,
            type: 'retail',
            currentBalance: String(debtAmount),
          }).returning();
          order.customerId = newCustomer.id;
        }
      }

      const [newOrder] = await tx.insert(orders).values(order).returning();

      // Build caches for product components and optional components to avoid repeated DB calls
      const productComponentCache: Record<string, ProductComponent[]> = {};

      for (const item of items) {
        // Robust price handling: handle string/number inputs and varied field names
        const priceValue = (item as any).price || item.unitPrice || (item as any).__effectiveUnitPrice || '0';
        const validPrice = typeof priceValue === 'string' ? priceValue : String(priceValue);

        const [orderItem] = await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: validPrice,
          total: (Number(validPrice) * item.quantity).toFixed(2), // Ensure total is calculated
          modifications: item.modifications,
        }).returning();

        // Load product to determine product type
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (!product) throw new Error(`Product ${item.productId} not found`);

        if (product.type === 'finished_good') {
          // Atomic update: decrement stock only if enough
          const needed = item.quantity;
          const updateSql = sql`UPDATE ${products} SET stock_quantity = stock_quantity - ${needed}::numeric, updated_at = now() WHERE id = ${item.productId} AND stock_quantity >= ${needed} RETURNING stock_quantity`;
          // @ts-ignore - use raw execute
          const result: any = await tx.execute(updateSql);
          if (!Array.isArray(result) || (result.length === 0)) {
            throw new Error(`Insufficient stock for product ${product.name}`);
          }
          const newQty = result[0].stock_quantity;
          await tx.insert(inventoryLog).values({
            type: 'product',
            itemId: product.id,
            action: 'sale',
            quantityChange: String(-needed),
            previousQuantity: String((product.stockQuantity ?? 0)),
            newQuantity: String(newQty),
            userId,
            reason: `Sale - Order #${newOrder.orderNumber}`,
          });
        } else {
          // Component-based product - deduct product components
          if (!productComponentCache[item.productId]) {
            productComponentCache[item.productId] = await tx.select().from(productComponents).where(eq(productComponents.productId, item.productId));
          }
          const pcList = productComponentCache[item.productId] || [];
          for (const pc of pcList) {
            if (pc.isOptional && !((item as any).__selectedOptionalIngredientIds || []).includes(pc.id)) continue;
            const perUnitQty = parseFloat(String(pc.quantity || '0'));
            if (isNaN(perUnitQty) || perUnitQty <= 0) continue;
            const totalQty = perUnitQty * item.quantity;
            // Atomic component decrement
            // read previous component stock
            const [componentRow] = await tx.select().from(components).where(eq(components.id, pc.componentId));
            if (!componentRow) {
              throw new Error(`Component ${pc.componentId} not found`);
            }
            const prevStock = Number(componentRow.stockQuantity);
            const updateSql = sql`UPDATE ${components} SET stock_quantity = (stock_quantity::numeric - ${String(totalQty)})::numeric, updated_at = now() WHERE id = ${pc.componentId} AND stock_quantity >= ${String(totalQty)}::numeric RETURNING stock_quantity`;
            const result: any = await tx.execute(updateSql);
            if (!Array.isArray(result) || result.length === 0) {
              throw new Error(`Insufficient component stock for ${pc.componentId} used by product ${product.name}`);
            }
            const newQty = result[0].stock_quantity;
            await tx.insert(inventoryLog).values({
              type: 'component',
              itemId: pc.componentId,
              action: 'sale',
              quantityChange: String(-totalQty),
              previousQuantity: String(prevStock),
              newQuantity: String(newQty),
              userId,
              reason: `Sale - Order #${newOrder.orderNumber} - ${product.name}`,
            });
          }
        }

        // Attach any selected option IDs to order item (if options are present)
        if (ENABLE_OPTIONS_SYSTEM && (item as any).__resolvedOptionIds && (item as any).__resolvedOptionIds.length) {
          for (const optId of (item as any).__resolvedOptionIds) {
            await tx.insert(orderItemOptions).values({
              orderItemId: orderItem.id,
              optionId: String(optId),
              priceAdjust: String('0')
            });
          }
        }
      }

      // If sentToFulfillment is true, create an activity log entry (audit)
      if ((order as any).sentToFulfillment) {
        await tx.insert(activityLog).values({
          userId,
          action: 'send_to_fulfillment',
          success: true,
          details: { orderId: newOrder.id, orderNumber: newOrder.orderNumber },
        });
      }

      return newOrder;
    });

    return createdOrder;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order> {
    // Explicitly select allowed fields to avoid passing invalid columns
    const updateData: any = {};
    if (order.customerName !== undefined) updateData.customerName = order.customerName;
    if (order.customerPhone !== undefined) updateData.customerPhone = order.customerPhone;
    if (order.status !== undefined) updateData.status = order.status;
    if (order.notes !== undefined) updateData.notes = order.notes;
    // Explicitly handle Numeric fields ensuring they are Strings/Decimals
    if (order.subtotal !== undefined) updateData.subtotal = String(order.subtotal);
    if (order.total !== undefined) updateData.total = String(order.total);
    if (order.discountTotal !== undefined) updateData.discountTotal = String(order.discountTotal);

    // Only update if there is data
    if (Object.keys(updateData).length === 0) {
      // Just return current order if no fields to update
      const [current] = await db.select().from(orders).where(eq(orders.id, id));
      return current;
    }

    const [updatedOrder] = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async updateOrderTransaction(orderId: string, orderData: Partial<InsertOrder>, items: InsertOrderItem[], userId: string): Promise<Order> {
    return await db.transaction(async (tx: any) => {
      const [existingOrder] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!existingOrder) throw new Error("Order not found");

      // 1. Fetch old items and restore stock
      const oldItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      await adjustStockForOrderItems(tx, oldItems, existingOrder.orderNumber, userId, `Order Update (Restore Old) - Order #${existingOrder.orderNumber}`, true);

      // 2. Delete old items and their options, if any options system exists we delete orderItemOptions
      if (ENABLE_OPTIONS_SYSTEM) {
        const itemIds = oldItems.map((i: any) => i.id);
        if (itemIds.length > 0) {
          await tx.delete(orderItemOptions).where(inArray(orderItemOptions.orderItemId, itemIds));
        }
      }
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

      // 3. Update main order
      const updateData: any = {};
      if (orderData.customerName !== undefined) updateData.customerName = orderData.customerName;
      if (orderData.customerPhone !== undefined) updateData.customerPhone = orderData.customerPhone;
      if (orderData.status !== undefined) updateData.status = orderData.status;
      if (orderData.notes !== undefined) updateData.notes = orderData.notes;
      if (orderData.subtotal !== undefined) updateData.subtotal = String(orderData.subtotal);
      if (orderData.total !== undefined) updateData.total = String(orderData.total);
      if (orderData.discountTotal !== undefined) updateData.discountTotal = String(orderData.discountTotal);

      let updatedOrder = existingOrder;
      if (Object.keys(updateData).length > 0) {
        const [res] = await tx
          .update(orders)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(orders.id, orderId))
          .returning();
        updatedOrder = res;
      }

      // 4. Create new items and deduct stock
      for (const item of items) {
        const priceValue = (item as any).price || item.unitPrice || (item as any).__effectiveUnitPrice || '0';
        const validPrice = typeof priceValue === 'string' ? priceValue : String(priceValue);

        const [orderItem] = await tx.insert(orderItems).values({
          orderId: updatedOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: validPrice,
          total: (Number(validPrice) * item.quantity).toFixed(2),
          modifications: item.modifications,
        }).returning();

        if (ENABLE_OPTIONS_SYSTEM && (item as any).__resolvedOptionIds && (item as any).__resolvedOptionIds.length) {
          for (const optId of (item as any).__resolvedOptionIds) {
            await tx.insert(orderItemOptions).values({
              orderItemId: orderItem.id,
              optionId: String(optId),
              priceAdjust: String('0')
            });
          }
        }

        // Transfer __selectedOptionalIngredientIds for stock deduction
        if ((item as any).__selectedOptionalIngredientIds) {
          orderItem.__selectedOptionalIngredientIds = (item as any).__selectedOptionalIngredientIds;
        }
      }

      const newlyInsertedItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      // Patch newlyInsertedItems with __selectedOptionalIngredientIds from input items to deduction works
      for (const ni of newlyInsertedItems) {
        const matchingInput = items.find((i: any) => i.productId === ni.productId && i.quantity === ni.quantity && i.modifications === ni.modifications);
        if (matchingInput && (matchingInput as any).__selectedOptionalIngredientIds) {
          (ni as any).__selectedOptionalIngredientIds = (matchingInput as any).__selectedOptionalIngredientIds;
        }
      }

      await adjustStockForOrderItems(tx, newlyInsertedItems, updatedOrder.orderNumber, userId, `Order Update (Deduct New) - Order #${updatedOrder.orderNumber}`, false);

      return updatedOrder;
    });
  }

  async deleteOrder(id: string, userId?: string): Promise<void> {
    await db.transaction(async (tx: any) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!order) return;

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));

      if (userId) {
        await adjustStockForOrderItems(tx, items, order.orderNumber, userId, `Order Deleted - Order #${order.orderNumber}`, true);
      }

      if (ENABLE_OPTIONS_SYSTEM && items.length > 0) {
        const itemIds = items.map((i: any) => i.id);
        await tx.delete(orderItemOptions).where(inArray(orderItemOptions.orderItemId, itemIds));
      }

      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      await tx.delete(orders).where(eq(orders.id, id));
    });
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return db.select().from(orders)
      .where(or(eq(orders.cashierId, userId), eq(orders.technicianId, userId), eq(orders.courierId, userId)))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        total: orderItems.total,
        modifications: orderItems.modifications,
        product: {
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          forTechnician: products.requiresFulfillment,
          type: products.type
        }
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return items as any;
  }

  async archiveReadyOrdersOlderThan(minutes: number): Promise<string[]> {
    const result = await db.execute(sql`
      UPDATE ${orders}
      SET archived = TRUE
      WHERE archived = FALSE
      AND status = 'ready'
      AND (
        (called_at IS NOT NULL AND called_at <= now() - (${minutes} * INTERVAL '1 minute'))
        OR (ready_at IS NOT NULL AND ready_at <= now() - (${minutes} * INTERVAL '1 minute'))
      )
      RETURNING id;
    `);
    // result returns rows with id: return array of ids
    if (!Array.isArray(result)) return [];
    return result.map((r: any) => r.id as string);
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db.insert(orderItems).values(orderItem).returning();
    return newOrderItem;
  }

  async deleteOrderItems(orderId: string): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async getNextOrderNumber(): Promise<number> {
    const [result] = await db
      .select({ maxNumber: sql<number>`COALESCE(MAX(${orders.orderNumber}), 0)` })
      .from(orders);
    return (result?.maxNumber || 0) + 1;
  }

  // Inventory operations
  async getLowStockProducts(): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.stockQuantity} <= ${products.minThreshold}`
        )
      )
      .orderBy(asc(products.stockQuantity));
  }

  async getLowStockComponents(): Promise<Component[]> {
    return db
      .select()
      .from(components)
      .where(
        and(
          eq(components.isActive, true),
          sql`${components.stockQuantity} <= ${components.minThreshold}`
        )
      )
      .orderBy(asc(components.stockQuantity));
  }

  async createInventoryLog(log: InsertInventoryLog): Promise<InventoryLog> {
    const [newLog] = await db.insert(inventoryLog).values(log).returning();
    return newLog;
  }

  async getInventoryLogs(limit = 100): Promise<InventoryLog[]> {
    return db.select().from(inventoryLog).orderBy(desc(inventoryLog.createdAt)).limit(limit);
  }

  // Analytics operations
  async getTodaysSales(): Promise<{ total: number; count: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, today),
          or(eq(orders.status, 'delivered'), eq(orders.status, 'ready'))
        )
      );

    return {
      total: parseFloat(String(result?.total || 0)),
      count: result?.count || 0
    };
  }

  async getTopProducts(limit = 10): Promise<Array<{ product: Product; sales: number; revenue: number }>> {
    const result = await db
      .select({
        product: products,
        sales: sql<number>`SUM(${orderItems.quantity})`,
        revenue: sql<number>`SUM(${orderItems.total})`
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          gte(orders.createdAt, sql`CURRENT_DATE`),
          or(eq(orders.status, 'delivered'), eq(orders.status, 'ready'))
        )
      )
      .groupBy(products.id)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(limit);

    return result.map((row: any) => ({
      product: row.product,
      sales: row.sales || 0,
      revenue: parseFloat(String(row.revenue || 0))
    }));
  }

  async getSalesData(days: number): Promise<Array<{ date: string; sales: number; orders: number }>> {
    const result = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        sales: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        orders: sql<number>`COUNT(*)`
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, sql`CURRENT_DATE - make_interval(days => ${days})`),
          or(eq(orders.status, 'delivered'), eq(orders.status, 'ready'))
        )
      )
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    return result.map((row: any) => ({
      date: row.date,
      sales: parseFloat(String(row.sales || 0)),
      orders: row.orders || 0
    }));
  }

  // Gamification operations
  async getPerformanceMetrics(userId: string, month?: number, year?: number): Promise<PerformanceMetrics | undefined> {
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const [metrics] = await db
      .select()
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.userId, userId),
          eq(performanceMetrics.month, targetMonth),
          eq(performanceMetrics.year, targetYear)
        )
      );

    return metrics;
  }

  async upsertPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const [result] = await db
      .insert(performanceMetrics)
      .values(metrics)
      .onConflictDoUpdate({
        target: [performanceMetrics.userId, performanceMetrics.month, performanceMetrics.year],
        set: {
          ...metrics,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  async getLeaderboard(month: number, year: number, limit = 20): Promise<Array<MonthlyLeaderboard & { user: User }>> {
    const result = await db
      .select({
        id: monthlyLeaderboard.id,
        month: monthlyLeaderboard.month,
        year: monthlyLeaderboard.year,
        userId: monthlyLeaderboard.userId,
        position: monthlyLeaderboard.position,
        totalScore: monthlyLeaderboard.totalScore,
        totalOrders: monthlyLeaderboard.totalOrders,
        totalSales: monthlyLeaderboard.totalSales,
        createdAt: monthlyLeaderboard.createdAt,
        user: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role
        }
      })
      .from(monthlyLeaderboard)
      .innerJoin(users, eq(monthlyLeaderboard.userId, users.id))
      .where(
        and(
          eq(monthlyLeaderboard.month, month),
          eq(monthlyLeaderboard.year, year)
        )
      )
      .orderBy(asc(monthlyLeaderboard.position))
      .limit(limit);

    return result as any;
  }

  async updateLeaderboard(month: number, year: number): Promise<void> {
    // Get all performance metrics for the month and calculate rankings
    const metrics = await db
      .select({
        userId: performanceMetrics.userId,
        totalScore: performanceMetrics.totalScore,
        totalOrders: performanceMetrics.totalOrders,
        totalSales: performanceMetrics.totalSales
      })
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.month, month),
          eq(performanceMetrics.year, year)
        )
      )
      .orderBy(desc(performanceMetrics.totalScore));

    // Clear existing leaderboard for this month
    await db
      .delete(monthlyLeaderboard)
      .where(
        and(
          eq(monthlyLeaderboard.month, month),
          eq(monthlyLeaderboard.year, year)
        )
      );

    // Insert new leaderboard entries
    if (metrics.length > 0) {
      const leaderboardEntries = metrics.map((metric: any, index: any) => ({
        month,
        year,
        userId: metric.userId,
        position: index + 1,
        totalScore: metric.totalScore,
        totalOrders: metric.totalOrders,
        totalSales: metric.totalSales
      }));

      await db.insert(monthlyLeaderboard).values(leaderboardEntries);
    }
  }

  // Achievement operations
  async getAchievements(): Promise<Achievement[]> {
    return db
      .select()
      .from(achievements)
      .where(eq(achievements.isActive, true))
      .orderBy(asc(achievements.points));
  }

  async getUserAchievements(userId: string): Promise<Array<UserAchievement & { achievement: Achievement }>> {
    const result = await db
      .select({
        id: userAchievements.id,
        userId: userAchievements.userId,
        achievementId: userAchievements.achievementId,
        earnedAt: userAchievements.earnedAt,
        notified: userAchievements.notified,
        achievement: {
          id: achievements.id,
          name: achievements.name,
          description: achievements.description,
          type: achievements.type,
          icon: achievements.icon,
          points: achievements.points
        }
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.earnedAt));

    return result as any;
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [newAchievement] = await db.insert(achievements).values(achievement).returning();
    return newAchievement;
  }

  async awardAchievement(userId: string, achievementId: string): Promise<UserAchievement> {
    // Check if achievement already earned
    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId)
        )
      );

    if (existing) {
      return existing;
    }

    const [newUserAchievement] = await db
      .insert(userAchievements)
      .values({
        userId,
        achievementId,
        notified: false
      })
      .returning();

    return newUserAchievement;
  }

  async checkAndAwardAchievements(userId: string, orderData?: any): Promise<UserAchievement[]> {
    const newAchievements: UserAchievement[] = [];

    // Get user's current metrics
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const metrics = await this.getPerformanceMetrics(userId, month, year);
    if (!metrics) return newAchievements;

    // Check for "First Order" achievement
    if (metrics.totalOrders === 1) {
      try {
        const achievement = await this.awardAchievement(userId, 'first-order-achievement');
        newAchievements.push(achievement);
      } catch (error) {
        // Achievement might already exist
      }
    }

    // Check for "Speed Demon" achievement (average order time < 2 minutes)
    if (metrics.totalOrders >= 10 && metrics.averageOrderTime && parseFloat(metrics.averageOrderTime) < 2.0) {
      try {
        const achievement = await this.awardAchievement(userId, 'speed-demon-achievement');
        newAchievements.push(achievement);
      } catch (error) {
        // Achievement might already exist
      }
    }

    // Check for "Sales Champion" achievement (monthly sales > $1000)
    if (parseFloat(metrics.totalSales) >= 1000) {
      try {
        const achievement = await this.awardAchievement(userId, 'sales-champion-achievement');
        newAchievements.push(achievement);
      } catch (error) {
        // Achievement might already exist
      }
    }

    // Check for "Accuracy Ace" achievement (accuracy rate >= 95%)
    if (metrics.accuracyRate && parseFloat(metrics.accuracyRate) >= 95.0) {
      try {
        const achievement = await this.awardAchievement(userId, 'accuracy-ace-achievement');
        newAchievements.push(achievement);
      } catch (error) {
        // Achievement might already exist
      }
    }

    // Check for "Tutorial Graduate" achievement
    if (metrics.tutorialModulesCompleted >= 4) {
      try {
        const achievement = await this.awardAchievement(userId, 'tutorial-graduate-achievement');
        newAchievements.push(achievement);
      } catch (error) {
        // Achievement might already exist
      }
    }

    return newAchievements;
  }

  // Currency management methods
  async getCurrencyRates(): Promise<CurrencyRate[]> {
    try {
      return db.select().from(currencyRates).where(eq((currencyRates as any).isActive, true)).orderBy(desc(currencyRates.updatedAt));
    } catch (e) {
      // Fallback if is_active column does not exist yet
      return db.select().from(currencyRates).orderBy(desc(currencyRates.updatedAt));
    }
  }

  async getCurrentExchangeRate(fromCurrency: string = 'USD', toCurrency: string = 'LBP'): Promise<CurrencyRate | null> {
    // Use raw SQL to avoid any ambiguity with aliased columns
    try {
      if (rawClient) {
        const rows = await rawClient`SELECT id, base_currency as fromCurrency, target_currency as toCurrency, rate, updated_by as updatedBy, is_active as isActive, created_at as createdAt, updated_at as updatedAt
          FROM currency_rates
          WHERE base_currency = ${fromCurrency} AND target_currency = ${toCurrency} AND is_active = true
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1`;
        if (rows.length > 0) return rows[0] as CurrencyRate;
        const fallback = await rawClient`SELECT id, base_currency as fromCurrency, target_currency as toCurrency, rate, updated_by as updatedBy, true as isActive, created_at as createdAt, updated_at as updatedAt
          FROM currency_rates
          WHERE base_currency = ${fromCurrency} AND target_currency = ${toCurrency}
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1`;
        return fallback.length ? (fallback[0] as CurrencyRate) : null;
      }
      // Fallback to drizzle path if rawClient not available
      const [rate] = await db
        .select()
        .from(currencyRates)
        .where(and(eq(currencyRates.fromCurrency, fromCurrency), eq(currencyRates.toCurrency, toCurrency)))
        .orderBy(desc(currencyRates.updatedAt))
        .limit(1);
      return rate || null;
    } catch (e: any) {
      console.error('[currency] query failure', e?.message || e);
      return null;
    }
  }

  async updateCurrencyRate(rateData: InsertCurrencyRate): Promise<CurrencyRate> {
    try {
      await db
        .update(currencyRates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(currencyRates.fromCurrency, rateData.fromCurrency || 'USD'),
            eq(currencyRates.toCurrency, rateData.toCurrency || 'LBP'),
            eq((currencyRates as any).isActive, true)
          )
        );
    } catch (e) {
      // Table may not have is_active; ignore
    }

    const [newRate] = await db.insert(currencyRates).values({
      ...rateData,
      isActive: true,
    } as any).returning();

    return newRate;
  }

  async getCurrencyRateHistory(limit: number = 10): Promise<CurrencyRate[]> {
    return db
      .select()
      .from(currencyRates)
      .orderBy(desc(currencyRates.updatedAt))
      .limit(limit);
  }

  async getShiftReport(shiftId: string): Promise<any> {
    const [shift] = await db
      .select({
        shift: shifts,
        user: users
      })
      .from(shifts)
      .leftJoin(users, eq(shifts.userId, users.id))
      .where(eq(shifts.id, shiftId));

    if (!shift) throw new Error("Shift not found");

    const endTime = shift.shift.endTime || new Date();

    // Get product breakdown
    const items = await db
      .select({
        productId: products.id,
        productName: products.name,
        category: categories.name,
        quantity: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.total})`
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(orders.cashierId, shift.shift.userId), // Match orders to the cashier who owns the shift
          gte(orders.createdAt, shift.shift.startTime),
          lte(orders.createdAt, endTime)
        )
      )
      .groupBy(products.id, products.name, categories.name)
      .orderBy(desc(sql`sum(${orderItems.total})`));

    // Calculate summary stats for single report
    const [summary] = await db
      .select({
        totalSales: sql<number>`coalesce(sum(${orders.total}), 0)`,
        totalOrders: sql<number>`count(${orders.id})`,
        cashCollected: sql<number>`coalesce(sum(case when ${orders.paymentMethod} = 'cash' then ${orders.total} else 0 end), 0)`,
        cardCollected: sql<number>`coalesce(sum(case when ${orders.paymentMethod} != 'cash' then ${orders.total} else 0 end), 0)`
      })
      .from(orders)
      .where(
        and(
          eq(orders.cashierId, shift.shift.userId), // Match orders to the cashier who owns the shift
          gte(orders.createdAt, shift.shift.startTime),
          lte(orders.createdAt, endTime),
          ne(orders.status, 'cancelled')
        )
      );

    return {
      shift: {
        ...shift.shift,
        totalSales: Number(summary?.totalSales || 0),
        totalOrders: Number(summary?.totalOrders || 0),
        cashCollected: Number(summary?.cashCollected || 0),
        cardCollected: Number(summary?.cardCollected || 0),
        expectedCash: Number(summary?.cashCollected || 0)
      },
      user: shift.user,
      productBreakdown: items
    };
  }

  // Shift management implementation
  async getShifts(): Promise<Array<Shift & { user: User }>> {
    return db
      .select()
      .from(shifts)
      .leftJoin(users, eq(shifts.userId, users.id))
      .orderBy(desc(shifts.startTime))
      .then((rows: any) =>
        rows.map((row: any) => ({
          ...row.shifts,
          user: row.users!
        }))
      );
  }

  async getActiveShifts(): Promise<Array<Shift & { user: User }>> {
    return db
      .select()
      .from(shifts)
      .leftJoin(users, eq(shifts.userId, users.id))
      .where(eq(shifts.isActive, true))
      .orderBy(desc(shifts.startTime))
      .then((rows: any) =>
        rows.map((row: any) => ({
          ...row.shifts,
          user: row.users!
        }))
      );
  }

  async getUserShifts(userId: string): Promise<Shift[]> {
    return db
      .select()
      .from(shifts)
      .where(eq(shifts.userId, userId))
      .orderBy(desc(shifts.startTime));
  }

  async startShift(userId: string, notes?: string): Promise<Shift> {
    // First check if user already has an active shift
    const [existingShift] = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.userId, userId),
          eq(shifts.isActive, true)
        )
      );

    if (existingShift) {
      throw new Error("User already has an active shift");
    }

    const [shift] = await db
      .insert(shifts)
      .values({
        userId,
        notes,
        isActive: true,
      })
      .returning();

    return shift;
  }

  async endShift(shiftId: string, notes?: string): Promise<Shift> {
    const [shift] = await db
      .update(shifts)
      .set({
        endTime: new Date(),
        notes,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    if (!shift) {
      throw new Error("Shift not found");
    }

    return shift;
  }

  async updateShiftSales(shiftId: string, amount: number, paymentMethod: string): Promise<void> {
    const updateData: any = { updatedAt: new Date() };

    if (paymentMethod === 'cash') {
      updateData.cashCollected = sql<string>`${shifts.cashCollected} + ${amount}`;
    } else {
      updateData.cardCollected = sql<string>`${shifts.cardCollected} + ${amount}`;
    }

    updateData.totalSales = sql<string>`${shifts.totalSales} + ${amount}`;
    updateData.totalOrders = sql<number>`${shifts.totalOrders} + 1`;

    await db
      .update(shifts)
      .set(updateData)
      .where(eq(shifts.id, shiftId));
  }

  async getShiftReports(params: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    role?: string;
  }): Promise<any[]> {
    let query = db
      .select({
        shift: shifts,
        user: users,
      })
      .from(shifts)
      .leftJoin(users, eq(shifts.userId, users.id));

    const conditions = [];

    if (params.userId) {
      conditions.push(eq(shifts.userId, params.userId));
    }

    if (params.startDate) {
      conditions.push(gte(shifts.startTime, new Date(params.startDate)));
    }

    if (params.endDate) {
      conditions.push(lte(shifts.startTime, new Date(params.endDate)));
    }

    if (params.role) {
      conditions.push(eq(users.role, params.role as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const shiftsData = await query.orderBy(desc(shifts.startTime));

    // Hydrate with real-time order data
    const results = await Promise.all(shiftsData.map(async (row: { shift: Shift; user: User | null }) => {
      const shift = row.shift;
      const endTime = shift.endTime || new Date();

      const [summary] = await db
        .select({
          totalSales: sql<number>`coalesce(sum(${orders.total}), 0)`,
          totalOrders: sql<number>`count(${orders.id})`,
          cashCollected: sql<number>`coalesce(sum(case when ${orders.paymentMethod} = 'cash' then ${orders.total} else 0 end), 0)`,
          cardCollected: sql<number>`coalesce(sum(case when ${orders.paymentMethod} != 'cash' then ${orders.total} else 0 end), 0)`
        })
        .from(orders)
        .where(
          and(
            eq(orders.cashierId, shift.userId),
            gte(orders.createdAt, shift.startTime),
            lte(orders.createdAt, endTime),
            ne(orders.status, 'cancelled')
          )
        );

      return {
        shift: {
          ...shift,
          totalSales: Number(summary?.totalSales || 0),
          totalOrders: Number(summary?.totalOrders || 0),
          cashCollected: Number(summary?.cashCollected || 0),
          cardCollected: Number(summary?.cardCollected || 0),
          expectedCash: Number(summary?.cashCollected || 0), // Future: + Float - Drops
        },
        user: row.user
      };
    }));

    return results;
  }

  async getPerformanceReports(params: {
    date?: string;
    role?: string;
  }): Promise<any[]> {
    // 1. Get Shifts Data (Count and Hours)
    let shiftQuery = db
      .select({
        userId: users.id,
        user: users,
        totalShifts: sql<number>`count(${shifts.id})`,
        totalHours: sql<number>`sum(extract(epoch from (${shifts.endTime} - ${shifts.startTime})) / 3600)`
      })
      .from(shifts)
      .leftJoin(users, eq(shifts.userId, users.id))
      .groupBy(users.id, users.username, users.role, users.firstName, users.lastName);

    const shiftConditions = [];
    if (params.date) {
      const targetDate = new Date(params.date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      shiftConditions.push(and(gte(shifts.startTime, targetDate), lte(shifts.startTime, nextDay)));
    }
    if (params.role) {
      shiftConditions.push(eq(users.role, params.role as any));
    }
    // Only include completed shifts for hours calculation, or handle active?
    // Current logic seemed to filter for completed shifts for performance reports? 
    // "conditions.push(eq(shifts.isActive, false));" was in old code. 
    // Let's keep it to ensure accurate "hours" calc.
    shiftConditions.push(eq(shifts.isActive, false));

    if (shiftConditions.length > 0) {
      shiftQuery = shiftQuery.where(and(...shiftConditions));
    }

    const shiftsResult = await shiftQuery;

    // 2. Get Sales Data from Orders (Accuracy)
    // We need to match orders to the same criteria (date, role).
    // Note: This aggregates ALL orders for the user in that time range, strictly speaking.
    // If strict shift alignment is needed, we'd need a join, but this is a good approximation for "Performance".

    let orderQuery = db
      .select({
        userId: orders.cashierId,
        totalSales: sql<number>`sum(${orders.total})`,
        totalOrders: sql<number>`count(${orders.id})`
      })
      .from(orders)
      .where(ne(orders.status, 'cancelled'))
      .groupBy(orders.cashierId);

    const orderConditions = [];
    if (params.date) {
      const targetDate = new Date(params.date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      orderConditions.push(and(gte(orders.createdAt, targetDate), lte(orders.createdAt, nextDay)));
    }
    // Role filter on orders table requires join, so we skip it here and filter by merging with shiftsResult.

    if (orderConditions.length > 0) {
      orderQuery = orderQuery.where(and(...orderConditions, ne(orders.status, 'cancelled')));
    }

    const ordersResult = await orderQuery;
    const ordersMap = new Map(ordersResult.map((o: any) => [o.userId, o]));

    // 3. Merge
    const combined = shiftsResult.map((res: any) => {
      const orderStats = ordersMap.get(res.userId) as { totalSales: unknown; totalOrders: unknown } | undefined;
      const totalSales = Number(orderStats?.totalSales || 0);
      const totalOrders = Number(orderStats?.totalOrders || 0);
      const totalShifts = Number(res.totalShifts || 0);

      return {
        user: res.user,
        totalShifts: totalShifts,
        totalHours: Number(res.totalHours || 0),
        totalSales: totalSales,
        totalOrders: totalOrders,
        avgSalesPerShift: totalShifts > 0 ? totalSales / totalShifts : 0,
        avgOrdersPerShift: totalShifts > 0 ? totalOrders / totalShifts : 0
      };
    });

    return combined.sort((a: any, b: any) => b.totalSales - a.totalSales);
  }
  // ---------------- Option System (flag gated) ----------------
  private ensureOptionsEnabled() {
    if (!ENABLE_OPTIONS_SYSTEM) {
      throw new Error('Option system disabled');
    }
  }

  // Option Groups
  async getOptionGroups(): Promise<OptionGroup[]> {
    if (!ENABLE_OPTIONS_SYSTEM) return [];
    return db.select().from(optionGroups).where(eq(optionGroups.isActive, true)).orderBy(asc(optionGroups.name));
  }

  async getOptionGroup(id: string): Promise<OptionGroup | undefined> {
    if (!ENABLE_OPTIONS_SYSTEM) return undefined;
    const [row] = await db.select().from(optionGroups).where(eq(optionGroups.id, id));
    return row;
  }

  async createOptionGroup(data: InsertOptionGroup): Promise<OptionGroup> {
    this.ensureOptionsEnabled();
    const [row] = await db.insert(optionGroups).values(data).returning();
    return row;
  }

  async updateOptionGroup(id: string, data: Partial<InsertOptionGroup>): Promise<OptionGroup> {
    this.ensureOptionsEnabled();
    const [row] = await db.update(optionGroups).set(data).where(eq(optionGroups.id, id)).returning();
    if (!row) throw new Error('Option group not found');
    return row;
  }

  async deleteOptionGroup(id: string): Promise<void> {
    this.ensureOptionsEnabled();
    await db.update(optionGroups).set({ isActive: false }).where(eq(optionGroups.id, id));
  }

  // Product <-> Option Group mapping
  async getProductOptionGroups(productId: string): Promise<Array<ProductOptionGroup & { group: OptionGroup; options: Option[] }>> {
    if (!ENABLE_OPTIONS_SYSTEM) return [];
    // Fetch mappings + groups
    const mappings = await db
      .select({
        mapping: productOptionGroups,
        group: optionGroups
      })
      .from(productOptionGroups)
      .innerJoin(optionGroups, eq(productOptionGroups.optionGroupId, optionGroups.id))
      .where(and(eq(productOptionGroups.productId, productId), eq(optionGroups.isActive, true)))
      .orderBy(asc(productOptionGroups.displayOrder));

    if (mappings.length === 0) return [] as any;

    // Fetch options for all groups in one query
    const groupIds = mappings.map((m: any) => m.group.id);
    const optionRows = await db
      .select()
      .from(optionTable)
      .where(and(sql`${optionTable.optionGroupId} = ANY(${groupIds})`, eq(optionTable.isActive, true as any)))
      .orderBy(asc(optionTable.displayOrder));

    const byGroup: Record<string, Option[]> = {};
    for (const opt of optionRows as any) {
      (byGroup[opt.optionGroupId] ||= []).push(opt);
    }

    return mappings.map((m: any) => ({
      ...m.mapping,
      group: m.group,
      options: byGroup[m.group.id] || []
    })) as any;
  }

  async attachOptionGroupToProduct(data: InsertProductOptionGroup): Promise<ProductOptionGroup> {
    this.ensureOptionsEnabled();
    const [row] = await db.insert(productOptionGroups).values(data).returning();
    return row;
  }

  async detachOptionGroupFromProduct(id: string): Promise<void> {
    this.ensureOptionsEnabled();
    await db.delete(productOptionGroups).where(eq(productOptionGroups.id, id));
  }

  // Options
  async getOptions(groupId: string): Promise<Option[]> {
    if (!ENABLE_OPTIONS_SYSTEM) return [];
    return db.select().from(optionTable).where(and(eq(optionTable.optionGroupId, groupId), eq(optionTable.isActive, true))).orderBy(asc(optionTable.displayOrder));
  }

  async getOption(id: string): Promise<Option | undefined> {
    if (!ENABLE_OPTIONS_SYSTEM) return undefined;
    const [row] = await db.select().from(optionTable).where(eq(optionTable.id, id));
    return row;
  }

  async createOption(data: InsertOption): Promise<Option> {
    this.ensureOptionsEnabled();
    const [row] = await db.insert(optionTable).values(data).returning();
    return row;
  }

  async updateOption(id: string, data: Partial<InsertOption>): Promise<Option> {
    this.ensureOptionsEnabled();
    const [row] = await db.update(optionTable).set(data).where(eq(optionTable.id, id)).returning();
    if (!row) throw new Error('Option not found');
    return row;
  }

  async deleteOption(id: string): Promise<void> {
    this.ensureOptionsEnabled();
    await db.update(optionTable).set({ isActive: false }).where(eq(optionTable.id, id));
  }

  // Option Components
  async getOptionComponents(optionId: string): Promise<OptionComponent[]> {
    if (!ENABLE_OPTIONS_SYSTEM) return [];
    return db.select().from(optionComponents).where(eq(optionComponents.optionId, optionId));
  }

  async addOptionComponent(data: InsertOptionComponent): Promise<OptionComponent> {
    this.ensureOptionsEnabled();
    const [row] = await db.insert(optionComponents).values(data).returning();
    return row;
  }

  async deleteOptionComponent(id: string): Promise<void> {
    this.ensureOptionsEnabled();
    await db.delete(optionComponents).where(eq(optionComponents.id, id));
  }

  async getOrderItemOptions(orderItemId: string): Promise<OrderItemOption[]> {
    if (!ENABLE_OPTIONS_SYSTEM) return [];
    return db.select().from(orderItemOptions).where(eq(orderItemOptions.orderItemId, orderItemId));
  }

  async createOrderItemOption(data: InsertOrderItemOption): Promise<OrderItemOption> {
    this.ensureOptionsEnabled();
    const [row] = await db.insert(orderItemOptions).values(data).returning();
    return row;
  }

  async getOptionsByIds(ids: string[]): Promise<Option[]> {
    if (!ENABLE_OPTIONS_SYSTEM || ids.length === 0) return [];
    return db.select().from(optionTable).where(inArray(optionTable.id, ids));
  }

  async getOptionComponentsByOptionIds(optionIds: string[]): Promise<OptionComponent[]> {
    if (!ENABLE_OPTIONS_SYSTEM || optionIds.length === 0) return [];
    return db.select().from(optionComponents).where(inArray(optionComponents.optionId, optionIds));
  }

  private async hydrateFavoriteCombos(combos: FavoriteCombo[]): Promise<FavoriteComboWithItems[]> {
    if (combos.length === 0) return [];

    const comboIds = combos.map((combo) => combo.id);
    const comboItems = await db
      .select()
      .from(favoriteComboItems)
      .where(inArray(favoriteComboItems.comboId, comboIds))
      .orderBy(asc(favoriteComboItems.createdAt));
    // Drizzle returns unknown[] by default — cast to strongly-typed FavoriteComboItem[]
    const typedComboItems = comboItems as FavoriteComboItem[];

    const productIds = Array.from(new Set(typedComboItems.map((item) => item.productId))) as string[];
    const productsMap = new Map<string, Product>();
    if (productIds.length > 0) {
      const productRows = await db
        .select()
        .from(products)
        .where(inArray(products.id, productIds));
      for (const product of productRows) {
        productsMap.set(product.id, product);
      }
    }

    const groupedItems = new Map<string, Array<FavoriteComboItem & { product?: Product | null }>>();
    for (const combo of combos) {
      groupedItems.set(combo.id, []);
    }

    for (const item of typedComboItems) {
      const bucket = groupedItems.get(item.comboId);
      if (bucket) {
        bucket.push({ ...item, product: productsMap.get(item.productId) });
      }
    }

    return combos.map((combo) => ({
      ...combo,
      items: groupedItems.get(combo.id) ?? [],
    }));
  }

  async getFavoriteCombos(includeInactive = false): Promise<FavoriteComboWithItems[]> {
    let comboQuery = db.select().from(favoriteCombos);
    if (!includeInactive) {
      comboQuery = comboQuery.where(eq(favoriteCombos.isActive, true));
    }
    comboQuery = comboQuery.orderBy(asc(favoriteCombos.displayOrder), asc(favoriteCombos.name));
    const rows = await comboQuery;
    return this.hydrateFavoriteCombos(rows);
  }

  async createFavoriteCombo(
    data: InsertFavoriteCombo,
    items: Array<{ productId: string; quantity: number }>
  ): Promise<FavoriteComboWithItems> {
    if (!items || items.length === 0) {
      throw new Error('Favorite combo requires at least one product');
    }
    const combo = await db.transaction(async (tx: any) => {
      const [created] = await tx
        .insert(favoriteCombos)
        .values({
          name: data.name,
          description: data.description,
          displayOrder: data.displayOrder ?? 0,
          isActive: data.isActive ?? true,
          updatedAt: new Date(),
        })
        .returning();

      const comboItems = items.map((item) => ({
        comboId: created.id,
        productId: item.productId,
        quantity: item.quantity,
      }));

      await tx.insert(favoriteComboItems).values(comboItems);

      return created;
    });

    const [hydrated] = await this.hydrateFavoriteCombos([combo]);
    return hydrated;
  }

  async updateFavoriteCombo(
    id: string,
    data: Partial<InsertFavoriteCombo>,
    items?: Array<{ productId: string; quantity: number }>
  ): Promise<FavoriteComboWithItems> {
    const updateValues: Record<string, any> = { updatedAt: new Date() };

    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.displayOrder !== undefined) updateValues.displayOrder = data.displayOrder;
    if (data.isActive !== undefined) updateValues.isActive = data.isActive;

    const combo = await db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(favoriteCombos)
        .set(updateValues)
        .where(eq(favoriteCombos.id, id))
        .returning();

      if (!updated) {
        throw new Error('Favorite combo not found');
      }

      if (items) {
        await tx.delete(favoriteComboItems).where(eq(favoriteComboItems.comboId, id));
        if (items.length > 0) {
          const comboItems = items.map((item) => ({
            comboId: id,
            productId: item.productId,
            quantity: item.quantity,
          }));
          await tx.insert(favoriteComboItems).values(comboItems);
        }
      }

      return updated;
    });

    const [hydrated] = await this.hydrateFavoriteCombos([combo]);
    return hydrated;
  }

  async deleteFavoriteCombo(id: string): Promise<void> {
    await db.transaction(async (tx: any) => {
      await tx.delete(favoriteComboItems).where(eq(favoriteComboItems.comboId, id));
      await tx.delete(favoriteCombos).where(eq(favoriteCombos.id, id));
    });
  }

  // Strategic Reports Implementations

  // 1. Staffing Heatmap: aggregated order counts by day and hour
  async getStaffingHeatmap(): Promise<Array<{ dayOfWeek: number; hourOfDay: number; orderCount: number }>> {
    const heatmap = await db
      .select({
        dayOfWeek: sql<number>`cast(extract(dow from ${orders.createdAt}) as int)`,
        hourOfDay: sql<number>`cast(extract(hour from ${orders.createdAt}) as int)`,
        orderCount: sql<number>`cast(count(${orders.id}) as int)`
      })
      .from(orders)
      .where(sql`${orders.status} != 'cancelled'`)
      .groupBy(
        sql`extract(dow from ${orders.createdAt})`,
        sql`extract(hour from ${orders.createdAt})`
      );
    return heatmap;
  }

  // 2. Profit & Loss: Revenue vs Estimated Cost (Current Cost Basis)
  async getProfitLoss(startDate?: Date, endDate?: Date): Promise<Array<{ date: string; revenue: number; cost: number; profit: number }>> {
    const conditions = [];
    if (startDate) conditions.push(gte(orders.createdAt, startDate));
    if (endDate) conditions.push(lte(orders.createdAt, endDate));
    conditions.push(sql`${orders.status} != 'cancelled'`);

    const whereExpr = conditions.length ? and(...conditions) : undefined;

    const revenueData = await db
      .select({
        date: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        revenue: sql<number>`sum(${orders.total})`
      })
      .from(orders)
      .where(whereExpr)
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);

    // Simple estimation for cost: sum(order_item.quantity * product.current_cost)
    const costData = await db
      .select({
        date: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        cost: sql<number>`sum(${orderItems.quantity} * coalesce(${products.costPerUnit}, 0))`
      })
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(whereExpr)
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);

    const costMap = new Map(costData.map((c: { date: string; cost: number }) => [c.date, Number(c.cost)]));

    return revenueData.map((r: { date: string; revenue: number }) => {
      const rev = Number(r.revenue);
      const cst = Number(costMap.get(r.date) || 0);
      return {
        date: r.date,
        revenue: rev,
        cost: cst,
        profit: rev - cst
      };
    });
  }

  // Custom Time-Range Report
  async getCustomReport(startTime: Date, endTime: Date): Promise<any> {
    // 1. Shift/Period Summary
    const [summary] = await db
      .select({
        totalSales: sql<number>`coalesce(sum(${orders.total}), 0)`,
        totalOrders: sql<number>`count(${orders.id})`,
        cashCollected: sql<number>`coalesce(sum(case when ${orders.paymentMethod} = 'cash' then ${orders.total} else 0 end), 0)`,
        cardCollected: sql<number>`coalesce(sum(case when ${orders.paymentMethod} != 'cash' then ${orders.total} else 0 end), 0)`
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, startTime),
          lte(orders.createdAt, endTime),
          ne(orders.status, 'cancelled')
        )
      );

    // 2. Product Breakdown
    const items = await db
      .select({
        productId: products.id,
        productName: products.name,
        category: categories.name,
        quantity: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.total})`
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          gte(orders.createdAt, startTime),
          lte(orders.createdAt, endTime),
          ne(orders.status, 'cancelled')
        )
      )
      .groupBy(products.id, products.name, categories.name)
      .orderBy(desc(sql<number>`sum(${orderItems.total})`));

    return {
      period: { startTime, endTime },
      summary: {
        totalSales: Number(summary?.totalSales || 0),
        totalOrders: Number(summary?.totalOrders || 0),
        cashCollected: Number(summary?.cashCollected || 0),
        cardCollected: Number(summary?.cardCollected || 0),
        expectedCash: Number(summary?.cashCollected || 0)
      },
      productBreakdown: items
    };
  }

  // 3. Menu Matrix: Volume vs Margin
  async getMenuMatrix(startDate?: Date, endDate?: Date): Promise<Array<{ productId: string; name: string; salesVolume: number; revenue: number; profit: number; margin: number }>> {
    const conditions = [];
    if (startDate) conditions.push(gte(orders.createdAt, startDate));
    if (endDate) conditions.push(lte(orders.createdAt, endDate));
    conditions.push(sql`${orders.status} != 'cancelled'`);

    const whereExpr = conditions.length ? and(...conditions) : undefined;

    const matrix = await db
      .select({
        productId: products.id,
        name: products.name,
        salesVolume: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.total})`,
        cost: sql<number>`sum(${orderItems.quantity} * coalesce(${products.costPerUnit}, 0))`
      })
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(whereExpr)
      .groupBy(products.id, products.name);

    return matrix.map((m: { productId: string; name: string; salesVolume: number; revenue: number; cost: number }) => {
      const vol = Number(m.salesVolume);
      const rev = Number(m.revenue);
      const cst = Number(m.cost);
      const profit = rev - cst;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;

      return {
        productId: m.productId,
        name: m.name,
        salesVolume: vol,
        revenue: rev,
        profit: profit,
        margin: margin
      };
    });
  }
}

export const storage = new DatabaseStorage();
