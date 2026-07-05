import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Позволяет подключаться с других устройств (телефонов)
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001', // Адрес нашего будущего Node.js сервера
        ws: true // Разрешаем проксирование WebSockets
      }
    }
  }
})