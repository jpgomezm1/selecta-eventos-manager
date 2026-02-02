import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // ⬅️ Babel en vez de SWC
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 4000,
    strictPort: false,
  },
  plugins: [
    react({
      jsxImportSource: "react",
      babel: {
        plugins: [],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
