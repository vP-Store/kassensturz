import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Auf GitHub Pages liegt die App unter /<repo>/ — deshalb ist der Basispfad
// über VITE_BASE einstellbar (lokal einfach "/").
const base = process.env.VITE_BASE ?? "/kassensturz/";

export default defineConfig({
  base,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [tailwindcss(), react()],
  build: { target: "es2022", sourcemap: false },
});
