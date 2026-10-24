import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Same-origin /api in the browser: no CORS, and credentials just work.
  server: { port: 5173, proxy: { "/api": "http://localhost:3001" } },
});
