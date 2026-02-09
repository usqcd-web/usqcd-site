// vite.config.ts
import { defineConfig } from "vite";

/**
 * Default config: use a relative base './' so built assets resolve when
 * serving the build folder locally (vite preview or npx serve).
 *
 * For building for GitHub Pages, call: npm run build:gh
 * which passes --base /usqcd-site/ to the CLI (see package.json scripts below).
 */
export default defineConfig(async () => {
  const reactPlugin = (await import("@vitejs/plugin-react")).default;

  return {
    // Use a relative base for portable local preview builds.
    base: "./",
    plugins: [reactPlugin()],
    build: {
      outDir: "build",   // keep your current outDir
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: 5173,
    },
  };
});
