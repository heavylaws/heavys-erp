import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./logger";
import { initializeDemoData } from "./init-demo-data";
import { initializeAchievements } from "./init-achievements";
import { registerHealthCheck } from "./health-check";
import helmet from "helmet";

export async function createApp() {
    const app = express();

    // Security headers - must be early in middleware chain
    // Temporarily disabled for debugging local network access from mobile
    /*
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for React dev
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'", "ws:", "wss:"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false, // Required for LAN access from phones
    }));
    */

    // CORS middleware for frontend-backend communication
    app.use((req, res, next) => {
        const origin = req.headers.origin;

        // Allow any origin for local network access
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
        }
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    app.use((req, res, next) => {
        const start = Date.now();
        const path = req.path;
        let capturedJsonResponse: Record<string, any> | undefined = undefined;

        const originalResJson = res.json;
        res.json = function (bodyJson, ...args) {
            capturedJsonResponse = bodyJson;
            return originalResJson.apply(res, [bodyJson, ...args]);
        };

        res.on("finish", () => {
            const duration = Date.now() - start;
            if (path.startsWith("/api")) {
                let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
                if (capturedJsonResponse) {
                    logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
                }

                if (logLine.length > 80) {
                    logLine = logLine.slice(0, 79) + "…";
                }

                log(logLine);
            }
        });

        next();
    });

    // Register health check endpoint for Docker monitoring
    registerHealthCheck(app);

    // CRITICAL: Register all API routes BEFORE Vite setup to prevent catch-all conflicts
    const server = await registerRoutes(app);

    // Initialize demo data and achievements after routes are set up
    try {
        await initializeDemoData();
        await initializeAchievements();
    } catch (error) {
        console.error("Failed to initialize demo data:", error);
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        res.status(status).json({ message });
        throw err;
    });

    return { app, server };
}
