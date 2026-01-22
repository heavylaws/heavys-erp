
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:5000';
let cookie = '';

async function request(path: string, options: any = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
    };
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    // update cookie
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0];
    }

    return res;
}

async function verify() {
    console.log('1. Login as admin...');
    const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (!loginRes.ok) {
        throw new Error(`Login failed: ${loginRes.status}`);
    }
    console.log('Login successful');

    const timestamp = Date.now();
    const productData = {
        name: `Test Product ${timestamp}`,
        price: "10.00",
        categoryId: "c001", // Assuming this exists or will fail. 
        // We should fetch a category first.
        type: "finished_good",
        barcode: `PR-${timestamp}`,
        barcodes: [`SEC-${timestamp}-1`, `SEC-${timestamp}-2`]
    };

    // Get a category first
    console.log('Fetching categories...');
    const catRes = await request('/api/categories');
    const categories = await catRes.json();
    if (categories.length === 0) throw new Error("No categories found");
    productData.categoryId = categories[0].id;

    console.log('2. Create Product with multiple barcodes...');
    const createRes = await request('/api/products', {
        method: 'POST',
        body: JSON.stringify(productData)
    });

    const created = await createRes.json();
    if (!createRes.ok) {
        console.error(created);
        throw new Error(`Create failed: ${createRes.status}`);
    }

    console.log('Created product:', created.id);
    assert(created.barcodes.includes(`SEC-${timestamp}-1`), 'Barcode 1 missing');
    assert(created.barcodes.includes(`SEC-${timestamp}-2`), 'Barcode 2 missing');
    assert(created.barcodes.includes(`PR-${timestamp}`), 'Primary barcode missing from list');

    console.log('3. Fetch Product List...');
    const listRes = await request('/api/products');
    const list = await listRes.json();
    const found = list.find((p: any) => p.id === created.id);
    assert(found, 'Product not found in list');
    assert(found.barcodes.length >= 3, 'Barcodes not present in list view');

    console.log('4. Update Product Barcodes...');
    const updateRes = await request(`/api/products/${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
            barcodes: [`UPD-${timestamp}-1`, `PR-${timestamp}`] // Replacing list
        })
    });
    const updated = await updateRes.json();
    assert(updated.barcodes.includes(`UPD-${timestamp}-1`), 'New barcode missing');
    assert(!updated.barcodes.includes(`SEC-${timestamp}-1`), 'Old barcode should be gone');

    console.log('5. Cleanup...');
    await request(`/api/products/${created.id}`, { method: 'DELETE' });

    console.log('✅ verification PASSED');
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
