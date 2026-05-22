import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Plugin to handle Prisma client resolution
const prismaPlugin = {
  name: 'prisma-resolver',
  resolveId(id) {
    if (id === '@prisma/client' || id === '.prisma/client') {
      return path.resolve(__dirname, "./src/lib/prismaClient.ts");
    }
  }
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    // Proxy API + SSE to backend so EventSource works same-origin in dev
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: "::",
  },
  plugins: [prismaPlugin, react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'vendor-data': ['recharts', '@tanstack/react-query', 'date-fns', 'dayjs', 'zod'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers'],
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'cmdk'],
          'vendor-heavy': ['jspdf', 'jspdf-autotable', 'xlsx', 'googleapis'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Increased from 500 kB to account for necessary large chunks
  },
}));
