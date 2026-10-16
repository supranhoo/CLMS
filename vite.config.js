import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const headers = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:5173; form-action 'self'; object-src 'none'; base-uri 'self'; frame-src 'self' blob:",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const proxy = {
  "/api": {
    target: "http://127.0.0.1:5001",
    changeOrigin: false,
  },
};

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, headers, proxy },
  preview: { host: "127.0.0.1", port: 5173, strictPort: true, headers, proxy },
  build: { sourcemap: true },
});
