
import { db } from './server/db';
import { products } from './shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function testDecimalStock() {
    const testId = `test-${nanoid()}`;
    console.log(`Creating test product with ID: ${testId}`);

    // Create product with 0.003 stock
    await db.insert(products).values({
        id: testId,
        name: 'Decimal Test Product',
        description: 'Testing 0.003 stock',
        price: '1.00',
        categoryId: 'cat-beverages', // Assume exists
        type: 'finished_good',
        stockQuantity: '0.003',
        minThreshold: 5,
        isActive: true
    });

    console.log('Product created. Initial stock: 0.003');

    // Simulate usage of storage.updateProductStock logic
    // But we'll verify it effectively by reading it back or using the API logic?
    // Let's use the API logic: storage.updateProductStock calls:
    // await db.update(products).set({ stockQuantity: sql`${products.stockQuantity} + ${quantityChange}` })...

    // We can just run a direct update using the same logic as the server
    // or actually call the API function if we import storage.

    // Let's rely on DB behavior first.
    const { sql } = await import('drizzle-orm');

    console.log('Adding 5 to stock...');
    await db.update(products)
        .set({ stockQuantity: sql`${products.stockQuantity} + 5` })
        .where(eq(products.id, testId));

    const [updated] = await db.select().from(products).where(eq(products.id, testId));
    console.log('Updated stock:', updated.stockQuantity);

    // Cleanup
    await db.delete(products).where(eq(products.id, testId));
    console.log('Test product deleted.');
    process.exit(0);
}

testDecimalStock();
