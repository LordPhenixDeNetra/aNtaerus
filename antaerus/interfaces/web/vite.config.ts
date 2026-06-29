import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from "vite-plugin-trae-solo-badge";

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: "hidden",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  plugins: [
    react({
      babel: {
        plugins: ["react-dev-locator"],
      },
    }),
    traeBadgePlugin({
      variant: "dark",
      position: "bottom-right",
      prodOnly: true,
      clickable: true,
      clickUrl: "https://www.trae.ai/solo?showJoin=1",
      autoTheme: true,
      autoThemeTarget: "#root",
    }),
    tsconfigPaths(),
  ],
});
