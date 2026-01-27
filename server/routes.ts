import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { z } from "zod";
import { insertProductSchema, insertComponentSchema, insertCategorySchema, insertOrderSchema, insertOrderItemSchema, insertUserSchema, insertOptionGroupSchema, insertOptionSchema, insertOptionComponentSchema, insertProductOptionGroupSchema, insertFavoriteComboSchema, insertReceiptSettingsSchema, insertCompanySettingsSchema } from "@shared/schema";
import { ENABLE_OPTIONS_SYSTEM } from '@shared/feature-flags';

import { isAuthenticated, isAdmin } from "./auth-middleware";
import { exportRoutes } from "./export";
import multer from 'multer';
import { backupService } from './services/backup-service';
import erpRoutes from './erp-routes';
import v1Routes from './routes/v1'; // Architecture Modernization: Import v1 routes
import { verifyPassword, isPasswordHashed, hashPassword } from './password-utils';
import rateLimit from 'express-rate-limit';

const upload = multer({ storage: multer.memoryStorage() });

// Rate limiter for authentication endpoints - prevent brute force attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP per window (REVERTED)
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Global WebSocket clients storage
let wssGlobal: WebSocketServer | null = null;

// Broadcast function for order updates (exported implementation kept below)

// General broadcast function for any WebSocket message
function broadcast(message: any) {
  if (!wssGlobal) return;

  const messageStr = JSON.stringify(message);
  wssGlobal.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

const favoriteComboItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity too large'),
});

const favoriteComboCreateSchema = insertFavoriteComboSchema
  .pick({ name: true, description: true, isActive: true, displayOrder: true })
  .extend({
    items: z.array(favoriteComboItemInputSchema).min(1, 'Add at least one product'),
  });

const favoriteComboUpdateSchema = insertFavoriteComboSchema
  .pick({ name: true, description: true, isActive: true, displayOrder: true })
  .partial()
  .extend({
    items: z.array(favoriteComboItemInputSchema).min(1, 'Add at least one product').optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Provide at least one field to update' }
  );

export function broadcastOrderUpdate(order: any) {
  if (!wssGlobal) return;
  const message = JSON.stringify({ type: 'order_update', data: order });
  wssGlobal.clients.forEach((client) => {
    try {
      client.send(message);
    } catch (e) {
      console.warn('Failed to send ws message', e);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure consistent CORS headers ahead of other middleware too
  app.use((req: any, res: any, next: any) => {
    const originHeader = req.headers.origin as string | undefined;
    if (originHeader) {
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Origin', originHeader);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
  // Health check for container orchestration (Phase 9 Hardening)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });



  // Serve Installer Files (Phase 10 Deployment)
  const path = await import('path');
  // Serve the shell script directly
  app.get('/api/installer/script', (req, res) => {
    // In Docker, process.cwd() is /app. The script is copied to root.
    const scriptPath = path.resolve(process.cwd(), 'install-client.sh');
    res.download(scriptPath, 'install-client.sh');
  });

  // Serve the AppImage
  app.get('/api/installer/app', (req, res) => {
    // Release dir should be mounted or copied to /app/release
    const releaseDir = path.resolve(process.cwd(), 'release');
    // Find the AppImage
    const fs = require('fs');
    if (fs.existsSync(releaseDir)) {
      const files = fs.readdirSync(releaseDir);
      const appImage = files.find((f: string) => f.endsWith('.AppImage'));
      if (appImage) {
        res.download(path.join(releaseDir, appImage), appImage);
        return;
      }
    }
    res.status(404).send('AppImage not found. Please run build setup first.');
  });

  // Session middleware - optimized for both Replit and Docker environments
  const isDocker = process.env.REPLIT_DEPLOYMENT === 'true' || process.env.DATABASE_TYPE === 'postgres';
  const isProduction = process.env.NODE_ENV === 'production';

  // SECURITY: Require SESSION_SECRET in production
  if (isProduction && !process.env.SESSION_SECRET) {
    console.error('CRITICAL: SESSION_SECRET environment variable is required in production!');
    throw new Error('SESSION_SECRET must be set in production environment');
  }
  const sessionSecret = process.env.SESSION_SECRET || 'dev-only-secret-not-for-production';

  // Add error handling middleware before session
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Middleware error:', err);
    res.status(500).json({ message: "Server middleware error", error: err.message });
  });

  // Using Postgres-backed session store; no MemoryStore fallback in production

  // Session configuration with persistent store
  const PgSession = connectPgSimple(session);
  const secureCookies = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isDocker;
  const storeOptions: any = {
    tableName: 'sessions',
    createTableIfMissing: false, // Table created via Drizzle migration
  };
  if (process.env.DATABASE_URL) {
    storeOptions.conString = process.env.DATABASE_URL;
  }
  const sessionConfig: session.SessionOptions = {
    secret: sessionSecret,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: new PgSession(storeOptions),
    cookie: {
      secure: secureCookies, // Configurable via env; defaults to true in Docker
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: 'lax',
    },
    name: 'pos_session_id', // More specific name
    rolling: true,
  };


  app.use(session(sessionConfig));


  // Activity logging middleware (API only). Logs on response finish.
  app.use((req: any, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const start = Date.now();
    const skipPaths = ['/api/admin/activity-logs'];
    const shouldSkip = skipPaths.some((p) => req.path.startsWith(p));
    res.on('finish', () => {
      try {
        if (shouldSkip) return;
        const duration = Date.now() - start;
        const userId = req.session?.user?.id;
        if (!userId) return; // Do not log if no user

        const success = res.statusCode < 400;
        const action = `${req.method} ${req.path}`;
        const details = {
          status: res.statusCode,
          method: req.method,
          path: req.path,
          duration,
          // Avoid logging sensitive bodies; include minimal metadata
          query: req.query,
          ip: (req.headers['x-forwarded-for'] as string) || req.ip || '',
          ua: req.headers['user-agent'] || ''
        } as any;
        // Reduce noise for login endpoint
        if (req.path === '/api/auth/login') delete details.query;
        // Fire-and-forget; do not block response
        void storage.createActivityLog({ userId, action, success, details });
      } catch {
        // ignore logging errors
      }
    });
    next();
  });

  // ERP Module Routes (Suppliers, Customers, Purchase Orders, Serial Numbers)
  app.use('/api', erpRoutes);

  // Add a simple test endpoint to verify middleware is working
  app.post('/api/test', (req: any, res) => {
    res.json({ message: 'Test successful', hasSession: !!req.session });
  });

  // Credential-based login endpoint with rate limiting
  app.post('/api/auth/login', authRateLimiter, async (req: any, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Look up user in database
      let dbUser;
      try {
        dbUser = await storage.getUserByUsername(username);
      } catch (dbError) {
        console.error('Database user lookup failed:', (dbError as Error).message);
        return res.status(500).json({ message: "Authentication service unavailable" });
      }

      if (!dbUser || !dbUser.isActive) {
        // Generic message to prevent username enumeration
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Verify password using bcrypt if hashed, or plaintext for migration
      let passwordValid = false;
      if (isPasswordHashed(dbUser.password)) {
        passwordValid = await verifyPassword(password, dbUser.password);
      } else {
        // Legacy plaintext comparison (for migration period)
        // TODO: Remove after all passwords are migrated to bcrypt
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
        organizationId: dbUser.organizationId || '',
      };

      // Create new session with user data
      return req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ message: "Session creation failed" });
        }

        req.session.user = user;

        // Force session save for Docker compatibility
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

  // Get current user endpoint (required by frontend)
  app.get('/api/auth/user', async (req: any, res) => {
    // No debug log needed here anymore

    if (req.session?.user) {
      res.json(req.session.user);
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Logout endpoint (support both GET and POST for compatibility)
  const handleLogout = (req: any, res: any) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  };

  app.post('/api/auth/logout', handleLogout);
  app.get('/api/logout', handleLogout);

  // Initialize demo users if database is empty
  const initializeDemoUsers = async () => {
    try {
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.length === 0) {
        console.log("Initializing demo users with hashed passwords...");
        const demoUsers = [
          { username: 'admin', password: 'Admin123!', role: 'admin', firstName: 'Admin', lastName: 'User', email: 'admin@company.com', isActive: true },
          { username: 'manager', password: 'Manager123!', role: 'manager', firstName: 'Manager', lastName: 'User', email: 'manager@company.com', isActive: true },
          { username: 'cashier', password: 'Cashier123!', role: 'cashier', firstName: 'Cashier', lastName: 'User', email: 'cashier@company.com', isActive: true },
          { username: 'technician', password: 'Barista123!', role: 'technician', firstName: 'Barista', lastName: 'User', email: 'barista@company.com', isActive: true },
          { username: 'courier', password: 'Courier123!', role: 'courier', firstName: 'Courier', lastName: 'User', email: 'courier@company.com', isActive: true },
        ];

        for (const userData of demoUsers) {
          const hashedPassword = await hashPassword(userData.password);
          await storage.createUser({
            ...userData,
            password: hashedPassword,
            role: userData.role as "admin" | "manager" | "cashier" | "technician" | "courier"
          });
        }
        console.log("Demo users initialized successfully with bcrypt hashed passwords");
      }
    } catch (error) {
      console.error("Error initializing demo users:", error);
    }
  };

  // Initialize demo users on startup
  await initializeDemoUsers();

  // User management routes (admin only)u
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userData = insertUserSchema.parse(req.body);

      // Hash password before storing
      const hashedPassword = await hashPassword(userData.password);

      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword,
        role: userData.role as "admin" | "manager" | "cashier" | "technician" | "courier"
      });

      // Don't return password hash in response
      const { password: _, ...safeUser } = newUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const userData = req.body;
      const updatedUser = await storage.updateUser(id, userData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get current user's settings
  app.get('/api/users/me/settings', isAuthenticated, async (req: any, res) => {
    try {
      const sessionUser = req.session?.user;
      if (!sessionUser) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await storage.getUser(sessionUser.id);
      if (dbUser) {
        return res.json(dbUser.settings || {});
      }

      // Fallback to session-stored settings
      return res.json(sessionUser.settings || {});
    } catch (error) {
      console.error('Error getting user settings:', error);
      res.status(500).json({ message: 'Failed to retrieve user settings' });
    }
  });

  // Update current user's settings
  app.put('/api/users/me/settings', isAuthenticated, async (req: any, res) => {
    try {
      const sessionUser = req.session?.user;
      if (!sessionUser) return res.status(401).json({ message: 'Unauthorized' });

      // Merge settings with existing stored settings
      const dbUser = await storage.getUser(sessionUser.id);
      const incoming = req.body || {};
      const userSettingsSchema = z.object({
        compactView: z.boolean().optional(),
        autoSendToBaristaOnCash: z.boolean().optional(),
      }).partial();

      const parsed = userSettingsSchema.safeParse(incoming);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid settings payload', errors: parsed.error.flatten() });
      }
      const incomingValidated = parsed.data;

      if (dbUser) {
        const merged = { ...(dbUser.settings || {}), ...incomingValidated };
        const updatedUser = await storage.updateUser(dbUser.id, { settings: merged });
        // Also update session for immediate reflection
        req.session.user = { ...req.session.user, settings: updatedUser.settings };
        await new Promise<void>((resolve, reject) => req.session.save((err: any) => (err ? reject(err) : resolve())));
        return res.json(updatedUser.settings || {});
      }

      // No DB user (e.g., demo session), store in session only
      const mergedSessionSettings = { ...(sessionUser.settings || {}), ...incomingValidated };
      req.session.user.settings = mergedSessionSettings;
      await new Promise<void>((resolve, reject) => req.session.save((err: any) => (err ? reject(err) : resolve())));
      return res.json(mergedSessionSettings);
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ message: 'Failed to update user settings' });
    }
  });

  // Company Settings Routes
  app.get('/api/settings/company', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings || {});
    } catch (error) {
      console.error('Error fetching company settings:', error);
      res.status(500).json({ message: 'Failed to fetch company settings' });
    }
  });

  app.post('/api/settings/company', isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log('Received company settings update:', req.body);
      const settingsData = insertCompanySettingsSchema.parse(req.body);
      const updatedSettings = await storage.updateCompanySettings(settingsData);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation error updating company settings:', JSON.stringify(error.errors, null, 2));
        res.status(400).json({ message: 'Validation failed', errors: error.errors });
      } else {
        console.error('Error updating company settings:', error);
        res.status(500).json({ message: 'Failed to update company settings', error: (error as Error).message });
      }
    }
  });

  // Admin: on-demand database backup (SQL dump)
  app.get('/api/admin/backup/db', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { spawn } = await import('node:child_process');
      const dbUrlRaw = process.env.DATABASE_URL;
      if (!dbUrlRaw) {
        return res.status(500).json({ message: 'DATABASE_URL is not configured' });
      }

      // Parse connection string for safer invocation without exposing password in argv
      let host = 'localhost', port = '5432', user = 'postgres', password = '', dbName = '';
      try {
        const url = new URL(dbUrlRaw);
        host = url.hostname || host;
        port = url.port || port;
        user = decodeURIComponent(url.username || user);
        password = decodeURIComponent(url.password || '');
        dbName = (url.pathname || '').replace(/^\//, '') || 'postgres';
      } catch (e) {
        console.warn('Failed to parse DATABASE_URL, falling back to URI mode');
      }

      // Filename with timestamp
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `highway_cafe_backup_${ts}.sql`;
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Prefer detailed args to avoid password in argv; fallback to URI if parsing failed
      const useParsed = dbName !== '';
      const args = useParsed
        ? ['-h', host, '-p', String(port), '-U', user, '-d', dbName, '--no-owner', '--no-privileges']
        : ['-d', dbUrlRaw, '--no-owner', '--no-privileges'];
      const env = { ...process.env, PGPASSWORD: password };

      const child = spawn('pg_dump', args, { env });
      let hadError = false;
      let stderrData = '';

      child.on('error', async (err: any) => {
        hadError = true;
        if (err && (err as any).code === 'ENOENT') {
          // Log failed attempt
          try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup', success: false, details: { reason: 'pg_dump not available' } }); } catch { }
          return res.status(501).json({ message: 'Backup tool (pg_dump) not available on server/container' });
        }
        try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup', success: false, details: { reason: 'spawn error', error: String(err?.message || err) } }); } catch { }
        return res.status(500).json({ message: 'Failed to start backup process', error: String(err?.message || err) });
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString();
      });

      // Stream dump directly to client
      child.stdout.pipe(res);

      child.on('close', async (code: number) => {
        if (hadError) return;
        if (code !== 0) {
          // If not already sent headers, return error JSON
          try {
            try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup', success: false, details: { filename, exitCode: code, stderr: stderrData.slice(0, 400) } }); } catch { }
            if (!res.headersSent) {
              res.status(500).json({ message: 'Backup failed', code, stderr: stderrData.slice(0, 4000) });
            } else {
              res.end();
            }
          } catch {
            // ignore
          }
        } else {
          // Success
          try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup', success: true, details: { filename } }); } catch { }
        }
      });
    } catch (error: any) {
      console.error('Backup endpoint error:', error);
      try { await storage.createActivityLog({ userId: (req as any)?.session?.user?.id || 'unknown', action: 'db_backup', success: false, details: { reason: 'exception', error: error?.message } }); } catch { }
      return res.status(500).json({ message: 'Backup failed to start', error: error?.message });
    }
  });

  // Admin: List server-side backups
  app.get('/api/admin/backups', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const BACKUP_DIR = '/backups';

      try {
        await fs.access(BACKUP_DIR);
      } catch {
        // Just return empty if dir doesn't exist yet
        return res.json([]);
      }

      const files = await fs.readdir(BACKUP_DIR);
      const backups = await Promise.all(files
        .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
        .map(async (f) => {
          try {
            const stats = await fs.stat(path.join(BACKUP_DIR, f));
            return {
              name: f,
              size: stats.size,
              created_at: stats.birthtime.toISOString()
            };
          } catch (e) {
            return null;
          }
        }));

      // Filter nulls and sort newest first
      const validBackups = backups.filter(b => b !== null).sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      res.json(validBackups);
    } catch (error) {
      console.error('Error listing backups:', error);
      res.status(500).json({ message: 'Failed to list backups' });
    }
  });

  // Admin: Create server-side backup
  app.post('/api/admin/backups', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const fs = await import('node:fs/promises');
      const fsSync = await import('node:fs');
      const path = await import('node:path');
      const { spawn } = await import('node:child_process');

      const BACKUP_DIR = '/backups';
      try { await fs.access(BACKUP_DIR); } catch { await fs.mkdir(BACKUP_DIR, { recursive: true }); }

      const dbUrlRaw = process.env.DATABASE_URL;
      if (!dbUrlRaw) return res.status(500).json({ message: 'DATABASE_URL not set' });

      // Parse connection
      let host = 'localhost', port = '5432', user = 'postgres', password = '', dbName = '';
      try {
        const url = new URL(dbUrlRaw);
        host = url.hostname || host;
        port = url.port || port;
        user = decodeURIComponent(url.username || user);
        password = decodeURIComponent(url.password || '');
        dbName = (url.pathname || '').replace(/^\//, '') || 'postgres';
      } catch (e) {
        console.warn('Failed to parse DATABASE_URL');
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `manual_backup_${ts}.sql.gz`;
      const filepath = path.join(BACKUP_DIR, filename);

      const env = { ...process.env, PGPASSWORD: password };
      const args = ['-h', host, '-p', String(port), '-U', user, '-d', dbName, '--no-owner', '--no-privileges', '--clean', '--if-exists'];

      const pgDump = spawn('pg_dump', args, { env });
      const gzip = spawn('gzip');
      const fileStream = fsSync.createWriteStream(filepath);

      pgDump.stdout.pipe(gzip.stdin);
      gzip.stdout.pipe(fileStream);

      await new Promise((resolve, reject) => {
        gzip.on('close', (code) => {
          if (code === 0) resolve(null);
          else reject(new Error(`Backup gz failed with code ${code}`));
        });
        pgDump.on('error', reject);
        gzip.on('error', reject);
        fileStream.on('error', reject);
      });

      try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup', success: true, details: { filename, type: 'manual' } }); } catch { }
      res.status(201).json({ message: 'Backup created successfully', filename });
    } catch (error: any) {
      console.error('Backup creation error:', error);
      try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup', success: false, details: { error: error.message } }); } catch { }
      res.status(500).json({ message: 'Backup failed', error: error.message });
    }
  });

  // Admin: Delete backup
  app.delete('/api/admin/backups/:filename', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const filename = req.params.filename;

      if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || !filename.startsWith('backup_') && !filename.startsWith('manual_')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const filepath = path.join('/backups', filename);
      await fs.unlink(filepath);

      try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_backup_delete', success: true, details: { filename } }); } catch { }
      res.json({ message: 'Backup deleted' });
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      res.status(500).json({ message: 'Failed to delete backup' });
    }
  });

  // Admin: Download backup
  app.get('/api/admin/backups/:filename', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const path = await import('node:path');
      const filename = req.params.filename;

      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const filepath = path.join('/backups', filename);
      res.download(filepath);
    } catch (error) {
      res.status(404).json({ message: 'File not found' });
    }
  });

  // Admin: Restore backup from file
  app.post('/api/admin/backups/:filename/restore', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const path = await import('node:path');
      const { spawn } = await import('node:child_process');
      const filename = req.params.filename;

      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const filepath = path.join('/backups', filename);
      const dbUrlRaw = process.env.DATABASE_URL;

      // Parse connection
      let host = 'localhost', port = '5432', user = 'postgres', password = '', dbName = '';
      try {
        const url = new URL(dbUrlRaw!);
        host = url.hostname || host;
        port = url.port || port;
        user = decodeURIComponent(url.username || user);
        password = decodeURIComponent(url.password || '');
        dbName = (url.pathname || '').replace(/^\//, '') || 'postgres';
      } catch (e) { }

      const env = { ...process.env, PGPASSWORD: password };

      // We are dropping and recreating the database to ensure clean state
      // This requires terminating other connections first usually, but for now we try direct simple restore
      // Ideally we should use pg_restore with -c for clean, but since we have .sql.gz we pipe to psql

      // Step 1: gunzip | psql
      const gunzip = spawn('gunzip', ['-c', filepath]);
      const psql = spawn('psql', ['-h', host, '-p', String(port), '-U', user, '-d', dbName], { env });

      gunzip.stdout.pipe(psql.stdin);

      let stderr = '';
      psql.stderr.on('data', d => stderr += d);

      await new Promise((resolve, reject) => {
        psql.on('close', (code) => {
          if (code === 0) resolve(null);
          else reject(new Error(`Restore psql failed (${code}): ${stderr}`));
        });
        gunzip.on('error', reject);
        psql.on('error', reject);
      });

      try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_restore', success: true, details: { filename } }); } catch { }
      res.json({ message: 'Restore successful' });
    } catch (error: any) {
      console.error('Restore error:', error);
      try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_restore', success: false, details: { error: error.message } }); } catch { }
      res.status(500).json({ message: 'Restore failed', error: error.message });
    }
  });

  // Google Drive Backup Configuration
  app.get('/api/admin/backup/config', isAuthenticated, isAdmin, (req, res) => {
    res.json(backupService.getConfig());
  });

  app.post('/api/admin/backup/config', isAuthenticated, isAdmin, (req, res) => {
    try {
      backupService.saveConfig(req.body);
      res.json(backupService.getConfig());
    } catch (e: any) {
      res.status(500).json({ message: 'Failed to update config', error: e.message });
    }
  });

  app.post('/api/admin/backup/upload-key', isAuthenticated, isAdmin, upload.single('key'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const keyContent = req.file.buffer.toString('utf-8');
      await backupService.saveServiceAccountKey(keyContent);
      res.json({ message: 'Service account key saved successfully', config: backupService.getConfig() });
    } catch (e: any) {
      res.status(400).json({ message: 'Invalid key file', error: e.message });
    }
  });

  app.post('/api/admin/backup/test-drive', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const status = await backupService.testConnection();
      res.json({ message: 'Connection successful', status });
    } catch (e: any) {
      res.status(500).json({ message: 'Connection failed', error: e.message });
    }
  });

  app.post('/api/admin/backup/trigger-cloud', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const filename = await backupService.performBackup();
      res.json({ message: 'Cloud backup triggered', filename });
    } catch (e: any) {
      res.status(500).json({ message: 'Backup failed', error: e.message });
    }
  });

  // Admin: restore database from uploaded SQL (send as text body)
  // Usage: POST /api/admin/restore/db?drop=true with Content-Type: application/sql and body being the SQL dump
  app.post('/api/admin/restore/db', express.text({ type: 'application/sql', limit: '100mb' }), isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { spawn } = await import('node:child_process');
      const dbUrlRaw = process.env.DATABASE_URL;
      if (!dbUrlRaw) {
        return res.status(500).json({ message: 'DATABASE_URL is not configured' });
      }

      // Parse connection
      let host = 'localhost', port = '5432', user = 'postgres', password = '', dbName = '';
      try {
        const url = new URL(dbUrlRaw);
        host = url.hostname || host;
        port = url.port || port;
        user = decodeURIComponent(url.username || user);
        password = decodeURIComponent(url.password || '');
        dbName = (url.pathname || '').replace(/^\//, '') || 'postgres';
      } catch (e) {
        console.warn('Failed to parse DATABASE_URL, falling back to URI mode');
      }

      const drop = String(req.query.drop || '').toLowerCase() === 'true';
      const env = { ...process.env, PGPASSWORD: password };

      // Optional: drop and recreate DB
      if (drop && dbName) {
        const psqlDrop = spawn('psql', ['-h', host, '-p', String(port), '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS "${dbName}";`, '-c', `CREATE DATABASE "${dbName}";`], { env });
        let stderrDrop = '';
        await new Promise<void>((resolve, reject) => {
          psqlDrop.stderr.on('data', (c: Buffer) => (stderrDrop += c.toString()));
          psqlDrop.on('error', (err) => reject(err));
          psqlDrop.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`psql drop/create failed (${code}): ${stderrDrop}`));
          });
        });
      }

      const sql = req.body as string;
      if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
        return res.status(400).json({ message: 'Empty SQL body' });
      }

      const args = dbName
        ? ['-h', host, '-p', String(port), '-U', user, '-d', dbName, '-v', 'ON_ERROR_STOP=1']
        : ['-d', dbUrlRaw, '-v', 'ON_ERROR_STOP=1'];

      const child = spawn('psql', args, { env });
      let stderr = '';
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));

      // Write SQL to stdin
      child.stdin.write(sql);
      child.stdin.end();

      child.on('error', async (err: any) => {
        if (err && (err as any).code === 'ENOENT') {
          try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_restore', success: false, details: { reason: 'psql not available' } }); } catch { }
          return res.status(501).json({ message: 'Restore tool (psql) not available on server/container' });
        }
        try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_restore', success: false, details: { reason: 'spawn error', error: String(err?.message || err) } }); } catch { }
        return res.status(500).json({ message: 'Failed to start restore process', error: String(err?.message || err) });
      });

      child.on('close', async (code: number) => {
        if (code === 0) {
          try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_restore', success: true, details: { drop } }); } catch { }
          return res.json({ message: 'Restore completed successfully' });
        }
        try { await storage.createActivityLog({ userId: req.session.user.id, action: 'db_restore', success: false, details: { drop, exitCode: code, stderr: stderr.slice(0, 400) } }); } catch { }
        return res.status(500).json({ message: 'Restore failed', code, stderr: stderr.slice(0, 4000) });
      });
    } catch (error: any) {
      console.error('Restore endpoint error:', error);
      try { await storage.createActivityLog({ userId: (error?.userId) || (req as any)?.session?.user?.id || 'unknown', action: 'db_restore', success: false, details: { reason: 'exception', error: error?.message } }); } catch { }
      return res.status(500).json({ message: 'Restore failed to start', error: error?.message });
    }
  });

  // Admin: fetch recent activity logs (simple)
  app.get('/api/admin/activity-logs', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
      const logs = await storage.getActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
  });

  // Admin: paginated/filterable activity logs
  app.get('/api/admin/activity-logs/paged', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 500);
      const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
      const filters = {
        userId: req.query.userId ? String(req.query.userId) : undefined,
        success: typeof req.query.success !== 'undefined' ? String(req.query.success).toLowerCase() === 'true' : undefined,
        action: req.query.action ? String(req.query.action) : undefined,
        from: req.query.from ? new Date(String(req.query.from)) : undefined,
        to: req.query.to ? new Date(String(req.query.to)) : undefined,
      };
      const result = await storage.getActivityLogsPaged({ limit, offset, ...filters });
      res.json(result);
    } catch (error) {
      console.error('activity-logs/paged error:', error);
      res.status(500).json({ message: 'Failed to fetch activity logs (paged)' });
    }
  });

  // Categories
  app.get('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const parsed = insertCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid category payload",
          errors: parsed.error.flatten()
        });
      }

      const category = await storage.createCategory({
        ...parsed.data,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || parsed.data.description,
        icon: parsed.data.icon?.trim() || parsed.data.icon,
      });

      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      await storage.deleteCategory(id);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Ingredients
  // DEV-ONLY: Public ingredients endpoint to help debug frontend fetching without requiring auth
  // Remove or protect this in production.
  app.get('/api/ingredients-public', async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const ingredients = await storage.getComponents(search);
      res.json(ingredients);
    } catch (error) {
      console.error('Error fetching public ingredients:', error);
      res.status(500).json({ message: 'Failed to fetch ingredients' });
    }
  });

  app.get('/api/ingredients', isAuthenticated, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const ingredients = await storage.getComponents(search);
      res.json(ingredients);
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      res.status(500).json({ message: "Failed to fetch ingredients" });
    }
  });

  app.post('/api/ingredients', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const ingredientData = insertComponentSchema.parse(req.body);
      const ingredient = await storage.createComponent(ingredientData);
      res.json(ingredient);
    } catch (error) {
      console.error("Error creating ingredient:", error);
      res.status(500).json({ message: "Failed to create ingredient" });
    }
  });

  app.patch('/api/ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const updateData = req.body;
      const ingredient = await storage.updateComponent(id, updateData);
      res.json(ingredient);
    } catch (error) {
      console.error("Error updating ingredient:", error);
      res.status(500).json({ message: "Failed to update ingredient" });
    }
  });

  // Update ingredient stock (PATCH for stock adjustments)
  app.patch('/api/ingredients/:id/stock', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const { quantityChange, reason } = req.body;

      if (typeof quantityChange !== 'number') {
        return res.status(400).json({ message: "quantityChange must be a number" });
      }

      await storage.updateComponentStock(id, quantityChange, user.id, reason);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating ingredient stock:", error);
      res.status(500).json({ message: "Failed to update ingredient stock" });
    }
  });

  app.put('/api/ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const ingredientData = insertComponentSchema.parse(req.body);
      const ingredient = await storage.updateComponent(id, ingredientData);
      res.json(ingredient);
    } catch (error) {
      console.error("Error updating ingredient:", error);
      res.status(500).json({ message: "Failed to update ingredient" });
    }
  });

  app.delete('/api/ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      await storage.deleteComponent(id);
      res.json({ message: 'Ingredient deleted successfully' });
    } catch (error) {
      console.error("Error deleting ingredient:", error);
      res.status(500).json({ message: "Failed to delete ingredient. It may be used in recipes." });
    }
  });

  // Recipe ingredients - GET (return the list of ingredients for an ingredient-based product)
  app.get('/api/products/:id/recipe', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const recipeIngredients = await storage.getProductComponents(id);
      res.json(recipeIngredients);
    } catch (error) {
      console.error("Error fetching recipe ingredients:", error);
      res.status(500).json({ message: "Failed to fetch recipe ingredients" });
    }
  });

  app.get('/api/products/:id/optional-ingredients', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const optionalIngredients = await storage.getOptionalProductComponents(id);
      res.json(optionalIngredients);
    } catch (error) {
      console.error('Error fetching optional recipe ingredients:', error);
      res.status(500).json({ message: 'Failed to fetch optional ingredients' });
    }
  });

  app.post('/api/products/:id/recipe', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const { componentId, quantity, isOptional = false } = req.body;

      const recipeIngredient = await storage.createProductComponent({
        productId: id,
        componentId,
        quantity: quantity.toString(),
        isOptional
      });

      res.json(recipeIngredient);
    } catch (error) {
      console.error("Error adding recipe ingredient:", error);
      res.status(500).json({ message: "Failed to add recipe ingredient" });
    }
  });

  app.patch('/api/recipe-ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const data: any = {};
      if (typeof req.body.isOptional === 'boolean') data.isOptional = req.body.isOptional;
      if (req.body.quantity) data.quantity = req.body.quantity.toString();

      const updated = await storage.updateProductComponent(id, data);
      res.json(updated);
    } catch (error) {
      console.error('Error updating recipe ingredient:', error);
      res.status(500).json({ message: 'Failed to update recipe ingredient' });
    }
  });

  app.delete('/api/recipe-ingredients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      await storage.deleteProductComponent(id);
      res.json({ message: "Recipe ingredient removed successfully" });
    } catch (error) {
      console.error("Error removing recipe ingredient:", error);
      res.status(500).json({ message: "Failed to remove recipe ingredient" });
    }
  });

  // Products (temporarily public so dashboard works without explicit login)
  app.get('/api/products', async (req, res) => {
    try {
      const { categoryId } = req.query;
      let products;
      if (categoryId) {
        products = await storage.getProductsByCategory(categoryId as string);
      } else {
        products = await storage.getProducts();
      }
      // For component_based products, fetch and attach recipeIngredients
      const enriched = await Promise.all(products.map(async (p) => {
        let base: any = p;
        if (p.type === 'component_based') {
          const recipeIngredients = await storage.getProductComponents(p.id);
          base = { ...base, recipeIngredients };
        }
        if (ENABLE_OPTIONS_SYSTEM) {
          try {
            const productGroups = await (storage as any).getProductOptionGroups(p.id);
            if (productGroups && productGroups.length) {
              base = {
                ...base, optionGroups: productGroups.map((m: any) => ({
                  id: m.group.id,
                  name: m.group.name,
                  description: m.group.description,
                  selectionType: m.group.selectionType,
                  minSelections: m.group.minSelections,
                  maxSelections: m.group.maxSelections,
                  required: m.group.required || m.mapping?.required || false,
                  displayOrder: m.displayOrder || 0,
                  options: (m.options || []).map((o: any) => ({
                    id: o.id,
                    name: o.name,
                    description: o.description,
                    priceAdjust: o.priceAdjust,
                    isDefault: o.isDefault,
                    isActive: o.isActive,
                    displayOrder: o.displayOrder
                  }))
                }))
              };
            }
          } catch (e) {
            // Swallow option error to avoid breaking product list
          }
        }
        return base;
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Fallback route for old pattern /api/products/:categoryId
  app.get('/api/products/:categoryId', isAuthenticated, async (req, res) => {
    try {
      const { categoryId } = req.params;
      const products = await storage.getProductsByCategory(categoryId);
      if (!ENABLE_OPTIONS_SYSTEM) return res.json(products);
      const enriched = await Promise.all(products.map(async (p) => {
        let base: any = p;
        if (p.type === 'component_based') {
          const recipeIngredients = await storage.getProductComponents(p.id);
          base = { ...base, recipeIngredients };
        }
        try {
          const productGroups = await (storage as any).getProductOptionGroups(p.id);
          if (productGroups && productGroups.length) {
            base = {
              ...base, optionGroups: productGroups.map((m: any) => ({
                id: m.group.id,
                name: m.group.name,
                description: m.group.description,
                selectionType: m.group.selectionType,
                minSelections: m.group.minSelections,
                maxSelections: m.group.maxSelections,
                required: m.group.required || m.mapping?.required || false,
                displayOrder: m.displayOrder || 0,
                options: (m.options || []).map((o: any) => ({
                  id: o.id,
                  name: o.name,
                  description: o.description,
                  priceAdjust: o.priceAdjust,
                  isDefault: o.isDefault,
                  isActive: o.isActive,
                  displayOrder: o.displayOrder
                }))
              }))
            };
          }
        } catch { }
        return base;
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching products by category:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Relax schema to allow numbers for decimal fields (drizzle-zod expects strings for decimals)
      const relaxedProductSchema = insertProductSchema.extend({
        stockQuantity: z.union([z.string(), z.number()]).optional().transform((v) => String(v || '0')),
        price: z.union([z.string(), z.number()]).transform((v) => String(v)),
        costPerUnit: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => v !== null && v !== undefined ? String(v) : v),
        barcodes: z.array(z.string()).optional(),
      });

      const parsed = relaxedProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid product data",
          errors: parsed.error.issues
        });
      }

      const product = await storage.createProduct(parsed.data);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch('/api/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const updateData = req.body;
      const product = await storage.updateProduct(id, updateData);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      await storage.deleteProduct(id);
      res.json({ message: 'Product deactivated successfully' });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Update product stock (PATCH for stock adjustments)
  app.patch('/api/products/:id/stock', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const { quantityChange, reason } = req.body;

      if (typeof quantityChange !== 'number') {
        return res.status(400).json({ message: "quantityChange must be a number" });
      }

      await storage.updateProductStock(id, quantityChange, user.id, reason);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating product stock:", error);
      res.status(500).json({ message: "Failed to update product stock" });
    }
  });

  // Legacy endpoint for backward compatibility
  app.post('/api/products/:id/stock', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const { quantity, reason } = req.body;

      await storage.updateProductStock(id, quantity, user.id, reason);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating product stock:", error);
      res.status(500).json({ message: "Failed to update product stock" });
    }
  });

  // (duplicate ingredients & stock routes removed — preserved earlier definitions above)

  app.post('/api/ingredients/:id/stock', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const { quantity, reason } = req.body;

      await storage.updateComponentStock(id, quantity, user.id, reason);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating ingredient stock:", error);
      res.status(500).json({ message: "Failed to update ingredient stock" });
    }
  });

  // (duplicate recipe ingredients route removed - already defined earlier)

  // Favorite combos / quick favorites
  app.get('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const isAdminUser = req.session?.user?.role === 'admin';
      const includeInactive = req.query.includeInactive === 'true' && isAdminUser;
      const combos = await storage.getFavoriteCombos(includeInactive);
      res.json(combos);
    } catch (error) {
      console.error('Error fetching favorite combos:', error);
      res.status(500).json({ message: 'Failed to load favorites' });
    }
  });

  app.post('/api/favorites', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const payload = favoriteComboCreateSchema.parse(req.body);
      const { items, ...comboData } = payload;
      const combo = await storage.createFavoriteCombo(comboData, items);
      res.status(201).json(combo);
    } catch (error) {
      console.error('Error creating favorite combo:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map((e) => e.message).join(', ') });
      }
      res.status(500).json({ message: (error as Error).message || 'Failed to create favorite combo' });
    }
  });

  app.put('/api/favorites/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const payload = favoriteComboUpdateSchema.parse(req.body);
      const { items, ...comboData } = payload;
      const combo = await storage.updateFavoriteCombo(req.params.id, comboData, items);
      res.json(combo);
    } catch (error) {
      console.error('Error updating favorite combo:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map((e) => e.message).join(', ') });
      }
      res.status(500).json({ message: (error as Error).message || 'Failed to update favorite combo' });
    }
  });

  app.delete('/api/favorites/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteFavoriteCombo(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting favorite combo:', error);
      res.status(500).json({ message: 'Failed to delete favorite combo' });
    }
  });

  // Orders
  app.get('/api/orders', isAuthenticated, async (req, res) => {
    try {
      const { status, limit, sentToBarista, include_items } = req.query as any;
      let orders;

      if (status) {
        // If include_items is set, use the optimized endpoint that returns items inline
        if (include_items === 'true') {
          orders = await storage.getOrdersByStatusWithItems(status as string);
        } else {
          orders = await storage.getOrdersByStatus(status as string);
        }
      } else {
        orders = await storage.getOrders(limit ? parseInt(limit as string) : undefined);
      }

      // Optional filter: only orders explicitly sent to barista
      if (sentToBarista === 'true') {
        orders = orders.filter((order: any) => order.sentToBarista);
      }

      // Exclude archived orders by default unless explicitly asked
      const includeArchived = typeof req.query.includeArchived === 'string' && req.query.includeArchived === 'true';
      if (!includeArchived) {
        orders = orders.filter((order: any) => !order.archived);
      }

      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager', 'cashier', 'courier'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Handle both old format (with separate order/items) and new format (all in one)
      let orderData, items;
      if (req.body.order && req.body.items) {
        // Old format from cashier
        orderData = req.body.order;
        items = req.body.items;
      } else {
        // New format from courier
        const { items: itemsData, ...restData } = req.body;
        orderData = restData;
        items = itemsData;
      }



      // Get next order number
      const orderNumber = await storage.getNextOrderNumber();

      // Calculate subtotal from items (including selected option price adjustments if flag enabled)
      let subtotal = 0;
      const optionalIngredientCache: Record<string, any[]> = {};
      const recipeIngredientCache: Record<string, any[]> = {};
      for (const item of items) {
        const baseUnitPrice = parseFloat(item.unitPrice || item.price || '0');
        let optionAdjustTotal = 0;
        let selectedOptionIds: string[] = [];
        const optionSummaries: string[] = [];
        if (ENABLE_OPTIONS_SYSTEM && Array.isArray(item.selectedOptionIds) && item.selectedOptionIds.length) {
          const uniqueOptionIds = Array.from(new Set(item.selectedOptionIds.map((id: any) => String(id))));
          const optionEntities = await (storage as any).getOptionsByIds(uniqueOptionIds);
          selectedOptionIds = optionEntities.map((o: any) => o.id);
          for (const opt of optionEntities) {
            const adj = parseFloat(opt.priceAdjust || '0');
            if (!isNaN(adj)) optionAdjustTotal += adj;
            const adjLabel = !isNaN(adj) && adj !== 0 ? ` (${adj >= 0 ? '+' : ''}$${Math.abs(adj).toFixed(2)})` : '';
            optionSummaries.push(`${opt.name}${adjLabel}`);
          }
        }

        const optionalSummaries: string[] = [];
        let selectedOptionalIngredientIds: string[] = [];
        if (Array.isArray(item.selectedOptionalIngredientIds) && item.selectedOptionalIngredientIds.length) {
          const uniqueOptionalIds = Array.from(new Set(item.selectedOptionalIngredientIds.map((id: any) => String(id))));
          if (!optionalIngredientCache[item.productId]) {
            optionalIngredientCache[item.productId] = await storage.getOptionalProductComponents(item.productId);
          }
          const optionalMap = new Map(
            (optionalIngredientCache[item.productId] || []).map((row: any) => [row.recipeIngredientId, row])
          );

          for (const optId of uniqueOptionalIds) {
            const detail = optionalMap.get(optId);
            if (!detail) {
              return res.status(400).json({
                message: `Invalid optional ingredient selection for product ${item.productId}`
              });
            }
            selectedOptionalIngredientIds.push(detail.recipeIngredientId);
            const parsedQty = detail.quantity ? parseFloat(detail.quantity) : NaN;
            const hasQty = !isNaN(parsedQty) && parsedQty > 0;
            const qtyLabel = hasQty
              ? `${Number(parsedQty.toFixed(3)).toString()}${detail.unit ? ` ${detail.unit}` : ''}`
              : '';
            optionalSummaries.push(qtyLabel ? `${detail.ingredientName} (${qtyLabel})` : detail.ingredientName);
          }
        }

        const effectiveUnitPrice = baseUnitPrice + optionAdjustTotal;
        const lineTotal = effectiveUnitPrice * item.quantity;
        item.__effectiveUnitPrice = effectiveUnitPrice.toFixed(2);
        item.__lineTotal = lineTotal.toFixed(2);
        item.__resolvedOptionIds = selectedOptionIds;
        item.__selectedOptionalIngredientIds = selectedOptionalIngredientIds;

        const noteParts: string[] = [];
        if (item.notes && typeof item.notes === 'string' && item.notes.trim().length) {
          noteParts.push(item.notes.trim());
        }
        if (item.modifications && typeof item.modifications === 'string' && item.modifications.trim().length) {
          noteParts.push(item.modifications.trim());
        }
        if (optionSummaries.length && !(item.modifications && item.modifications.includes('Options:'))) {
          noteParts.push(`Options: ${optionSummaries.join(', ')}`);
        }
        if (optionalSummaries.length && !(item.modifications && item.modifications.includes('Optional:'))) {
          noteParts.push(`Optional: ${optionalSummaries.join(', ')}`);
        }

        item.__compiledModifications = noteParts.length
          ? Array.from(new Set(noteParts)).join(' | ')
          : null;

        subtotal += lineTotal;
      }

      // print placeholder with appropriate user ID based on role and required fields
      const orderWithNumber = {
        ...orderData,
        orderNumber,
        subtotal: subtotal.toFixed(2),
        tax: '0.00', // Tax-inclusive pricing - no separate tax
        total: subtotal.toFixed(2), // For now, total equals subtotal (no tax)
        status: orderData.status || 'pending', // All new orders start as pending for cashier processing
        // cashierId is NOT NULL in schema, so for courier-created orders we temporarily
        // assign the courier as the cashier to satisfy the constraint. We also set courierId
        // so later workflow steps can still identify the originating courier.
        cashierId: user.id,
        courierId: user.role === 'courier' ? user.id : undefined
      };
      // Ensure only authorized roles can mark an order as sentToBarista on creation
      if (orderWithNumber.sentToBarista && !['admin', 'manager', 'cashier'].includes(user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions to send order to barista' });
      }

      console.log('Creating order with data:', JSON.stringify(orderWithNumber, null, 2));
      console.log('Subtotal value:', subtotal, 'Type:', typeof subtotal);
      console.log('Items:', JSON.stringify(items, null, 2));

      let order;
      try {
        order = await storage.createOrderTransaction(orderWithNumber, items, user.id);
      } catch (err) {
        console.error('Order transaction failed:', err);
        // Bubble up as 409 conflict if the error indicates insufficient stock
        if (err && (err as Error).message && (err as Error).message.includes('Insufficient')) {
          return res.status(409).json({ message: (err as Error).message });
        }
        throw err;
      }

      // Order items and inventory were managed in storage.createOrderTransaction

      // Broadcast order update via WebSocket
      broadcastOrderUpdate(order);

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Call customer - mark order called_at to start auto-archival countdown
  app.post('/api/orders/:id/call', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      const updateData: any = { calledAt: new Date(), status: 'ready' };
      const updated = await storage.updateOrder(id, updateData);
      broadcastOrderUpdate(updated);
      res.json(updated);
    } catch (error) {
      console.error('Error calling customer for order:', error);
      res.status(500).json({ message: 'Failed to call customer' });
    }
  });

  // Get single order with details (for printing etc)
  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrderWithDetails(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order details:", error);
      res.status(500).json({ message: "Failed to fetch order details" });
    }
  });

  app.patch('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updateData = req.body;
      // Only allow marking sentToBarista by cashier/manager/admin roles
      if (typeof updateData.sentToBarista !== 'undefined' && updateData.sentToBarista === true) {
        if (!['admin', 'manager', 'cashier'].includes(user.role)) {
          return res.status(403).json({ message: 'Insufficient permissions to send order to barista' });
        }
      }

      // Set timestamps based on status changes
      if (updateData.status === 'ready' && !updateData.readyAt) {
        updateData.readyAt = new Date();
      } else if (updateData.status === 'delivered' && !updateData.deliveredAt) {
        updateData.deliveredAt = new Date();
      }

      // Set user assignments based on role and status
      if (updateData.status === 'preparing' && user.role === 'technician') {
        updateData.baristaId = user.id;
      } else if (updateData.status === 'delivered' && user.role === 'courier') {
        updateData.courierId = user.id;
      }

      const order = await storage.updateOrder(id, updateData);
      if (typeof updateData.sentToBarista !== 'undefined' && updateData.sentToBarista === true) {
        try {
          await storage.createActivityLog({
            userId: user.id,
            action: 'send_to_barista',
            success: true,
            details: { orderId: id },
          });
        } catch (e) {
          console.warn('Failed to create activity log for send_to_barista', e);
        }
      }

      // Broadcast order update via WebSocket
      broadcastOrderUpdate(order);

      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // PUT endpoint for complete order updates (including items)
  app.put('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { order: orderData, items } = req.body;

      // Update the order
      const updatedOrder = await storage.updateOrder(id, orderData);

      // If items are provided, update them too
      if (items && Array.isArray(items)) {
        // Delete existing order items
        await storage.deleteOrderItems(id);

        // Create new order items
        for (const item of items) {
          await storage.createOrderItem({
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            modifications: item.modifications
          });
        }
      }

      // Broadcast order update via WebSocket
      broadcastOrderUpdate(updatedOrder);

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.get('/api/orders/:id/items', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getOrderItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching order items:", error);
      res.status(500).json({ message: "Failed to fetch order items" });
    }
  });

  // Delete order (only for admin and cashier)
  app.delete('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const { id } = req.params;

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only allow admins and cashiers to delete orders
      if (!['admin', 'cashier'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions to delete orders" });
      }

      await storage.deleteOrder(id);

      // Broadcast order deletion to all connected clients
      broadcast({
        type: 'order_deleted',
        orderId: id
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Inventory
  app.get('/api/inventory/low-stock', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const [products, ingredients] = await Promise.all([
        storage.getLowStockProducts(),
        storage.getLowStockComponents()
      ]);

      // Attach productComponents for component_based products
      const withRecipes = await Promise.all(products.map(async (p) => {
        if (p.type === 'component_based') {
          const productComponents = await storage.getProductComponents(p.id);
          return { ...p, productComponents };
        }
        return p;
      }));

      res.json({ products: withRecipes, components: ingredients });
    } catch (error) {
      console.error("Error fetching low stock items:", error);
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  // Analytics
  app.get('/api/analytics/today', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      try {
        const [sales, topProducts, lowStock] = await Promise.all([
          storage.getTodaysSales(),
          storage.getTopProducts(5),
          storage.getLowStockProducts()
        ]);

        // Ensure we always return valid data structure
        res.json({
          sales: sales || { total: 0, count: 0 },
          topProducts: topProducts || [],
          lowStockCount: (lowStock && lowStock.length) || 0
        });
      } catch (dbError) {
        console.warn('Database analytics error, returning defaults:', dbError);
        // Return default values if database queries fail
        res.json({
          sales: { total: 0, count: 0 },
          topProducts: [],
          lowStockCount: 0
        });
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get('/api/analytics/sales', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { days = '7' } = req.query;
      const salesData = await storage.getSalesData(parseInt(days as string));
      res.json(salesData);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      res.status(500).json({ message: "Failed to fetch sales data" });
    }
  });

  // Gamification API routes
  app.get('/api/leaderboard', isAuthenticated, async (req: any, res) => {
    try {
      const { month, year } = req.query;
      const currentDate = new Date();
      const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
      const targetYear = year ? parseInt(year) : currentDate.getFullYear();

      const leaderboard = await storage.getLeaderboard(targetMonth, targetYear);

      // Add calculated metrics for each user
      const enrichedLeaderboard = await Promise.all(
        leaderboard.map(async (entry) => {
          const metrics = await storage.getPerformanceMetrics(entry.userId, targetMonth, targetYear);
          return {
            ...entry,
            metrics: {
              averageOrderTime: metrics?.averageOrderTime || '0',
              accuracyRate: metrics?.accuracyRate || '0',
              upsellSuccessRate: metrics?.upsellSuccessRate || '0',
              achievementsEarned: (await storage.getUserAchievements(entry.userId)).length
            }
          };
        })
      );

      res.json(enrichedLeaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get('/api/user-performance', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const metrics = await storage.getPerformanceMetrics(user.id, month, year);
      const achievements = await storage.getUserAchievements(user.id);
      const leaderboard = await storage.getLeaderboard(month, year);

      const userRank = leaderboard.findIndex(entry => entry.userId === user.id) + 1;

      if (!metrics) {
        // Return default values if no metrics exist yet
        return res.json({
          totalOrders: 0,
          totalSales: '0.00',
          averageOrderTime: '0.0',
          accuracyRate: '0.0',
          upsellSuccessRate: '0.0',
          achievementsEarned: achievements.length,
          totalScore: 0,
          rank: userRank || 999,
          monthlyRank: userRank || 999,
          tutorialModulesCompleted: 0
        });
      }

      res.json({
        totalOrders: metrics.totalOrders,
        totalSales: metrics.totalSales,
        averageOrderTime: metrics.averageOrderTime,
        accuracyRate: metrics.accuracyRate,
        upsellSuccessRate: metrics.upsellSuccessRate,
        achievementsEarned: achievements.length,
        totalScore: metrics.totalScore,
        rank: userRank || 999,
        monthlyRank: userRank || 999,
        tutorialModulesCompleted: metrics.tutorialModulesCompleted
      });
    } catch (error) {
      console.error("Error fetching user performance:", error);
      res.status(500).json({ message: "Failed to fetch user performance" });
    }
  });

  app.get('/api/achievements', isAuthenticated, async (req, res) => {
    try {
      const achievements = await storage.getAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get('/api/user-achievements', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userAchievements = await storage.getUserAchievements(user.id);
      res.json(userAchievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  app.get('/api/recent-achievements', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userAchievements = await storage.getUserAchievements(user.id);
      // Return the 5 most recent achievements
      const recentAchievements = userAchievements
        .slice(0, 5)
        .map(ua => ({
          ...ua.achievement,
          earnedAt: ua.earnedAt,
          notified: ua.notified
        }));

      res.json(recentAchievements);
    } catch (error) {
      console.error("Error fetching recent achievements:", error);
      res.status(500).json({ message: "Failed to fetch recent achievements" });
    }
  });

  // Currency management routes
  app.get('/api/currency/current', async (req, res) => {
    try {
      const currentRate: any = await storage.getCurrentExchangeRate();
      if (!currentRate) {
        console.warn('[currency] No active exchange rate found');
        return res.status(404).json({ error: 'No exchange rate found' });
      }
      // Normalize keys in case raw client row shape differs
      const normalized = {
        id: currentRate.id,
        fromCurrency: currentRate.fromCurrency || currentRate.fromcurrency,
        toCurrency: currentRate.toCurrency || currentRate.tocurrency,
        rate: currentRate.rate?.toString?.() || currentRate.rate,
        updatedBy: currentRate.updatedBy || currentRate.updatedby,
        isActive: currentRate.isActive ?? currentRate.isactive ?? true,
        createdAt: currentRate.createdAt || currentRate.createdat,
        updatedAt: currentRate.updatedAt || currentRate.updatedat,
      };
      res.json(normalized);
    } catch (error: any) {
      console.error('Error in GET /currency/current:', error?.message || error);
      res.status(500).json({ error: 'Failed to get current exchange rate' });
    }
  });

  app.get('/api/currency/history', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const history = await storage.getCurrencyRateHistory(limit);
      res.json(history);
    } catch (error) {
      console.error('Error in GET /currency/history:', error);
      res.status(500).json({ error: 'Failed to get exchange rate history' });
    }
  });

  app.post('/api/currency/update', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { fromCurrency = 'USD', toCurrency = 'LBP', rate } = req.body;

      if (!rate) {
        return res.status(400).json({ error: 'Rate is required' });
      }

      const rateData = {
        fromCurrency,
        toCurrency,
        rate: rate.toString(),
        updatedBy: user.id,
      } as any;

      const newRate = await storage.updateCurrencyRate(rateData);
      res.json(newRate);
    } catch (error) {
      console.error('Error in POST /currency/update:', error);
      res.status(500).json({ error: 'Failed to update exchange rate' });
    }
  });


  // Strategic Reports Routes
  app.get('/api/reports/strategic/heatmap', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const data = await storage.getStaffingHeatmap();
      res.json(data);
    } catch (error) {
      console.error("Error fetching heatmap:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  app.get('/api/reports/strategic/pnl', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
      console.log('DEBUG: P&L route hit', { user: user?.username, startDate });
      const data = await storage.getProfitLoss(startDate);
      console.log('DEBUG: P&L data fetched', { count: data.length });
      res.json(data);
    } catch (error) {
      console.error("Error fetching P&L:", error);
      res.status(500).json({ message: "Failed to fetch P&L data" });
    }
  });

  app.get('/api/reports/strategic/menu-matrix', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
      const data = await storage.getMenuMatrix(startDate);
      res.json(data);
    } catch (error) {
      console.error("Error fetching menu matrix:", error);
      res.status(500).json({ message: "Failed to fetch menu matrix data" });
    }
  });

  app.get('/api/reports/custom', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ message: "Start and End times are required" });
      }

      const startTime = new Date(start);
      const endTime = new Date(end);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const report = await storage.getCustomReport(startTime, endTime);
      res.json(report);
    } catch (error) {
      console.error("Error fetching custom report:", error);
      res.status(500).json({ message: "Failed to fetch custom report" });
    }
  });

  // Shift management routes
  app.get('/api/shifts', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const shifts = await storage.getShifts();
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.get('/api/reports/shift/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const report = await storage.getShiftReport(req.params.id);
      res.json(report);
    } catch (error) {
      console.error("Error fetching shift report:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch shift report" });
    }
  });

  // Receipt Settings Routes
  app.get('/api/settings/receipt', async (req, res) => {
    try {
      const settings = await storage.getReceiptSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching receipt settings:', error);
      res.status(500).json({ message: 'Failed to fetch receipt settings' });
    }
  });

  app.put('/api/settings/receipt', isAuthenticated, async (req: any, res) => {
    try {
      // Validate body with insertReceiptSettingsSchema
      const validatedSettings = insertReceiptSettingsSchema.parse(req.body);
      const settings = await storage.updateReceiptSettings(validatedSettings);
      res.json(settings);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid data provided', errors: error.errors });
      }
      console.error('Error updating receipt settings:', error);
      // Return the actual error message for debugging
      res.status(500).json({
        message: `Failed to update receipt settings: ${error instanceof Error ? error.message : String(error)}`,
        details: error
      });
    }
  });

  app.get('/api/shifts/active', isAuthenticated, async (req: any, res) => {
    try {
      const activeShifts = await storage.getActiveShifts();
      res.json(activeShifts);
    } catch (error) {
      console.error("Error fetching active shifts:", error);
      res.status(500).json({ message: "Failed to fetch active shifts" });
    }
  });

  app.get('/api/shifts/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const userShifts = await storage.getUserShifts(userId);
      res.json(userShifts);
    } catch (error) {
      console.error("Error fetching user shifts:", error);
      res.status(500).json({ message: "Failed to fetch user shifts" });
    }
  });

  app.post('/api/shifts/start', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { notes } = req.body;
      const shift = await storage.startShift(user.id, notes);
      res.json(shift);
    } catch (error) {
      console.error("Error starting shift:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch('/api/shifts/:shiftId/end', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { shiftId } = req.params;
      const { notes } = req.body;
      const shift = await storage.endShift(shiftId, notes);
      res.json(shift);
    } catch (error) {
      console.error("Error ending shift:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/reports/shifts', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { userId, startDate, endDate, role } = req.query;
      try {
        const reports = await storage.getShiftReports({
          userId: userId as string,
          startDate: startDate as string,
          endDate: endDate as string,
          role: role as string,
        });
        res.json(reports || []);
      } catch (dbError) {
        console.warn('Shift reports database error, returning empty array:', dbError);
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching shift reports:", error);
      res.status(500).json({ message: "Failed to fetch shift reports" });
    }
  });

  app.get('/api/reports/performance', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { date, role } = req.query;
      try {
        const performance = await storage.getPerformanceReports({
          date: date as string,
          role: role as string,
        });
        res.json(performance || []);
      } catch (dbError) {
        console.warn('Performance reports database error, returning empty array:', dbError);
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching performance reports:", error);
      res.status(500).json({ message: "Failed to fetch performance reports" });
    }
  });

  // Update active shift sales
  app.post('/api/shifts/update-sales', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { amount, paymentMethod } = req.body;
      if (!amount || !paymentMethod) {
        return res.status(400).json({ message: "Amount and payment method are required" });
      }

      // Find user's active shift
      const activeShifts = await storage.getActiveShifts();
      const userActiveShift = activeShifts.find(shift => shift.userId === user.id);

      if (!userActiveShift) {
        // No active shift found, this is okay - not all users may have started a shift
        return res.json({ message: "No active shift found" });
      }

      // Update shift sales
      await storage.updateShiftSales(userActiveShift.id, amount, paymentMethod);

      res.json({ message: "Shift sales updated successfully" });
    } catch (error) {
      console.error("Error updating shift sales:", error);
      res.status(500).json({ message: "Failed to update shift sales" });
    }
  });

  // Health check endpoint for monitoring
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  });

  // Phase 2: Architecture Modernization - Mount v1 modular routes
  app.use('/api/v1', v1Routes);

  const httpServer = createServer(app);

  // Initialize WebSocket Service (Shared)
  // Uses path /ws/app to avoid conflict with Vite's HMR WebSocket
  const { setupWebSocket } = await import('./services/websocket');
  wssGlobal = setupWebSocket(httpServer);

  return httpServer;

  app.use("/api/export", exportRoutes);

  // Thermal Printer Routes
  app.post('/api/print/receipt', isAuthenticated, async (req: any, res) => {
    try {
      const { receiptPrinter } = await import('./printer');
      await receiptPrinter.printReceipt(req.body);
      res.json({ success: true, message: 'Receipt printed successfully' });
    } catch (error: any) {
      console.error('Print error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/print/test', isAuthenticated, async (req: any, res) => {
    try {
      const { receiptPrinter } = await import('./printer');
      await receiptPrinter.testPrint();
      res.json({ success: true, message: 'Test print sent successfully' });
    } catch (error: any) {
      console.error('Test print error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Login route
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    // Implement your login logic here
    // For example, check username and password against the database
    // If valid, create a session and return user data
    // If invalid, return an error message
  });

  if (ENABLE_OPTIONS_SYSTEM) {
    // --- Option System Health ---
    app.get('/api/options/health', isAuthenticated, (req, res) => {
      res.json({ enabled: true });
    });

    const requireManagerOrAdmin = (user: any) => user && ['admin', 'manager'].includes(user.role);

    // --- Option Groups ---
    app.get('/api/option-groups', isAuthenticated, async (req: any, res) => {
      try {
        const groups = await (storage as any).getOptionGroups();
        res.json(groups);
      } catch (e: any) {
        console.error('List option groups error', e);
        res.status(500).json({ message: 'Failed to list option groups' });
      }
    });

    app.post('/api/option-groups', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const body = { ...req.body };
        if (body.isRequired !== undefined && body.required === undefined) body.required = body.isRequired;
        const data = insertOptionGroupSchema.parse(body);
        const group = await (storage as any).createOptionGroup(data);
        res.json(group);
      } catch (e: any) {
        const status = e?.name === 'ZodError' ? 400 : 500;
        console.error('Create option group error', e?.message || e);
        res.status(status).json({ message: 'Failed to create option group', detail: e?.message });
      }
    });

    app.patch('/api/option-groups/:id', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        const raw = { ...req.body };
        if (raw.isRequired !== undefined && raw.required === undefined) raw.required = raw.isRequired;
        const allowed = insertOptionGroupSchema.partial().parse(raw);
        const updated = await (storage as any).updateOptionGroup(id, allowed);
        res.json(updated);
      } catch (e: any) {
        const status = e?.name === 'ZodError' ? 400 : 500;
        console.error('Update option group error', e?.message || e);
        res.status(status).json({ message: 'Failed to update option group', detail: e?.message });
      }
    });

    app.delete('/api/option-groups/:id', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        await (storage as any).deleteOptionGroup(id);
        res.json({ success: true });
      } catch (e: any) {
        console.error('Delete option group error', e);
        res.status(500).json({ message: 'Failed to delete option group' });
      }
    });

    // --- Product ↔ Option Group Attachments ---
    app.get('/api/products/:id/option-groups', isAuthenticated, async (req: any, res) => {
      try {
        const { id } = req.params;
        const mappings = await (storage as any).getProductOptionGroups(id);
        res.json(mappings);
      } catch (e: any) {
        console.error('Get product option groups error', e);
        res.status(500).json({ message: 'Failed to fetch product option groups' });
      }
    });

    app.post('/api/product-option-groups', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const parsed = insertProductOptionGroupSchema.parse(req.body);
        const row = await (storage as any).attachOptionGroupToProduct(parsed.productId, parsed.optionGroupId);
        res.json(row);
      } catch (e: any) {
        console.error('Attach option group error', e?.message || e);
        res.status(500).json({ message: 'Failed to attach option group to product' });
      }
    });

    app.delete('/api/product-option-groups/:id', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        await (storage as any).detachOptionGroupFromProduct(id);
        res.json({ success: true });
      } catch (e: any) {
        console.error('Detach option group error', e?.message || e);
        res.status(500).json({ message: 'Failed to detach option group' });
      }
    });

    // --- Options ---
    app.get('/api/option-groups/:groupId/options', isAuthenticated, async (req: any, res) => {
      try {
        const { groupId } = req.params;
        const options = await (storage as any).getOptions(groupId);
        res.json(options);
      } catch (e: any) {
        console.error('List options error', e);
        res.status(500).json({ message: 'Failed to list options' });
      }
    });

    app.post('/api/options', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const data = insertOptionSchema.parse(req.body);
        const option = await (storage as any).createOption(data);
        res.json(option);
      } catch (e: any) {
        console.error('Create option error', e);
        res.status(500).json({ message: 'Failed to create option' });
      }
    });

    app.patch('/api/options/:id', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        const allowed = insertOptionSchema.partial().parse(req.body);
        const option = await (storage as any).updateOption(id, allowed);
        res.json(option);
      } catch (e: any) {
        console.error('Update option error', e);
        res.status(500).json({ message: 'Failed to update option' });
      }
    });

    app.delete('/api/options/:id', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        await (storage as any).deleteOption(id);
        res.json({ success: true });
      } catch (e: any) {
        console.error('Delete option error', e);
        res.status(500).json({ message: 'Failed to delete option' });
      }
    });

    // --- Option Ingredients ---
    app.get('/api/options/:id/ingredients', isAuthenticated, async (req: any, res) => {
      try {
        const { id } = req.params;
        const ingredients = await (storage as any).getOptionIngredients(id);
        res.json(ingredients);
      } catch (e: any) {
        console.error('Get option ingredients error', e);
        res.status(500).json({ message: 'Failed to fetch option ingredients' });
      }
    });

    app.post('/api/options/:id/ingredients', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        const payload = insertOptionComponentSchema.parse({ ...req.body, optionId: id });
        const row = await (storage as any).addOptionIngredient(payload);
        res.json(row);
      } catch (e: any) {
        console.error('Add option ingredient error', e);
        res.status(500).json({ message: 'Failed to add option ingredient' });
      }
    });

    app.delete('/api/option-ingredients/:id', isAuthenticated, async (req: any, res) => {
      try {
        if (!requireManagerOrAdmin(req.session.user)) return res.status(403).json({ message: 'Insufficient permissions' });
        const { id } = req.params;
        await (storage as any).deleteOptionIngredient(id);
        res.json({ success: true });
      } catch (e: any) {
        console.error('Delete option ingredient error', e);
        res.status(500).json({ message: 'Failed to delete option ingredient' });
      }
    });

    // --- Product Options (combined groups + options) ---
    app.get('/api/products/:id/options', isAuthenticated, async (req: any, res) => {
      try {
        const { id } = req.params;
        const mappings = await (storage as any).getProductOptionGroups(id);
        // Shape response for frontend: array of groups with options
        const groups = mappings.map((m: any) => ({
          id: m.group.id,
          name: m.group.name,
          description: m.group.description,
          selectionType: m.group.selectionType,
          minSelections: m.group.minSelections,
          maxSelections: m.group.maxSelections,
          required: m.group.required || m.mapping?.required || false,
          displayOrder: m.displayOrder || 0,
          options: m.options
        }));
        res.json(groups);
      } catch (e: any) {
        console.error('Get product options error', e);
        res.status(500).json({ message: 'Failed to fetch product options' });
      }
    });
  }

  return httpServer;
}
