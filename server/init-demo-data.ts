import { storage } from "./storage";

export async function initializeDemoData() {
  console.log("🔄 Initializing demo data...");

  try {
    // Check if demo users already exist
    const existingUsers = await storage.getAllUsers();
    if (existingUsers.length > 0) {
      console.log("✅ Demo data already exists, skipping initialization");
      return;
    }

    // Create demo users
    const demoUsers = [
      {
        id: "admin",
        username: "admin",
        password: "admin123",
        email: "admin@highway-cafe.com",
        firstName: "Admin",
        lastName: "User",
        role: "admin" as const,
        isActive: true,
      },
      {
        id: "manager",
        username: "manager",
        password: "manager123",
        email: "manager@highway-cafe.com",
        firstName: "Manager",
        lastName: "User",
        role: "manager" as const,
        isActive: true,
      },
      {
        id: "cashier",
        username: "cashier",
        password: "cashier123",
        email: "cashier@highway-cafe.com",
        firstName: "Cashier",
        lastName: "User",
        role: "cashier" as const,
        isActive: true,
      },
      {
        id: "technician",
        username: "technician",
        password: "technician123",
        email: "technician@h-erp.com",
        firstName: "Technician",
        lastName: "User",
        role: "technician" as const,
        isActive: true,
      },
      {
        id: "courier",
        username: "courier",
        password: "courier123",
        email: "courier@highway-cafe.com",
        firstName: "Courier",
        lastName: "User",
        role: "courier" as const,
        isActive: true,
      },
    ];

    console.log("👥 Creating demo users...");
    for (const user of demoUsers) {
      await storage.upsertUser(user);
    }

    // Create categories
    const demoCategories = [
      {
        name: "Coffee",
        description: "Hot and cold coffee beverages",
        icon: "coffee",
      },
      {
        name: "Food",
        description: "Sandwiches, pastries, and snacks",
        icon: "utensils",
      },
      {
        name: "Beverages",
        description: "Non-coffee drinks",
        icon: "cup-soda",
      },
      {
        name: "Desserts",
        description: "Sweet treats and desserts",
        icon: "cake",
      },
    ];

    console.log("📂 Creating categories...");
    const createdCategories = [];
    for (const category of demoCategories) {
      const created = await storage.createCategory(category);
      createdCategories.push(created);
    }

    // Create components
    const demoComponents = [
      {
        name: "Coffee Beans",
        unit: "grams",
        costPerUnit: "0.02",
        stockQuantity: "5000",
        minThreshold: "500",
      },
      {
        name: "Milk",
        unit: "ml",
        costPerUnit: "0.002",
        stockQuantity: "10000",
        minThreshold: "1000",
      },
      {
        name: "Sugar",
        unit: "grams",
        costPerUnit: "0.001",
        stockQuantity: "2000",
        minThreshold: "200",
      },
      {
        name: "Vanilla Syrup",
        unit: "ml",
        costPerUnit: "0.01",
        stockQuantity: "1000",
        minThreshold: "100",
      },
      {
        name: "Bread",
        unit: "slices",
        costPerUnit: "0.30",
        stockQuantity: "50",
        minThreshold: "10",
      },
      {
        name: "Cheese",
        unit: "slices",
        costPerUnit: "0.50",
        stockQuantity: "100",
        minThreshold: "20",
      },
      {
        name: "Ham",
        unit: "slices",
        costPerUnit: "0.75",
        stockQuantity: "80",
        minThreshold: "15",
      },
    ];

    console.log("🧪 Creating components...");
    const createdComponents = [];
    for (const component of demoComponents) {
      const created = await storage.createComponent(component);
      createdComponents.push(created);
    }

    // Create products
    const coffeeCategory = createdCategories.find(c => c.name === "Coffee");
    const foodCategory = createdCategories.find(c => c.name === "Food");
    const beverageCategory = createdCategories.find(c => c.name === "Beverages");
    const dessertCategory = createdCategories.find(c => c.name === "Desserts");

    const demoProducts = [
      // Coffee products (component-based)
      {
        name: "Espresso",
        description: "Strong coffee shot",
        price: "2.50",
        categoryId: coffeeCategory?.id,
        type: "component_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      {
        name: "Cappuccino",
        description: "Espresso with steamed milk foam",
        price: "3.50",
        categoryId: coffeeCategory?.id,
        type: "component_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      {
        name: "Latte",
        description: "Espresso with steamed milk",
        price: "4.00",
        categoryId: coffeeCategory?.id,
        type: "component_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      {
        name: "Vanilla Latte",
        description: "Latte with vanilla syrup",
        price: "4.50",
        categoryId: coffeeCategory?.id,
        type: "component_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      // Food products (component-based)
      {
        name: "Ham & Cheese Sandwich",
        description: "Fresh sandwich with ham and cheese",
        price: "6.50",
        categoryId: foodCategory?.id,
        type: "component_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      // Finished goods
      {
        name: "Bottled Water",
        description: "500ml bottled water",
        price: "1.50",
        categoryId: beverageCategory?.id,
        type: "finished_good" as const,
        stockQuantity: "100",
        minThreshold: 20,
      },
      {
        name: "Orange Juice",
        description: "Fresh orange juice",
        price: "3.00",
        categoryId: beverageCategory?.id,
        type: "finished_good" as const,
        stockQuantity: "50",
        minThreshold: 10,
      },
      {
        name: "Chocolate Chip Cookie",
        description: "Homemade chocolate chip cookie",
        price: "2.00",
        categoryId: dessertCategory?.id,
        type: "finished_good" as const,
        stockQuantity: "30",
        minThreshold: 5,
      },
      {
        name: "Blueberry Muffin",
        description: "Fresh baked blueberry muffin",
        price: "2.50",
        categoryId: dessertCategory?.id,
        type: "finished_good" as const,
        stockQuantity: "25",
        minThreshold: 5,
      },
    ];

    console.log("🍕 Creating products...");
    const createdProducts = [];
    for (const product of demoProducts) {
      const created = await storage.createProduct(product);
      createdProducts.push(created);
    }

    // Create bundles for component-based products
    console.log("📝 Creating bundles...");

    const coffeeBeansId = createdComponents.find(c => c.name === "Coffee Beans")?.id;
    const milkId = createdComponents.find(c => c.name === "Milk")?.id;
    const sugarId = createdComponents.find(c => c.name === "Sugar")?.id;
    const vanillaSyrupId = createdComponents.find(c => c.name === "Vanilla Syrup")?.id;
    const breadId = createdComponents.find(c => c.name === "Bread")?.id;
    const cheeseId = createdComponents.find(c => c.name === "Cheese")?.id;
    const hamId = createdComponents.find(c => c.name === "Ham")?.id;

    const espressoProduct = createdProducts.find(p => p.name === "Espresso");
    const cappuccinoProduct = createdProducts.find(p => p.name === "Cappuccino");
    const latteProduct = createdProducts.find(p => p.name === "Latte");
    const vanillaLatteProduct = createdProducts.find(p => p.name === "Vanilla Latte");
    const sandwichProduct = createdProducts.find(p => p.name === "Ham & Cheese Sandwich");

    const bundles = [
      // Espresso bundle
      { productId: espressoProduct?.id || "", componentId: coffeeBeansId || "", quantity: "18" },

      // Cappuccino bundle
      { productId: cappuccinoProduct?.id || "", componentId: coffeeBeansId || "", quantity: "18" },
      { productId: cappuccinoProduct?.id || "", componentId: milkId || "", quantity: "150" },

      // Latte bundle
      { productId: latteProduct?.id || "", componentId: coffeeBeansId || "", quantity: "18" },
      { productId: latteProduct?.id || "", componentId: milkId || "", quantity: "200" },

      // Vanilla Latte bundle
      { productId: vanillaLatteProduct?.id || "", componentId: coffeeBeansId || "", quantity: "18" },
      { productId: vanillaLatteProduct?.id || "", componentId: milkId || "", quantity: "200" },
      { productId: vanillaLatteProduct?.id || "", componentId: vanillaSyrupId || "", quantity: "15" },

      // Ham & Cheese Sandwich bundle
      { productId: sandwichProduct?.id || "", componentId: breadId || "", quantity: "2" },
      { productId: sandwichProduct?.id || "", componentId: hamId || "", quantity: "3" },
      { productId: sandwichProduct?.id || "", componentId: cheeseId || "", quantity: "2" },
    ];

    for (const bundle of bundles) {
      if (bundle.productId && bundle.componentId) {
        await storage.createProductComponent(bundle);
      }
    }

    console.log("✅ Demo data initialization completed successfully!");
    console.log("👤 Demo users created:");
    console.log("   - admin / admin123 (Admin)");
    console.log("   - manager / manager123 (Manager)");
    console.log("   - cashier / cashier123 (Cashier)");
    console.log("   - technician / technician123 (Technician)");
    console.log("   - courier / courier123 (Courier)");

    // Initialize default currency exchange rate
    console.log("💱 Setting up currency exchange rate...");
    try {
      const existingRate = await storage.getCurrentExchangeRate();
      if (!existingRate) {
        await storage.updateCurrencyRate({
          fromCurrency: 'USD',
          toCurrency: 'LBP',
          rate: '89500.000000', // Default rate as of 2024
          updatedBy: 'admin',
        });
        console.log("✅ Default currency exchange rate set (1 USD = 89,500 LBP)");
      } else {
        console.log("✅ Currency exchange rate already exists");
      }
    } catch (error) {
      console.log("⚠️  Could not set currency rate, will be set on first admin login");
    }

  } catch (error) {
    console.error("❌ Error initializing demo data:", error);
    throw error;
  }
}