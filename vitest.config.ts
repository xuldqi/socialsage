import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['**/*.test.ts', '**/*.test.tsx'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
      env: {
        PACKY_API_KEY: env.PACKY_API_KEY,
        PACKY_BASE_URL: env.PACKY_BASE_URL,
        PACKY_MODEL: env.PACKY_MODEL,
      },
    },
  };
});
