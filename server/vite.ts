import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";

export async function setupVite(app: Express, server: Server) {
  const viteConfig = (await import("../vite.config.js")).default;
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();

  const port = parseInt(process.env.PORT || '5003', 10);

  const serverOptions = {
    middlewareMode: true,
    hmr: false, // Disabled to fix persistent reload loop
    /*
    hmr: {
      server,
      // Use the same port as the Express server
      clientPort: port,
    },
    */
    allowedHosts: true as const,
  };

  // Support both object and function default export from vite.config
  const baseConfig =
    typeof viteConfig === "function" ? await (viteConfig as any)() : viteConfig;

  const vite = await createViteServer({
    ...baseConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Debug: Log when this catch-all is reached for API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/api/')) {
      console.log('[VITE-DEBUG] API route reached catch-all:', req.method, req.originalUrl);
    }
    next();
  });

  // Only handle non-API routes with this catch-all
  // API routes are already registered in createApp before Vite setup
  app.use((req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    // Skip API routes - they should have already been handled by Express routes
    // If we reach here for an API route, it means no Express route matched
    if (url.startsWith('/api/')) {
      // Don't handle API routes here - pass to Express error handler
      return next();
    }

    // For all other routes, serve the SPA
    const clientTemplate = path.resolve(process.cwd(), "client", "index.html");

    fs.promises.readFile(clientTemplate, "utf-8")
      .then(template => vite.transformIndexHtml(url, template))
      .then(page => {
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      })
      .catch(e => {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      });
  });
}
