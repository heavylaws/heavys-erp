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
      VitePWA({
        disable: process.env.NODE_ENV !== "production",
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Highway Cafe POS',
          short_name: 'Highway POS',
          description: 'Professional Point of Sale System',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 300 // 5 minutes cache for API
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      }),
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
