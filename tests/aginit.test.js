import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Starter harness: add application behavior tests as the project takes shape.
it('has a valid project manifest', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  expect(typeof pkg.name).toBe('string');
  expect(pkg.name.length).toBeGreaterThan(0);
});
