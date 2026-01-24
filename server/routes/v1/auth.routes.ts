/**
 * Authentication Routes Module (v1)
 * 
 * Handles all authentication-related endpoints:
 * - Login/logout
 * - Current user
 * - User management (admin only)
 */

import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { userService } from '../../services/user.service';
import { isAuthenticated, isAdmin } from '../../auth-middleware';
import { verifyPassword, isPasswordHashed, hashPassword } from '../../password-utils';
import { insertUserSchema } from '@shared/schema';

const router = Router();

// Rate limiter for authentication endpoints - prevent brute force attacks
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per IP per window
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

/**
 * POST /api/auth/login
 * Authenticate user with username and password
 */
router.post('/login', authRateLimiter, async (req: any, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        // Look up user in database
        let dbUser;
        try {
            dbUser = await userService.getUserByUsername(username);
        } catch (dbError) {
            console.error('Database user lookup failed:', (dbError as Error).message);
            return res.status(500).json({ message: "Authentication service unavailable" });
        }

        if (!dbUser || !dbUser.isActive) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Verify password using bcrypt if hashed, or plaintext for migration
        let passwordValid = false;
        if (isPasswordHashed(dbUser.password)) {
            passwordValid = await verifyPassword(password, dbUser.password);
        } else {
            // Legacy plaintext comparison (for migration period)
            passwordValid = dbUser.password === password;
            if (passwordValid) {
                console.warn(`User ${username} has legacy plaintext password - migration required`);
            }
        }

        if (!passwordValid) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const user = {
            id: dbUser.id,
            role: dbUser.role,
            firstName: dbUser.firstName || '',
            lastName: dbUser.lastName || '',
            email: dbUser.email || `${dbUser.role}@company.com`,
            organizationId: dbUser.organizationId
        };

        // Create new session with user data
        return req.session.regenerate((err: any) => {
            if (err) {
                console.error('Session regeneration error:', err);
                return res.status(500).json({ message: "Session creation failed" });
            }

            req.session.user = user;

            return req.session.save((saveErr: any) => {
                if (saveErr) {
                    console.error('Session save error:', saveErr);
                    return res.status(500).json({ message: "Session save failed" });
                }
                return res.json(user);
            });
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Login failed" });
    }
});

/**
 * GET /api/auth/user
 * Get current authenticated user
 */
router.get('/user', async (req: any, res) => {
    if (req.session?.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ message: "Unauthorized" });
    }
});

/**
 * POST /api/auth/logout
 * Destroy user session
 */
router.post('/logout', (req: any, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out" });
    });
});

// Also support GET for compatibility
router.get('/logout', (req: any, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out" });
    });
});

export default router;
