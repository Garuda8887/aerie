import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: serve the sibling aerie-data repo's JSON at /fund-data so "Find a fund" works without hosting it anywhere.
const fundData = (): Plugin => ({
  name: "fund-data-dev",
  configureServer(server) {
    const root = fileURLToPath(new URL("../aerie-data/data/", import.meta.url));
    server.middlewares.use("/fund-data", (req, res, next) => {
      const file = path.resolve(root, "." + decodeURIComponent((req.url ?? "").split("?")[0]));
      if (!file.startsWith(root) || !file.endsWith(".json") || !fs.existsSync(file)) return next();
      res.setHeader("content-type", "application/json");
      fs.createReadStream(file).pipe(res);
    });
  },
});

export default defineConfig({
  plugins: [react(), fundData()],
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
