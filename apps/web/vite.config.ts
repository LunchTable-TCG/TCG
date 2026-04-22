import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("/three/") || id.includes("/@react-three/fiber/")) {
            return "three-runtime";
          }

          if (id.includes("/pixi.js/") || id.includes("/@pixi/react/")) {
            return "pixi-runtime";
          }

          return undefined;
        },
      },
    },
  },
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [react()],
});
