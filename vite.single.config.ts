import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained index.html (fonts + JS + CSS inlined). Handy for sharing a demo.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist-single",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
  },
});
