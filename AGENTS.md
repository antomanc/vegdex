# vegdex

AI-first web project configured with `aginit` (Web, node).

## Core Invariants
- Keep changes small, focused, and test-verified.
- Prefer native language & platform capabilities over heavy external frameworks.
- Never commit broken builds, failed typechecks, or unverified changes.
- Tests: Playwright e2e covers the user flows (`e2e/`, run against the fixture dataset in `e2e/fixtures/`); Vitest covers domain logic (`packages/*/test/`) and the web app's reactive helpers (`apps/web/src/**/*.svelte.test.ts`, with happy-dom). Skip unit tests that just mirror the implementation. Never delete or weaken a test to make it pass; delete one only together with the behavior it covers. If a test contradicts the task, stop and report the conflict.
- Vegan only: every source must be an all-vegan publisher, and recipes flagged by `findNonVegan` are never published.

## Essential Commands
- Package Manager: `pnpm`
- Dev Server: `pnpm dev`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Unused files, exports and dependencies: `pnpm knip` (config in `knip.json`; runs in CI)
- Verify: `pnpm verify` (CI runs `node scripts/verify.mjs`) runs the conventions check (`scripts/check-conventions.mjs`), the reactive-helper test check, fixtures check, typecheck, knip and unit tests. Effects and timers in the web app go through the helpers in `apps/web/src/lib/reactive`; when none fits, add one there named for its job, with a test beside it.
- Test: `pnpm test`
- Test (E2E / Browser): `pnpm test:e2e` (summary in `test-results/e2e.json`); it regenerates `e2e/fixtures/` first, and `pnpm fixtures:check` (in CI) fails when the committed fixtures lag
- Performance on a throttled phone: `pnpm perf` (build first, with real data from `pnpm ingest emit`; see `docs/adr/0007`)
- Preview for agent-browser: `pnpm preview:start` builds and serves http://localhost:4173 in the background (again to rebuild); `pnpm preview:stop` stops it


## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on antomanc/vegdex, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label named after its role (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.

## Checks
- `node scripts/verify.mjs` runs every check. Run it before calling work done; CI runs the same command.
- A failing check says what to do instead. Fix the cause; an exception names the rule and says why on the same line.
- A mistake corrected twice becomes a check in the conventions script or the linter, not a new line here.
- `docs/agents/feature-map.md` names every screen and control with the code behind it; keep it current.
