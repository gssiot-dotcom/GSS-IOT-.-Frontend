import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Radix komponentlarini to'g'ri optimallashtirish uchun
    include: ['@radix-ui/react-scroll-area'],
  },
  server: {
    port: 5173, // 프론트 실행 포트
    proxy: {
      // ✅ 추가된 부분: /api → 백엔드로 프록시
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
})
