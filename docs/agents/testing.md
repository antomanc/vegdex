# Testing

Run the full check before calling a change done:
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- E2E: `pnpm test:e2e`

## Unit tests: Vitest
- Run: `pnpm test`
- Tests live next to the code they cover or in `tests/`, named `*.test.ts`.
- Write the failing test first, then the code. Mock only process boundaries (network, shell, clock).

## Browser E2E: Playwright
- Run: `pnpm test:e2e` (specs in `e2e/`, config in `playwright.config.ts`).
- Results: `test-results/e2e.json` (Playwright's JSON report) has every test's status and errors, for agents and scripts.
- Replace the skipped starter spec with a real flow as soon as the first screen exists.
