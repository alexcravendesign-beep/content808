import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/product-api': {
        target: 'http://192.168.1.137:54100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/product-api/, ''),
      },
    },
  },
})

