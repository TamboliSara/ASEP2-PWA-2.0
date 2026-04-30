import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
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
