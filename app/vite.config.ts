import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Format as month DD, HH:MM
const buildStamp = new Date()
  .toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  .toLowerCase();
const listOfFoodAdjectives = [
  "sweet",
  "savory",
  "crispy",
  "chewy",
  "smooth",
  "icy",
  "warm",
  "cold",
  "hot",
  "cool",
  "sweet",
  "savory",
  "crispy",
  "chewy",
  "smooth",
  "icy",
  "warm",
  "cold",
  "hot",
  "cool",
];
const listOfFlavors = [
  "vanilla",
  "chocolate",
  "strawberry",
  "mint",
  "lemon",
  "ube",
  "matcha",
  "pineapple",
  "mango",
  "coconut",
];
const listOfDrinks = [
  "boba",
  "espresso",
  "tea",
  "soda",
  "juice",
  "cappuccino",
  "latte",
  "machiatto",
  "smoothie",
  "milkshake",
];
const randomPhrase = `${listOfFoodAdjectives[Math.floor(Math.random() * listOfFoodAdjectives.length)]} ${listOfFlavors[Math.floor(Math.random() * listOfFlavors.length)]} ${listOfDrinks[Math.floor(Math.random() * listOfDrinks.length)]}`;

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_BUILD_TIMESTAMP": JSON.stringify(buildStamp),
    "import.meta.env.VITE_APP_RANDOM_PHRASE": JSON.stringify(randomPhrase),
  },
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
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
