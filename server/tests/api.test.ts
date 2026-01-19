import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../createApp';

// Mock DB connection module specifically
vi.mock('../db', () => ({
    db: {},
    pool: {},
    rawClient: {}
}));

// Mock storage to avoid DB calls
vi.mock('../storage', () => ({
    storage: {
        getUserByUsername: vi.fn(),
        getUser: vi.fn(),
        getAllUsers: vi.fn().mockResolvedValue([]), // Return empty array to trigger demo user creation logic
        createUser: vi.fn(),
        archiveReadyOrdersOlderThan: vi.fn(),
        // Add other methods if routes call them on startup
    }
}));

// Mock connect-pg-simple to avoid real DB connection for sessions
vi.mock('connect-pg-simple', () => {
    return {
        default: (session: any) => {
            return class MockStore extends session.Store {
                get(_sid: string, cb: any) { cb(null, null); }
                set(_sid: string, _sess: any, cb: any) { cb(null); }
                destroy(_sid: string, cb: any) { cb(null); }
                touch(_sid: string, _sess: any, cb: any) { cb(null); }
            }
        }
    }
});

// Mock init-demo-data and init-achievements
vi.mock('../init-demo-data', () => ({
    initializeDemoData: vi.fn()
}));
vi.mock('../init-achievements', () => ({
    initializeAchievements: vi.fn()
}));

// Mock feature flags
vi.mock('@shared/feature-flags', () => ({
    ENABLE_OPTIONS_SYSTEM: false
}));

describe('API Tests', () => {
    let app: any;

    beforeAll(async () => {
        // Set minimal env
        process.env.SESSION_SECRET = 'test_secret';
        // Ensure DATABASE_URL is set to something to avoid startup checks failing if any
        process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/dbname';

        const result = await createApp();
        app = result.app;
    });

    it('GET /health returns 200 healthy', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body.service).toBe('Highway Cafe POS');
    });

    it('POST /api/auth/login succeeds with demo credentials', async () => {
        // We mocked storage.getUserByUsername to return nothing (undefined) by default or we can mock rejection
        // so it falls back to demo credentials 'admin'/'admin123'
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'admin123' });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe('admin');
    });

    it('POST /api/test returns 200', async () => {
        const res = await request(app).post('/api/test');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Test successful');
    });

    it('GET /unknown-route returns 404 (handled by static serving or vite fallback, but typically 404 for API)', async () => {
        // Routes typically don't have a catch-all for API 404 in express unless defined.
        // server/index.ts (and createApp) defines error handler, but 404 is usually handled by falling through.
        // In our setup, vite/static middleware handles fallthrough.
        // But since we didn't setup vite/static in createApp (those are in index.ts after createApp), 
        // it should probably 404 or hang?
        // Actually createApp does NOT include the static serving middleware.
        // So it should 404.
        const res = await request(app).get('/api/does-not-exist');
        expect(res.status).toBe(404);
    });
});
