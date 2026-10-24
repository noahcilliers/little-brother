import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin /api calls, so the API needs no CORS setup.
    proxy: { "/api": "http://localhost:3001" },
  },
});
