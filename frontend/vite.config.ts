import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Конфигурация Vite: React + PWA-плагин.
// vite-plugin-pwa сам генерирует service worker (кэширование ассетов для
// офлайн-работы) и подключает manifest.webmanifest, который даёт браузеру
// возможность предложить "Установить на главный экран" на телефоне.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.svg"],
      manifest: {
        name: "Plans/Finance — контроль финансов",
        short_name: "Plans/Finance",
        description: "Планирование бюджета, накоплений и трат",
        theme_color: "#0B0B0F",
        background_color: "#0B0B0F",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Во время разработки фронтенд (порт 5173) прокидывает /api на backend
      // (порт 8000), чтобы не настраивать CORS отдельно для каждого запроса.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
