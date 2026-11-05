import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API = "http://127.0.0.1:7337";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: API, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
