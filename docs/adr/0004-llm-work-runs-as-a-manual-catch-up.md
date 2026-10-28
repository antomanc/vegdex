# LLM work runs as a manual catch-up on the owner's desktop, outside the nightly build

The nightly GitHub workflow stays fully automatic and deterministic: it crawls, parses with the tables, emits, deploys, and writes a queue of strings the tables could not handle. The LLM step is one command (`pnpm enrich`) that the owner runs on a desktop GPU whenever they can. It processes the queue through any OpenAI-compatible endpoint, uploads the results, and triggers a redeploy. Until it runs, untranslated text shows in its original language, so any gap between runs is safe.

Seed tables live in git and are reviewed in PRs. What the enrich run learns lives in a release asset next to the crawl store, and git wins when the two disagree. A "Translation backlog" issue, updated nightly, notifies the owner only when a recipe has been held more than 7 days.

## Considered Options

- **A self-hosted GitHub runner on the desktop.** A queued job fails after 24 hours with no runner, and on a public repo, fork pull requests could run code on the owner's machine.
- **Consumer LLM subscriptions in the nightly pipeline.** Their rate limits and terms are not built for unattended batch jobs. Subscriptions are still used for agent work in the repo, such as drafting seed tables.
- **A paid API by default.** Kept as a fallback with a hard spending cap, only if the backlog grows faster than manual runs can clear it.
