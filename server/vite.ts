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
    hmr: {
      server,
      // Use the same port as the Express server
      clientPort: port,
    },
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
  app.use("*", async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
