import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(async () => {
  const devPlugins: any[] = [];
  if (process.env.NODE_ENV !== "production") {
    const runtimeErrorOverlay = (await import("@replit/vite-plugin-runtime-error-modal")).default;
    devPlugins.push(runtimeErrorOverlay());
    if (process.env.REPL_ID !== undefined) {
      const { cartographer } = await import("@replit/vite-plugin-cartographer");
      devPlugins.push(cartographer());
    }
  }

  return {
    plugins: [
      react(),
      // VitePWA({...}), // Disabled to prevent reload loops during dev
      ...devPlugins
    ],
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "client", "src"),
        "@shared": path.resolve(process.cwd(), "shared"),
        "@assets": path.resolve(process.cwd(), "attached_assets"),
      },
    },
    root: path.resolve(process.cwd(), "client"),
    build: {
      outDir: path.resolve(process.cwd(), "dist/public"),
      sourcemap: false,
      // outDir is outside root; explicitly allow cleaning it to keep builds fresh
      emptyOutDir: true,
    },
    server: {
      host: "0.0.0.0",
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
