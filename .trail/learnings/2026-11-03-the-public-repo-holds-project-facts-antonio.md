---
title: "The public repo holds project facts only: no machine details, no record of who chose what"
author: Antonio
date: 2026-11-03
branch: chore/public-cleanup
cost: { minutes: 7, tokens: 58091 }
id: l-28d5cfff
scope: repo
status: active
src: agent
touches:
  - LICENSE
  - README.md
  - apps/web/vite.config.ts
  - docs/local-model-fills.md
---

## Decided
- vegdex is public and open source. Committed files, issues and PR bodies say what the project does and why, never details of one person's machine (hostnames, GPU, OS, home paths), which model or agent did the work, usage quotas, or private session links.
- Learnings and docs state a decision plainly ("cups-to-ml is ruled out"), not as a person's choice ("the user ruled it out").
- Machine-specific settings stay out of git. The dev and preview servers bind to 0.0.0.0; extra hostnames come from Vite's own env var, set in an ignored local file.

## Tried and ruled out
- Just deleting the hostnames from the Vite config: Vite then answers 403 to requests on a LAN or tailnet name, breaking remote dev access. The env var keeps it working without committing the names.

## Watch out
- Removing a file does not remove it from git history; nothing removed so far was secret, so history was not rewritten.
- `.impeccable/` critique reports contain absolute home paths and go stale fast; they stay local.

In the code: apps/web/vite.config.ts (server/preview without allowedHosts); `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=host1,.ts.net` in an untracked mise.local.toml ([env]); .gitignore lists mise.local.toml and .impeccable/; docs/local-model-fills.md replaced the one-machine setup wizard.
