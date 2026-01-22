/**
 * User Management Routes Module (v1)
 * 
 * Handles user CRUD operations (admin only):
 * - List users
 * - Create/update/delete users
 * - User settings
 */

import { Router } from 'express';
import { z } from 'zod';
import { userService } from '../../services/user.service';
import { isAuthenticated } from '../../auth-middleware';
import { hashPassword } from '../../password-utils';
import { insertUserSchema } from '@shared/schema';

const router = Router();

// Helper to require admin role
const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
};

/**
 * GET /api/users
 * List all active users (admin only)
 */
router.get('/', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
    }
});

/**
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
        const userData = insertUserSchema.parse(req.body);

        // Hash password before storing
        const hashedPassword = await hashPassword(userData.password);

        const newUser = await userService.createUser({
            ...userData,
            password: hashedPassword,
            role: userData.role as "admin" | "manager" | "cashier" | "barista" | "courier"
        });

        // Don't return password hash in response
        const { password: _, ...safeUser } = newUser;
        res.json(safeUser);
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Failed to create user" });
    }
});

/**
 * PUT /api/users/:id
 * Update an existing user (admin only)
 */
router.put('/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userData = req.body;

        // If password is being updated, hash it
        if (userData.password) {
            userData.password = await hashPassword(userData.password);
        }

        const updatedUser = await userService.updateUser(id, userData);

        // Don't return password hash
        const { password: _, ...safeUser } = updatedUser;
        res.json(safeUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
    }
});

/**
 * DELETE /api/users/:id
 * Deactivate a user (admin only)
 */
router.delete('/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
        const { id } = req.params;
        await userService.deleteUser(id);
        res.json({ message: "User deactivated successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
    }
});

/**
 * GET /api/users/me/settings
 * Get current user's settings
 */
router.get('/me/settings', isAuthenticated, async (req: any, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) return res.status(401).json({ message: 'Unauthorized' });

        const dbUser = await userService.getUser(sessionUser.id);
        if (dbUser) {
            return res.json(dbUser.settings || {});
        }
        return res.json(sessionUser.settings || {});
    } catch (error) {
        console.error('Error getting user settings:', error);
        res.status(500).json({ message: 'Failed to retrieve user settings' });
    }
});

/**
 * PUT /api/users/me/settings
 * Update current user's settings
 */
router.put('/me/settings', isAuthenticated, async (req: any, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) return res.status(401).json({ message: 'Unauthorized' });

        const userSettingsSchema = z.object({
            compactView: z.boolean().optional(),
            autoSendToBaristaOnCash: z.boolean().optional(),
        }).partial();

        const parsed = userSettingsSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({ message: 'Invalid settings payload', errors: parsed.error.flatten() });
        }

        const dbUser = await userService.getUser(sessionUser.id);
        if (dbUser) {
            const merged = { ...(dbUser.settings || {}), ...parsed.data };
            const updatedUser = await userService.updateUser(dbUser.id, { settings: merged });
            req.session.user = { ...req.session.user, settings: updatedUser.settings };
            await new Promise<void>((resolve, reject) => req.session.save((err: any) => (err ? reject(err) : resolve())));
            return res.json(updatedUser.settings || {});
        }

        // No DB user (e.g., demo session), store in session only
        const mergedSessionSettings = { ...(sessionUser.settings || {}), ...parsed.data };
        req.session.user.settings = mergedSessionSettings;
        await new Promise<void>((resolve, reject) => req.session.save((err: any) => (err ? reject(err) : resolve())));
        return res.json(mergedSessionSettings);
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ message: 'Failed to update user settings' });
    }
});

export default router;
