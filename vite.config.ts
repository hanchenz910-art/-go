import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["demo.sxlist.json", "images/*.jpg", "icon.svg"],
      manifest: {
        name: "休息有据",
        short_name: "休息有据",
        lang: "zh-CN",
        description: "企业、办公室和工厂的作息资料目录",
        theme_color: "#087f73",
        background_color: "#f6f7f9",
        display: "standalone",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,json,woff2}"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
