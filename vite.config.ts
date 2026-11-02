import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // 排除vendor文件夹
  optimizeDeps: {
    exclude: ['vendor']
  },

  // round 122：代码分割——主 chunk 1.87MB 超 vite 500KB 告警阈值。
  // three.js（WebGL 渲染器内核）与 react 系独立分包，业务代码瘦身；
  // vendor chunk 内容稳定，浏览器与 Tauri WebView 均可长缓存。
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: [
        '**/src-tauri/**',
        '**/vendor/**',
        '**/target/**',
        '**/node_modules/**'
      ],
    },
  },
}));
