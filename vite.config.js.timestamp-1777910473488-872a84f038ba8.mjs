// vite.config.js
import { fileURLToPath } from "url";
import path from "path";
import { defineConfig } from "file:///D:/Engineering/ASEP_PWA_2.0/ASEP2-PWA-2.0/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Engineering/ASEP_PWA_2.0/ASEP2-PWA-2.0/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///D:/Engineering/ASEP_PWA_2.0/ASEP2-PWA-2.0/node_modules/vite-plugin-pwa/dist/index.js";
import tailwindcss from "file:///D:/Engineering/ASEP_PWA_2.0/ASEP2-PWA-2.0/node_modules/@tailwindcss/vite/dist/index.mjs";
var __vite_injected_original_import_meta_url = "file:///D:/Engineering/ASEP_PWA_2.0/ASEP2-PWA-2.0/vite.config.js";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = path.dirname(__filename);
var vite_config_default = defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "EcoLocker",
        short_name: "EcoLocker",
        description: "Offline-first smart food donation locker with BLE controls and spoilage insights.",
        theme_color: "#193229",
        background_color: "#11211b",
        display: "standalone",
        orientation: "portrait",
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxFbmdpbmVlcmluZ1xcXFxBU0VQX1BXQV8yLjBcXFxcQVNFUDItUFdBLTIuMFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcRW5naW5lZXJpbmdcXFxcQVNFUF9QV0FfMi4wXFxcXEFTRVAyLVBXQS0yLjBcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L0VuZ2luZWVyaW5nL0FTRVBfUFdBXzIuMC9BU0VQMi1QV0EtMi4wL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJ1cmxcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiO1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XHJcbnZhciBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xyXG52YXIgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKF9fZmlsZW5hbWUpO1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIHRhaWx3aW5kY3NzKCksXHJcbiAgICAgICAgcmVhY3QoKSxcclxuICAgICAgICBWaXRlUFdBKHtcclxuICAgICAgICAgICAgcmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcclxuICAgICAgICAgICAgaW5jbHVkZUFzc2V0czogW1wiaWNvbnMvaWNvbi5zdmdcIl0sXHJcbiAgICAgICAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIkVjb0xvY2tlclwiLFxyXG4gICAgICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJFY29Mb2NrZXJcIixcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk9mZmxpbmUtZmlyc3Qgc21hcnQgZm9vZCBkb25hdGlvbiBsb2NrZXIgd2l0aCBCTEUgY29udHJvbHMgYW5kIHNwb2lsYWdlIGluc2lnaHRzLlwiLFxyXG4gICAgICAgICAgICAgICAgdGhlbWVfY29sb3I6IFwiIzE5MzIyOVwiLFxyXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjMTEyMTFiXCIsXHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBcInBvcnRyYWl0XCIsXHJcbiAgICAgICAgICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxyXG4gICAgICAgICAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogXCIvaWNvbnMvaWNvbi5zdmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZXM6IFwiYW55XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwdXJwb3NlOiBcImFueSBtYXNrYWJsZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICAgICAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnfVwiXVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgIF1cclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVQsU0FBUyxxQkFBcUI7QUFDblYsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxpQkFBaUI7QUFMeUssSUFBTSwyQ0FBMkM7QUFNbFAsSUFBSSxhQUFhLGNBQWMsd0NBQWU7QUFDOUMsSUFBSSxZQUFZLEtBQUssUUFBUSxVQUFVO0FBQ3ZDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLFdBQVcsT0FBTztBQUFBLElBQ3hDO0FBQUEsRUFDSjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ0wsWUFBWTtBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ0osY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGdCQUFnQjtBQUFBLE1BQ2hDLFVBQVU7QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxVQUNIO0FBQUEsWUFDSSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDYjtBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDTCxjQUFjLENBQUMsZ0NBQWdDO0FBQUEsTUFDbkQ7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQ0osQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
