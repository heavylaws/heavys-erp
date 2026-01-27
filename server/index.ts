import { createApp } from "./createApp";
import { broadcastOrderUpdate } from "./routes";
import { storage } from './storage';
import { log } from "./logger";
import { serveStatic } from "./static-server";

(async () => {
  const { app, server } = await createApp();

  // Setup Vite in development or serve static files in production
  // Setting up after all other routes so the catch-all route doesn't interfere
  const isProduction = process.env.NODE_ENV === "production";
  const isDocker = process.env.DATABASE_TYPE === "postgres";

  try {
    if (!isProduction || process.env.ENABLE_VITE === "true") {
      console.log("🔧 Setting up Vite development server...");
      const { setupVite } = await import("./vite.js");
      await setupVite(app, server);
    } else {
      console.log("📁 Serving static files for production...");
      serveStatic(app);
    }
  } catch (error) {
    console.error("Error setting up static/Vite server:", error);
    // Fallback: serve a simple index.html for production Docker
    if (isProduction && isDocker) {
      console.log("🔄 Using fallback static file serving for Docker...");
      const path = require('path');
      const express = require('express');

      // Simple static file serving without Vite
      app.use(express.static(path.join(__dirname, 'public')));
      app.get('*', (req, res) => {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        if (require('fs').existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send(`
            <!DOCTYPE html>
            <html><head><title>Highway Cafe POS</title></head>
            <body><h1>Highway Cafe POS System</h1>
            <p>Docker deployment successful! API is running.</p>
            <p><a href="/api/auth/user">Test API</a></p></body></html>
          `);
        }
      });
    } else {
      throw error;
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5003', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`🏪 Highway Cafe POS Server running on port ${port}`);
    log(`📱 Local Network Access: Connect devices to http://[YOUR-LOCAL-IP]:${port}`);
    log(`📖 See LOCAL-DEPLOYMENT.md for complete setup instructions`);
  });

  // Global Error Handling (System Hardening)
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
    // Ideally, we'd restart the process here, but for now we log it.
    // In k8s/docker, we might want to exit(1) to let orchestration restart us.
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Start periodic job to auto-archive barista 'ready' orders after configured minutes
  /*
  const AUTO_ARCHIVE_MINUTES = parseInt(process.env.AUTO_ARCHIVE_MINUTES || '10', 10);
  setInterval(async () => {
    try {
      const archivedIds = await storage.archiveReadyOrdersOlderThan(AUTO_ARCHIVE_MINUTES);
      if (archivedIds && archivedIds.length) {
        log(`📦 Auto-archived ${archivedIds.length} order(s): ${archivedIds.join(',')}`);
        // Broadcast updates for those orders so clients refresh
        for (const id of archivedIds) {
          const updated = await storage.getOrder(id);
          if (updated) broadcastOrderUpdate(updated);
        }
      }
    } catch (err) {
      console.error('Error during periodic archive job:', err);
    }
  }, 60 * 1000); // every 1 minute
  */
})();
