import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  // đường dẫn tương đối: chạy được ở thư mục con (GitHub Pages /<repo>/) và ở gốc tên miền
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@data": path.resolve(__dirname, "data"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1800,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/*.svg", "draco/*"],
      manifest: {
        name: "Nói Chuẩn – Luyện phát âm tiếng Việt",
        short_name: "Nói Chuẩn",
        description: "Luyện sửa lỗi ngọng l/n, ch/tr, s/x cho học sinh lớp 1–9.",
        lang: "vi",
        theme_color: "#5b4cf0",
        background_color: "#f7f6f2",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Tải trước khung app, bài học và ảnh khẩu hình. Âm thanh & gương mặt 3D được lưu dần khi dùng,
        // hoặc tải sẵn bằng nút "Tải sẵn để dùng khi mất mạng" (chỉ giọng + gương mặt con đang dùng).
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,json,wasm}"],
        globIgnores: ["**/audio/**", "**/mouth/*.mp4"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/\/audio\//, /\/models\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/audio/"),
            handler: "CacheFirst",
            options: { cacheName: "audio", expiration: { maxEntries: 2000 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("/models/") || url.pathname.includes("/mouth/"),
            handler: "CacheFirst",
            options: { cacheName: "mouth-3d", expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
});
