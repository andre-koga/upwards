import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192x192.png", "icon-512x512.png"],
      manifest: {
        name: "Upwards",
        short_name: "Upwards",
        description: "Local-first habit tracker",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Cache YouTube thumbnails via the service worker so they work offline
            urlPattern: /^https:\/\/img\.youtube\.com\/vi\//,
            handler: "CacheFirst",
            options: {
              cacheName: "youtube-thumbnails",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              // status 0 = opaque response (cross-origin without CORS headers) — still cacheable
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
