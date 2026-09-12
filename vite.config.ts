import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// SPEC 0.4 -- the app must work in airplane mode start to finish. Everything is
// precached; no network call is ever on the critical path.
// A GitHub Pages PROJECT site serves at https://USER.github.io/REPO/, so every
// asset URL must be prefixed or it 404s on first load. The deploy workflow sets
// VITE_BASE=/REPO/; locally it stays "/" so `npm run dev` is unaffected.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["fonts/**/*"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,json,svg,png}"],
        navigateFallback: base + "index.html",
      },
      manifest: {
        name: "قهوه‌سنج",
        short_name: "قهوه‌سنج",
        dir: "rtl",
        lang: "fa-IR",
        display: "fullscreen",
        // module 04 needs landscape: three packages have to be visible at once
        // or the respondent satisfices instead of trading off (SPEC 2.4).
        orientation: "any",
        background_color: "#F6F8F5",
        theme_color: "#2F5D50",
        // relative, so the app works under any base path
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: { target: "es2022", sourcemap: true },
});
