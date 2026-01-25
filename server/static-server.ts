import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Add CORS headers for static assets (required for crossorigin script tags)
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
      res.header('Access-Control-Allow-Origin', '*');
    }
    next();
  });

  app.use(express.static(distPath));

  // Serve uploads from persistent storage (client/public/uploads)
  const uploadsPath = path.resolve(process.cwd(), "client/public/uploads");
  if (fs.existsSync(uploadsPath)) {
    console.log(`📂 Serving uploads from: ${uploadsPath}`);
    app.use("/uploads", express.static(uploadsPath));
  } else {
    console.warn(`⚠️ Uploads directory not found at: ${uploadsPath}`);
  }

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
