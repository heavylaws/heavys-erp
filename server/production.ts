import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeDemoData } from "./init-demo-data";
import { initializeAchievements } from "./init-achievements";
import { registerHealthCheck } from "./health-check";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();

// Security headers with CORS adjustments for LAN access
/*
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
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
  // Use wildcard for static assets (required for crossorigin script tags)
  // Otherwise use the request origin for API calls
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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

      console.log(logLine);
    }
  });

  next();
});

// Simple logging for non-API requests
function log(message: string) {
  console.log(`${new Date().toLocaleTimeString()} [express] ${message}`);
}

// Register health check endpoint for Docker monitoring
registerHealthCheck(app);

(async () => {
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

  // Production static file serving without Vite
  console.log("📁 Serving static files for production...");

  // Use a CJS/ESM compatible static directory resolution. prefer __dirname if available (CJS), otherwise fallback to dist/public under process.cwd()
  const staticDir = (typeof __dirname !== 'undefined')
    ? path.join((__dirname as unknown as string), 'public')
    : path.join(process.cwd(), 'dist', 'public');

  console.log(`🗂️  Static directory: ${staticDir}`);

  // Add CORS headers for static assets (required for crossorigin script tags)
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
      res.header('Access-Control-Allow-Origin', '*');
    }
    next();
  });

  // Serve static files
  app.use(express.static(staticDir));

  // Catch-all handler for SPA routing - EXCLUDE API routes
  app.get('*', (req, res, next) => {
    // Don't intercept API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(staticDir, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(404).send(`
          <!DOCTYPE html>
          <html><head><title>Highway Cafe POS</title></head>
          <body>
            <h1>Highway Cafe POS System</h1>
            <p>Production server is running!</p>
            <p>Static files not found. Please check build process.</p>
            <p><a href="/api/auth/user">Test API</a></p>
          </body></html>
        `);
      }
    });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || '5003', 10);

  server.listen(port, "0.0.0.0", () => {
    log(`🏪 Highway Cafe POS Server running on port ${port}`);
    log(`📱 Local Network Access: Connect devices to http://[YOUR-LOCAL-IP]:${port}`);
    log(`📖 See LOCAL-DEPLOYMENT.md for complete setup instructions`);
  });
})().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});