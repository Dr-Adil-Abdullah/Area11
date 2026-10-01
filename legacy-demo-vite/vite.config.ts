import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH || '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.e2b.app', 'localhost'],
  },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app', 'localhost'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/zod/')) return 'validation'
          if (
            ['/node_modules/react/', '/node_modules/react-dom/', '/node_modules/scheduler/'].some(
              (name) => id.includes(name),
            )
          )
            return 'react'
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
}))
