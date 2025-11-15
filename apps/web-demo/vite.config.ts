import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    open: false,
  },
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true, // Generate source maps for debugging
    minify: "esbuild", // Use esbuild for fast minification
    target: "es2015", // Support modern browsers
    rollupOptions: {
      output: {
        // Code splitting configuration
        manualChunks: {
          // Separate vendor chunks for better caching
          leaflet: ["leaflet", "leaflet.markercluster"],
        },
        // Asset file naming patterns
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    // Add visualizer plugin only in analyze mode
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: "treemap", // Use treemap for better visualization
      }),
  ].filter(Boolean),
}));
