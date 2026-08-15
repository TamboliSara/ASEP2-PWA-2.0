import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: 'auto',
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "EcoLocker",
        short_name: "EcoLocker",
        description:
          "Offline-first smart food donation locker with BLE controls and spoilage insights.",
        theme_color: "#193229",
        background_color: "#11211b",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ]
});
