# Existing-issue review before promotion

Research snapshot: 2026-11-02. Read-only GitHub review; no tickets or labels changed. This supplements the broader product/UI audit. Sources are the project's own issues, PRs, workflow runs, and product documentation. Issue assertions are explicitly separated from independently exercised behavior.

## Recommendation

The existing launch umbrella identifies the right first work: verify the completed share presentation, measure publisher visits, and provide a creator contact path. Do not postpone promotion for the entire backlog. Do postpone paid acquisition until those three work end to end, and until the specific mobile landing flow used by the campaign has been tested on the deployed build.

The success event is an outbound visit to a publisher, not a save, an install, or time spent browsing. This follows [the product purpose](../../apps/web/PRODUCT.md). Saves and shopping-list usage are useful secondary signals, but optimizing them alone could make Vegdex worse at its actual job.

## Tracker inventory and decisions

The research began with 11 open issues. During the review #9 and #55 closed; the final refresh found nine open issues. Recently closed issues were reviewed to avoid recommending completed work.

| Issue | State at snapshot | Recommended treatment | Why |
| --- | --- | --- | --- |
| [#54 Promotion readiness](https://github.com/antomanc/vegdex/issues/54) | Open umbrella | Keep as release gate; refresh checklist | It still lists title normalization unchecked although #9 closed today. No native blockers were attached when read. |
| [#55 Large share cards](https://github.com/antomanc/vegdex/issues/55) | Closed during review at 22:20 UTC | Verify deployment before promotion | Confirm the completed work renders correctly on the actual campaign platforms; do not reimplement it. |
| [#56 Privacy-friendly analytics](https://github.com/antomanc/vegdex/issues/56) | ready-for-human | Before spending | Paid traffic without publisher-click attribution cannot tell us whether the app helped anyone choose dinner. Provider/account remains an owner decision. |
| [#57 Creator note and opt-out](https://github.com/antomanc/vegdex/issues/57) | needs-info | Before public promotion | Increased visibility reaches publishers as well as cooks. A reachable, respectful contact path supports the creator-first positioning. |
| [#4 Offline E2E coverage](https://github.com/antomanc/vegdex/issues/4) | Open | Before advertising offline; otherwise early hardening | The product explicitly promises offline use, but the issue records that current fixture tests block service workers. This is missing evidence, not a proven offline bug. |
| [#41 Translation backlog](https://github.com/antomanc/vegdex/issues/41) | Open recurring operations | Target campaign-relevant gaps | Quality of the promoted Italian experience matters more than eliminating every vocabulary gap. Keep publication gates intact. |
| [#5 Vegan exclusions/source policy](https://github.com/antomanc/vegdex/issues/5) | Open recurring operations | Perform bounded review before promotion; retain recurring | The product's core guarantee depends on source policy remaining true. This work has no meaningful permanent “done.” |
| [#3 Backfill rate limits](https://github.com/antomanc/vegdex/issues/3) | Open, older assumption | Reconcile with current ingest evidence; close if fulfilled | Its estimate is about 15–16k recipes; PR #53 already measured 16,020. Count alone does not prove every blocked publisher recovered. |
| [#1 Publish CLI/MCP](https://github.com/antomanc/vegdex/issues/1) | Open | Defer for cook-facing promotion | Different audience and onboarding. Worth doing before agent/developer promotion or publicly advertising npx usage. |
| [#51 Substitutions](https://github.com/antomanc/vegdex/issues/51) | needs-triage | Research/prototype after launch learning | Contextual substitution is substantial domain work, especially quantity and culinary role. A global ingredient replacement table would be misleading. |

### Already completed: do not reopen by accident

- [#49 Search/filter performance](https://github.com/antomanc/vegdex/issues/49) closed through [PR #53](https://github.com/antomanc/vegdex/pull/53). That PR reports 946 ms first card, 3,171 ms searchable catalog, 64 ms slowest keystroke and filter tap on its throttled Pixel 7 profile, medians of five runs. These are recorded implementation results, not a fresh measurement by this review or a guarantee for every phone/network. It reports 328 unit and 216 E2E tests. Confirm production behavior and filtered campaign arrivals, rather than starting another performance rewrite.
- [#9 Title capitalization](https://github.com/antomanc/vegdex/issues/9) closed through [PR #58](https://github.com/antomanc/vegdex/pull/58) today. The local checkout during this review remained on the #53 merge, so local UI observations may legitimately differ from the newest deployed data. The deployment for #58 was running when inspected: [workflow run](https://github.com/antomanc/vegdex/actions/runs/41536148214). Verify deployment completion before treating casing as shipped.
- Italian routes, translations, source language filtering, original Italian publisher support, problem reports, servings controls, shopping-list concept merging and compatible-unit work all have closed tickets. Audit their behavior; do not create duplicate implementation requests merely from their names.

## Make the launch issues stronger

### #55: make the preview and destination agree

The now-closed issue’s spec is concrete: two localized 1200×630 PNGs, real app grid with attribution, large Twitter card, dimensions/alt metadata, committed regeneration source. Retain it.

Add these acceptance details:

1. Headline should promise one concrete job: finding dinner by ingredients and available time. Avoid catalog size as the main benefit.
2. Test English and Italian URLs separately. Verify actual deployed image URLs and bytes, not only local meta tags.
3. Open a shared link in an in-app/mobile browser; campaign and filter state must survive and produce the intended result set.
4. Confirm cropped feed variants remain legible. Keep essential text away from the extreme edges and use a small number of recognizable cards.
5. The screenshot should represent a useful first session, not a visually attractive but irrelevant random set of recipes.

Preview renders and metadata validation are release evidence. Do not infer successful X/Reddit rendering from the correct local file alone.

### #56: specify the events before choosing the service

Recommended event contract:

| Event | Trigger | Minimal useful properties |
| --- | --- | --- |
| landing | Once on visit/start according to chosen provider semantics | campaign/source, page language, landing preset |
| recipe_open | User opens a distinct recipe sheet | recipe id, publisher, page language, entry surface |
| publisher_visit | User activates Cook it link | recipe id, publisher, campaign, entry surface |
| search_completed | Search settles after input/filter changes | result-count bucket, active filter families; avoid per-keystroke logging |
| zero_results | Search settles with no results | normalized query only if privacy review allows, filter families |
| recipe_saved | Save action succeeds | recipe id, entry surface |
| shopping_open | Shopping list opens | selected recipe-count bucket |

Measure **campaign visits → publisher visits**, plus **recipe opens → publisher visits** to locate friction. Record both total events and session-level conversion only if the selected provider can support that definition; do not silently treat event counts as unique people. Do not call publisher clicks “recipes cooked”: the app cannot observe completion on an external blog.

The ticket currently proposes logging zero-result search text while requiring “no personal data.” Those are not automatically compatible: free text may contain personal information. Prefer result counts and curated ingredient concepts first; decide redaction and retention before collecting arbitrary raw queries. Likewise, do not treat “cookieless” as proof that a particular legal or disclosure obligation does not apply. The ticket supplies product constraints, not a completed privacy assessment.

Acceptance: campaign attribution is captured before UTM cleanup; cleanup preserves `?r=`, include/exclude, meal, time, locale and sort; a blocked script, offline state and navigation away never break cooking links; analytics is absent from the first-paint critical path; campaign links are checked with the real provider. Never delay outbound navigation to wait for telemetry.

**Owner inputs needed:** provider/account, event retention, allowed properties and disclosure/contact wording. These are bounded choices, not grounds to delay event design or testable instrumentation planning.

### #57: reduce contact friction

The existing GitHub prefilled issue pattern is useful for maintainers but can be a substantial barrier for a blogger without an account. Before promotion, publish an owner-approved non-GitHub contact path as well as GitHub if desired. Do not invent an email address.

The note should explain selection, what is displayed, what remains on the blog, attribution, and how to request correction/removal. Describe hotlinking truthfully; do not claim permission that has not been granted. Whether a particular use is legally permitted was not researched here, and the friendly note does not establish that permission.

Operational acceptance: locate the note from both locales, submit a safe test request, identify publisher/recipe reliably, document a removal workflow for the emitted catalog and cached assets, and acknowledge how existing offline caches may differ until refreshed. A single recipe blocklist and source removal are different actions; preserve the distinction already documented in #5 and #57.

## Operational work worth doing before a small pilot

### Bound #41 instead of demanding 100% coverage

The live ticket reports Italian ingredient-line rendering at 94.6% of 205,291 lines and title translations at 94.5% of 16,028 titles; 184 recipes held. For English on foreign-language content it reports only 16.3% ingredient-line rendering and 0.5% title translation. Those denominators describe different language pools; comparing the percentages as equivalent global quality scores would be wrong.

For an Italian campaign, manually review a bounded set of promoted matches and their original publisher pages. Include common pantry searches, quantities, preparation terms, original-text fallback, metric conversion and outbound destination language. For an English campaign, specifically inspect Italian-source results: low reverse coverage can produce an abrupt language change even though most of the overall catalog is English.

Prioritize missing everyday aliases (`olio evo`, `q.b`, `olio di semi`, common baking powder wording) using usage evidence. Hold unsafe/unmapped recipes until corrected; never trade safety for a nicer coverage number. Record sampled recipe IDs and failures so another reviewer can reproduce the check.

### Reconcile #3 and #5 with current evidence

Read the latest successful ingest logs by publisher, not just total recipe counts. Compare persistent blocked responses, published count, exclusion fraction and new held count against the preceding run. Repeated public successes already exist for [daily deployment](https://github.com/antomanc/vegdex/actions/workflows/daily.yml), but a green workflow does not prove all publishers succeeded.

For #5, inspect newly changed sources and a small sample of high-risk exclusions; confirm reporting links include recipe identity. The issue records dropped sources and reasons. Respect those decisions; do not bypass publisher blocks to restore coverage. Consider a source-health report with count deltas and exclusion spikes, an operational feature with direct product value and little UI complexity.

### #4: align the advertised offline promise with reality

The app cannot make externally hosted recipe instructions available offline because it does not store them. The offline promise should explicitly refer to browsing saved/previously loaded app content and shopping, with exact behavior tested rather than assumed. Tests should distinguish first-ever offline visit, warm app shell, opened recipe details, unopened detail shards, external images and creator destination. A cached grid alone does not prove full offline usefulness.

Add one real service-worker smoke test as the ticket requests, then exercise update/reload compatibility after a data-format change. This is valuable around PR #53, which changed catalog representation while explicitly retaining old-format reading. Avoid creating a huge offline suite before demonstrating the single advertised journey.

## Proposed sequence and release evidence

1. **Reconcile tracker/deployed revision.** Mark #9 complete in #54 after confirming its deployment; record current production commit and data timestamp. Keep #49 closed, perform phone smoke check.
2. **Choose campaign and audience.** One concrete use case, one language, one useful filtered landing. Avoid promoting every capability at once.
3. **Verify #55 and finish #57.** They can proceed independently once contact wording/input is settled. Verify preview and contact on deployed locales.
4. **Finish #56.** Provider/account decision first, minimal events second, test campaign attribution and outbound click last. This blocks paid learning.
5. **Run a bounded quality pass.** Review campaign recipes, source reports, core save/list flow, mobile Back and deep-link behavior. Include #4 if offline appears in the campaign promise.
6. **Small promotion pilot.** Spend only enough to learn whether visitors reach a publisher; define the budget and stop condition with the owner. No numerical conversion target can be responsibly derived from the current no-analytics state.
7. **Choose the next change from observed friction.** If visitors fail to open recipes, improve landing/query relevance. If they open but do not visit publishers, inspect expectation/CTA/details. If they return to build lists, prioritize list selection, export and portability. Avoid interpreting a single tiny sample as settled product demand.

## Feature direction constrained by the backlog

The strongest additions extend choosing dinner and buying ingredients without adding accounts or a backend by default:

- Useful one-tap dinner presets, also usable as campaign landings. They expose existing capability and can be tested faster than building a planner.
- Search relaxation that explains which constraint caused zero results and lets the cook remove it. Never silently relax avoid/allergen constraints.
- Separate “saved for later” from “shopping for these recipes,” if the current list behavior makes users buy ingredients for every bookmark. Validate the actual flow before filing this as a bug.
- Export/copy/share a shopping list and an explicit local-data explanation. These support the in-store context and device-only persistence model.
- Evidence-based recipe fit: matching ingredients, missing ingredients, time and known nutrition coverage. Do not imply allergy certification or complete nutrition when facts are absent.
- Later, role-specific curated substitutions in #51 with quantities, provenance and a clear route to original publisher advice. Prototype a small set such as binding vs whipping before generalizing aquafaba substitution.

Defer social feeds, public profiles, mandatory accounts, generated recipe prose, unrestricted AI substitution and a new hosting architecture unless real observed needs justify them. They expand maintenance and can obscure Vegdex's clearest advantage: getting a cook to a real publisher quickly.

## Evidence limits

This document is a tracker/product/source review, not a browser audit or new benchmark. It makes no claims about today's pixel layout, click behavior, actual analytics provider capabilities, ad-platform rules, legal permissions, Search Console data, conversion rate, or completed cooking. Those require the respective direct checks. Existing SEO research remains useful context, but is dated 2026-10-28 and should not be treated as a fresh production audit: [SEO audit](seo-audit.md), [primary-source guidance](seo-guidance.md).
