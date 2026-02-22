import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __GIT_COMMIT__: JSON.stringify('test'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
