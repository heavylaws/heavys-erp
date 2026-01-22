
import { db } from './server/db';
import { products } from './shared/schema';
import { eq, ilike } from 'drizzle-orm';

async function checkProductType() {
    const result = await db.select().from(products).where(ilike(products.name, '%Cappuccino%'));
    console.log('Cappuccino Product:', JSON.stringify(result, null, 2));
    process.exit(0);
}

checkProductType();
