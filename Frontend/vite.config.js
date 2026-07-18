import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Keep vendor code in its own chunk so app-code changes don't bust the
    // (larger, slower-changing) vendor cache on repeat visits.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
