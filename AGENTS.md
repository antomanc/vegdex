# vegdex

AI-first web project configured with `aginit` (Web, node).

## Core Invariants
- Keep changes small, focused, and test-verified.
- Prefer native language & platform capabilities over heavy external frameworks.
- Never commit broken builds, failed typechecks, or unverified changes.
- Tests: Playwright e2e covers the user flows (`e2e/`, run against the fixture dataset in `e2e/fixtures/`); Vitest covers domain logic (`packages/*/test/`). Skip unit tests that just mirror the implementation. Never delete or weaken a test to make it pass; delete one only together with the behavior it covers.
- Vegan only: every source must be an all-vegan publisher, and recipes flagged by `findNonVegan` are never published.

## Essential Commands
- Package Manager: `pnpm`
- Dev Server: `pnpm dev`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Unused files, exports and dependencies: `pnpm knip` (config in `knip.json`; runs in CI)
- Test: `pnpm test`
- Test (E2E / Browser): `pnpm test:e2e` (summary in `test-results/e2e.json`)
- Performance on a throttled phone: `pnpm perf` (build first, with real data from `pnpm ingest emit`; see `docs/adr/0007`)
- Preview for agent-browser: `pnpm preview:start` builds and serves http://localhost:4173 in the background (again to rebuild); `pnpm preview:stop` stops it

<!-- aginit:start — managed by npx @antomanc/aginit (re-run to refresh) -->
## Bootstrap & First Session
When the user asks to "bootstrap this project" or kicks off a new initiative:
1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.
2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).
3. Plan in small verifiable increments and implement test-first using installed skills.

## Guardrails (karpathy-guidelines)
- **Think before coding**: state assumptions and trade-offs; ask instead of guessing.
- **Simplicity first**: minimum code that solves the problem; no speculative features or abstractions.
- **Surgical changes**: touch only what the task needs; no silent scope creep or drive-by refactors.
- **Goal-driven execution**: define a verifiable success check first, then loop until it passes.

## Task Routing
Load only what the task needs. Skills live in `.agents/skills/` (linked into `.claude/skills/` for Claude Code).

| Task | Read / Use |
| --- | --- |
| Product intent, scope, target users | `PRODUCT.md` |
| UI/UX design system, anti-slop review | `DESIGN.md` + `.agents/skills/impeccable` |
| Automated unit & E2E testing | `docs/agents/testing.md` |
| Filling new ingredient lines (line records) | `docs/agents/vocabulary.md`, "Running a fill" |
| Live UI verification (Web / Mobile) | `docs/agents/ui-verification.md` |
| Engineering workflow & skills | `docs/agents/workflows.md` |
| Scoping or simplifying a change | `ponytail` skill |
| Prose & Copy (docs, README, UI text) | `humanizer` skill |

## Anti-Rationalization
| Excuse | Rule |
| --- | --- |
| "It's a small UI tweak, visual verification isn't needed." | Forbidden. Run agent-browser, inspect the snapshot/screenshot, and confirm zero console/runtime errors (`agent-browser errors`). |
| "Unit tests pass, so the feature works." | Insufficient. Unit tests do not verify wiring or rendering. Exercise the feature end to end (`pnpm test:e2e`) before marking complete. |
<!-- aginit:end -->

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on antomanc/vegdex, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label named after its role (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
