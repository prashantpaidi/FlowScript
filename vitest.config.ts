import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/apps/extension-e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
