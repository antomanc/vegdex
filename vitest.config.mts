import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'repo', include: ['tests/**/*.test.{js,ts}', 'packages/*/test/**/*.test.ts'] } },
      'apps/web/vitest.config.ts'
    ]
  }
});
