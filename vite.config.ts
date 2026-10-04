import { defineConfig } from "vite"

export default defineConfig({
  server: {
    host: "192.168.1.19",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://192.168.1.19:8089",
        changeOrigin: true,
      },
    },
  },
})
