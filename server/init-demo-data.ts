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
        id: "barista",
        username: "barista",
        password: "barista123",
        email: "barista@highway-cafe.com",
        firstName: "Barista",
        lastName: "User",
        role: "barista" as const,
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

    // Create ingredients
    const demoIngredients = [
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

    console.log("🧪 Creating ingredients...");
    const createdIngredients = [];
    for (const ingredient of demoIngredients) {
      const created = await storage.createIngredient(ingredient);
      createdIngredients.push(created);
    }

    // Create products
    const coffeeCategory = createdCategories.find(c => c.name === "Coffee");
    const foodCategory = createdCategories.find(c => c.name === "Food");
    const beverageCategory = createdCategories.find(c => c.name === "Beverages");
    const dessertCategory = createdCategories.find(c => c.name === "Desserts");

    const demoProducts = [
      // Coffee products (ingredient-based)
      {
        name: "Espresso",
        description: "Strong coffee shot",
        price: "2.50",
        categoryId: coffeeCategory?.id,
        type: "ingredient_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      {
        name: "Cappuccino",
        description: "Espresso with steamed milk foam",
        price: "3.50",
        categoryId: coffeeCategory?.id,
        type: "ingredient_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      {
        name: "Latte",
        description: "Espresso with steamed milk",
        price: "4.00",
        categoryId: coffeeCategory?.id,
        type: "ingredient_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      {
        name: "Vanilla Latte",
        description: "Latte with vanilla syrup",
        price: "4.50",
        categoryId: coffeeCategory?.id,
        type: "ingredient_based" as const,
        stockQuantity: "0",
        minThreshold: 0,
      },
      // Food products (ingredient-based)
      {
        name: "Ham & Cheese Sandwich",
        description: "Fresh sandwich with ham and cheese",
        price: "6.50",
        categoryId: foodCategory?.id,
        type: "ingredient_based" as const,
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

    // Create recipes for ingredient-based products
    console.log("📝 Creating recipes...");

    const coffeeBeansId = createdIngredients.find(i => i.name === "Coffee Beans")?.id;
    const milkId = createdIngredients.find(i => i.name === "Milk")?.id;
    const sugarId = createdIngredients.find(i => i.name === "Sugar")?.id;
    const vanillaSyrupId = createdIngredients.find(i => i.name === "Vanilla Syrup")?.id;
    const breadId = createdIngredients.find(i => i.name === "Bread")?.id;
    const cheeseId = createdIngredients.find(i => i.name === "Cheese")?.id;
    const hamId = createdIngredients.find(i => i.name === "Ham")?.id;

    const espressoProduct = createdProducts.find(p => p.name === "Espresso");
    const cappuccinoProduct = createdProducts.find(p => p.name === "Cappuccino");
    const latteProduct = createdProducts.find(p => p.name === "Latte");
    const vanillaLatteProduct = createdProducts.find(p => p.name === "Vanilla Latte");
    const sandwichProduct = createdProducts.find(p => p.name === "Ham & Cheese Sandwich");

    const recipes = [
      // Espresso recipe
      { productId: espressoProduct?.id || "", ingredientId: coffeeBeansId || "", quantity: "18" },

      // Cappuccino recipe
      { productId: cappuccinoProduct?.id || "", ingredientId: coffeeBeansId || "", quantity: "18" },
      { productId: cappuccinoProduct?.id || "", ingredientId: milkId || "", quantity: "150" },

      // Latte recipe
      { productId: latteProduct?.id || "", ingredientId: coffeeBeansId || "", quantity: "18" },
      { productId: latteProduct?.id || "", ingredientId: milkId || "", quantity: "200" },

      // Vanilla Latte recipe
      { productId: vanillaLatteProduct?.id || "", ingredientId: coffeeBeansId || "", quantity: "18" },
      { productId: vanillaLatteProduct?.id || "", ingredientId: milkId || "", quantity: "200" },
      { productId: vanillaLatteProduct?.id || "", ingredientId: vanillaSyrupId || "", quantity: "15" },

      // Ham & Cheese Sandwich recipe
      { productId: sandwichProduct?.id || "", ingredientId: breadId || "", quantity: "2" },
      { productId: sandwichProduct?.id || "", ingredientId: hamId || "", quantity: "3" },
      { productId: sandwichProduct?.id || "", ingredientId: cheeseId || "", quantity: "2" },
    ];

    for (const recipe of recipes) {
      if (recipe.productId && recipe.ingredientId) {
        await storage.createRecipeIngredient(recipe);
      }
    }

    console.log("✅ Demo data initialization completed successfully!");
    console.log("👤 Demo users created:");
    console.log("   - admin / admin123 (Admin)");
    console.log("   - manager / manager123 (Manager)");
    console.log("   - cashier / cashier123 (Cashier)");
    console.log("   - barista / barista123 (Barista)");
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