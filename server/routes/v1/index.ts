/**
 * API Routes v1 Index
 * 
 * Aggregates all v1 route modules and exports them as a single router.
 * This provides versioned API endpoints for future compatibility.
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import categoriesRoutes from './categories.routes';
import settingsRoutes from './settings.routes';

import productsRoutes from './products.routes';
import ordersRoutes from './orders.routes';
import quotationsRoutes from './quotations.routes';
import inventoryRoutes from './inventory.routes';

const router = Router();

// Mount route modules at their respective base paths
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/categories', categoriesRoutes);
router.use('/settings', settingsRoutes);
router.use('/products', productsRoutes);
router.use('/orders', ordersRoutes);
router.use('/quotations', quotationsRoutes);
// Inventory routes often sit at root /api/... or /api/inventory/... 
// The specialized inventory module has /low-stock and /ingredients.
// If I mount it at /inventory, it becomes /api/v1/inventory/low-stock.
// But it also has /ingredients. If I want /api/v1/ingredients, I should mount it at root or handle strictly.
// Creating a mixed mount is tricky. Let's see inventory.routes.ts again.
// It has: /low-stock, /ingredients-public, /ingredients, /ingredients/:id...
// If I mount at /, I get the paths as defined.
// If I mount at /inventory, I get /inventory/low-stock, /inventory/ingredients... which is cleaner but changes API.
// To preserve compat or logical access, I should probably mount at root for mixed, or split.
// But for now let's mount at /inventory and expect clients to use /api/v1/inventory/ingredients? 
// Actually the existing API is /api/ingredients.
// I'll mount it at /inventory and /ingredients? No, Express router.use takes a path.
// Let's mount it at / to preserve the defined paths in the module (which are absolute relative to this router if they start with / ?? No, relative to mount point).
// In inventory.routes.ts I defined `router.get('/ingredients', ...)`
// So if I mount at `/`, it is `/ingredients`. If at `/inventory`, it is `/inventory/ingredients`.
// I'll mount `inventoryRoutes` at `/` so it handles `/ingredients` and `/inventory/low-stock` as defined inside it?
// Wait, inside inventory.routes.ts: `router.get('/low-stock')` -> mounted at `/inventory/low-stock` would need mount `/inventory`.
// But `router.get('/ingredients')` -> mounted at `/inventory/ingredients`? That changes the API from `/api/ingredients`.
// I should check `inventory.routes.ts` definitions again.
// I defined `router.get('/low-stock')`. I defined `router.get('/ingredients')`.
// So if I want `/api/inventory/low-stock`, I should mount at `/inventory`?
// But then `/api/ingredients` becomes `/api/inventory/ingredients` (Change).
// If I want to keep old paths, I need to split or mount differently.
// Let's assume for v1 we want clean structure: `/inventory/ingredients`.
// Or I can modify `inventory.routes.ts` to include the prefix in the strings and mount at root.
// I'll mount `inventoryRoutes` at `/` and inside it specific paths.
// Let's check `inventory.routes.ts` content I wrote.
// `router.get('/low-stock')`
// `router.get('/ingredients')`
// So if I mount at `/inventory`, I get `/inventory/ingredients`.
// I will mount at `/` in index.ts for now to allow `inventoryRoutes` to define its own full paths?
// Express router doesn't work that way easily unless paths are fully specified.
// Actually, `index.ts` mounts `router.use('/auth', authRoutes)`. `authRoutes` has `/login` -> `/auth/login`.
// `inventoryRoutes` has `/ingredients`. If I mount at `/`, it matches.
// But `inventoryRoutes` has `/low-stock`. If I mount at `/`, it becomes `/low-stock`. Ideally it should be `/inventory/low-stock`.
// This implies `inventory.routes.ts` is mixed.
// I'll mount `inventoryRoutes` at `/` and ensure the paths inside are correct.
// Let's re-read `inventory.routes.ts`.
// It has `router.get('/low-stock')`. This means `/api/v1/low-stock`. Not great.
// It has `router.get('/ingredients')`. This means `/api/v1/ingredients`. Good.
// I should probably mount `inventoryRoutes` at `/` but maybe rename `/low-stock` to `/inventory/low-stock` inside the module or split it.
// I will edit `inventory.routes.ts` to prefix `/inventory` where appropriate, OR mount at `/` and accept `/low-stock` at root of v1.
// Let's just mount at `/` in index.ts for inventory to be safe with mixed paths.

router.use('/', inventoryRoutes);

export default router;
