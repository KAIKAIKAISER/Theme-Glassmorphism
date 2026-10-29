import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss()],
  define: {
    __BUILD_VERSION__: JSON.stringify('1.4.6'),
    __BUILD_GIT_HASH__: JSON.stringify('cfsm-port'),
  },
  resolve: { alias: { '@': import.meta.dirname + '/src' } },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE ?? 'https://server-monitor-pro.strawberryhoney.workers.dev',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 2000,
  },
})
