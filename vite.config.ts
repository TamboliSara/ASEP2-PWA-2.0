import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

function ipMiddlewarePlugin() {
  return {
    name: "ip-middleware",
    configureServer(server: any) {
      server.middlewares.use("/api/client-ip", (req: any, res: any) => {
        const rawIp =
          req.headers["cf-connecting-ip"] ||
          (req.headers["x-forwarded-for"]
            ? req.headers["x-forwarded-for"].toString().split(",")[0].trim()
            : null) ||
          req.headers["x-real-ip"] ||
          req.socket?.remoteAddress ||
          "unknown";
        const cleanIp = typeof rawIp === "string" ? rawIp.replace(/^::ffff:/, "") : "unknown";
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ ip: cleanIp }));
      });
    }
  };
}

export default defineConfig({
  server: {
    host: true,           // bind to 0.0.0.0
    port: 5173,
    allowedHosts: true    // allow ALL hosts (Cloudflare tunnels, proxies, local IPs)
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    ipMiddlewarePlugin(),
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
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('framer-motion')) return 'vendor-framer';
            if (id.includes('face-api')) return 'vendor-faceapi';
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-charts';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet';
            return 'vendor';
          }
        }
      }
    }
  }
});
