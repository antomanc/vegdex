# vegdex: plan before promotion on X and Reddit

Assessment date: 2026-11-02. Scope: existing issues first, production browsing, local production build, mobile and desktop UI, product fit, retention and launch readiness. This is a planning document; no app behavior or tracker state was changed.

## Recommendation

Prepare a focused launch candidate, then run a small feedback launch before paid distribution. The product already delivers useful discovery. The next investment should improve dinner relevance, communicate what the app does, make creator handoff and sharing reliable, and establish enough measurement to learn from traffic. A broad redesign or a large feature release would delay learning without resolving the most important uncertainties.

The strongest positioning to test is: **Find tonight’s vegan dinner across trusted recipe blogs, using your time and ingredients.** Follow it with creator attribution and a short demonstration. Preserve the product’s implicit vegan positioning; do not add verification badges or unsubstantiated safety claims.

This review cannot establish “everything” that could be improved. It provides a broad, evidence-based backlog and explicitly separates observed defects, design judgments, code risks and ideas requiring user research.

## Evidence and confidence

- Product and visual constraints: [web PRODUCT](../../apps/web/PRODUCT.md), [web DESIGN](../../apps/web/DESIGN.md).
- Tracker inventory and issue-specific acceptance criteria: [existing-issue assessment](pre-promotion-issues.md). Treat that file as the detailed tracker appendix.
- Production checked at https://vegdex.antomanc.com/ at 390 × 844. The rendered catalog reported 16,035 recipes / 25 blogs. Initial mobile browse produced no captured page or console errors.
- Local production build checked at 390 × 844 and 1440 × 900. Its then-built catalog reported 16,020 recipes / 24 blogs. These are different snapshots; this is not evidence of a count defect.
- Exercised locally: Tonight, Pick for me, recipe sheet, save, Saved, shopping list, More filters, zero results, Italian homepage, desktop layout. Captured no page errors in that flow script. Creator CTA URL and rendering were inspected in source; completion of an external creator cooking journey was not verified.
- Production reproduction: [Tonight search for dog](https://vegdex.antomanc.com/?q=dog&meal=main&max=45) returns pet treats among dinner matches.
- Screenshots and raw browser transcripts from this session are in `.data/launch-audit/` (local ignored evidence, not committed). They include live-mobile, picked, filters, grocery, empty, italian and desktop PNGs.
- App source: [main UI](../../apps/web/src/App.svelte), [filters](../../apps/web/src/lib/FilterBar.svelte), [recipe sheet](../../apps/web/src/lib/RecipeSheet.svelte), [shopping list](../../apps/web/src/lib/GrocerySheet.svelte), [state and persistence](../../apps/web/src/lib/state.svelte.ts), [offline cache](../../apps/web/src/sw.ts), [metadata](../../apps/web/index.html).
- Limits: no real-user sessions, conversion history, paid campaign data, iOS Safari device test, formal screen-reader audit, fresh throttled-phone performance run, comprehensive publisher link audit or prolonged service-worker upgrade test. No paid tools or campaigns were provisioned.

## Validation result

The production build succeeded and the full fixture E2E suite passed **218 tests in 1.8 minutes** on mobile and desktop. The separately captured real-data flows produced no page errors. A follow-up local deep-link probe timed out after the E2E build replaced the served data snapshot; it provides no reliable deep-link diagnosis and is excluded from findings. The preview server was stopped after inspection.

## What already works and should be preserved

The app gets directly to recipes, uses real food photography, credits each publisher, has useful one-tap Tonight and Pick actions, remembers saves, supports combined groceries and amounts, and has thoughtful zero-result recovery. The sage/green/rose recipe-card visual system is coherent on mobile and desktop. Native modal dialogs, Back handling and meaningful labels already exist. The main opportunity is refinement of relevance and discoverability, rather than replacing the design system.

## Existing issues: act on these first

Use the linked appendix for the complete inventory, current status and dependencies. The launch umbrella is [#54](https://github.com/antomanc/vegdex/issues/54). The launch checks include the now-closed [#55 social preview](https://github.com/antomanc/vegdex/issues/55), [#56 measurement](https://github.com/antomanc/vegdex/issues/56), and [#57 creator opt-out](https://github.com/antomanc/vegdex/issues/57). Avoid creating duplicate tickets for work already tracked.

The umbrella needs a status refresh: title normalization #9, performance #49 and share cards #55 were closed on the assessment date. The final tracker refresh found nine open issues. Verify their deployed outcomes and update the launch checklist during implementation; reopening them without evidence would waste work. Closed means the issue’s stated work is complete, not that every related data-quality or UX problem is solved.

## Newly observed or insufficiently covered improvements

Priority means recommended order for this launch, not a claim that all items block any public use. Effort estimates below are relative planning judgments: S = localized change, M = several coordinated changes, L = product/data model work. They are not delivery promises.

| ID | Priority / effort | Finding and consequence | Concrete improvement and acceptance |
| --- | --- | --- | --- |
| N1 | Before promotion / M | **Pet recipes appear in Tonight on production.** Easy Homemade Dog Treats and Homemade Soft Dog Treats match `meal=main&max=45`. This contradicts the dinner task. | Add an explicit non-human-food classification/exclusion from dinner and random dinner selection. Audit other misclassified staples, sauces and recipe components. Add real examples to classification regressions. Keep corn dogs and hot dogs searchable; do not ban the word “dog.” |
| N2 | Before promotion / S | **The first mobile viewport explains little about the creator handoff.** The explanatory text is in the footer. A visitor may expect instructions inside vegdex. | Add one compact line near search/results explaining discovery and creator instructions. Test comprehension with new users; avoid a large marketing hero that pushes the food down. |
| N3 | Before promotion / S | **The random-pick recipe footer is too tall for long publisher names.** On 390px, Save + Another + “Cook it on Plant Based on a Budget” produces a four-line CTA and hides more ingredients. | Give the creator action a full-width row, with Save/Another secondary, or shorten its visible label while preserving source credit nearby. Verify long names at 320px, 390px, text zoom and Italian. The ingredient list must remain usable without an oversized sticky block. |
| N4 | Before promotion / M | **Diet labels can look more authoritative than their provenance warrants.** The sampled Red Pesto Pasta sheet showed Oil-free while its ingredient list included olive oil. This may reflect an optional ingredient or parser/rule behavior; cause not diagnosed. | Reproduce against current source and inspect ingredient optionality and tagging. Require defensible rules for free-from badges and a concise explanation that ingredient-derived tags are not cross-contact guarantees. Include oil-free and nut/soy/gluten edge cases. Do not market the app as allergy-safe. |
| N5 | Early improvement / S–M | **Grocery names can preserve messy source wording.** Sample list displayed “Gloves garlic,” while the amount was 2 cloves. “1 box” tofu is also insufficiently specific for buying. | Diagnose source typo versus vocabulary mapping; add a targeted alias only if meaning is clear. Keep package descriptors and original lines accessible when quantity cannot be standardized. Never fabricate a weight for an unspecified box. |
| N6 | Early improvement / M | **All saved recipes feed the grocery list.** Source code passes the entire saved collection to GrocerySheet. A collection of favorites becomes an unmanageably large shopping trip. | Separate saved-library membership from “shop these recipes.” Minimal version: selection toggles in the list’s recipe section, persisted independently; default clearly explained. Saving and deselecting from shopping must not delete either state. |
| N7 | Early improvement / S | **The saved-library persistence model is invisible.** Saves exist only in browser storage. | State “Saved on this device” in Saved, with export/import or backup next. Explain browser clearing/private mode only at the relevant surface. No mandatory account prompt. |
| N8 | Early improvement / S | **Important mobile filters are horizontally offscreen.** Initial viewport exposes Tonight, Pick, More filters; time/protein controls require discovering horizontal scrolling. Categories are also a separate horizontal strip. | Keep current strips but provide a visible overflow cue and put all options in More filters as well. Check whether time deserves a first-row position based on observed usage. Avoid adding a third strip. |
| N9 | Early improvement / S | **“Tonight” is an opaque preset.** It actually means mains within 45 minutes. | Make the active chip or brief hint say “Mains · ≤45 min.” A user should predict the outcome without reading product documentation. Preserve one-tap toggle behavior. |
| N10 | Early improvement / S | **High protein has no visible threshold in the filter.** Source/MCP defines at least 20g per serving, but a cook cannot see that definition from the quick pill. | Show the threshold in contextual help and recipe metadata. Distinguish missing nutrition from low protein; do not infer unknown values as reliable nutrition. |
| N11 | Early improvement / M | **Recipe titles get truncated in two-column mobile cards.** The initial waffle and alfredo cards lose meaningful text. | Prioritize the dish name over publisher SEO phrases. Verify existing title-normalization work first; allow sensible title line height or a third line if needed. Keep original titles available. Measure scan speed, not just visual tidiness. |
| N12 | Early improvement / S | **Reporting a recipe problem opens a GitHub issue workflow.** Good for maintainers, demanding for ordinary cooks. | Keep prefilled recipe context and provide a simple feedback/contact alternative requiring no GitHub account. Separate wrong ingredients, broken image, wrong category and dead source link to ease triage. |
| N13 | Early improvement / M | **No explicit Share action is visible in the recipe sheet.** Deep-link state already exists, but sharing requires browser chrome/address copying. | Add native share with copy-link fallback. Reopening on another device must open the same recipe without the sender’s local Saved dependency. Avoid sharing unnecessary search/avoid filters; give clear copy success/failure feedback. |
| N14 | Early improvement / S | **Creator language can surprise Italian users.** Italian titles and ingredients do not imply Italian instructions. | Label the method’s source language beside the outbound action when different. Preserve original title/ingredients access. Do not imply vegdex translates the method. |
| N15 | Early improvement / M | **Shopping amounts are hard to audit.** Merged rows do not expose which recipes contributed. | Expand a row to show recipe contributions and original lines. Crucial for nonconvertible units, ambiguous packages and substitutions. Do not silently replace uncertainty with a precise number. |
| N16 | Verify before promotion / M | **Offline capability is conditional on prior requests.** Runtime caching is request-based and limited; “saved” is not an explicit downloaded bundle. | Test a saved recipe, unopened saved recipe, grocery list, cross-language switch and new deployment offline. Expose availability honestly; consider explicit download of selected recipes only after versioning and storage limits are handled. |
| N17 | Verify before promotion / S–M | **Storage reads/writes are not uniformly guarded.** Several writes and unit preference reads access localStorage directly. | Test unavailable/quota-limited storage. Keep discovery and creator handoff working; show that saves could not persist. Do not call this a reproduced crash until tested. |
| N18 | Verify before promotion / M | **Daily multi-file data and persistent caches can mix versions.** Cache is stale-while-revalidate by request, without a visible dataset-version contract here. | Exercise old catalog + new details/overlay and saved IDs removed from the current catalog. Require graceful missing-recipe recovery and consistent refresh behavior. This is a code-review risk, not a reproduced outage. |
| N19 | Verify before promotion / S | **Keyboard, zoom, dark mode and small-screen behavior need broader evidence.** Existing labels and native dialogs are promising but insufficient for a full accessibility claim. | Manually complete discovery → save → shopping → creator link using keyboard; inspect focus return, visible focus, announcement timing, contrast and 200% zoom. Include 320px and dark mode, long Italian labels and reduced motion. |
| N20 | After initial feedback / M | **Default top-rated catalog is broad, repetitive and sometimes slow-to-cook.** Desktop first rows include overnight breads; repeated high-rating values reveal little about dinner suitability. | Keep honest sort semantics. Test a clearly labeled dinner-first entry or campaign-specific Tonight link rather than silently redefining Top rated. Audit publisher concentration and rating-count weighting before changing ranking. |

## Feature opportunities, ranked by connection to the core task

These are candidates, not commitments. Prefer extensions of the static/client-only model. Ship one increment at a time and evaluate actual use.

| Order | Feature | User benefit / smallest useful version | Complexity and decision rule |
| --- | --- | --- | --- |
| 1 | Shopping subset | Pick a few saved recipes for this trip; combined list includes only those. | M. Strongest workflow gap; implement before a full meal planner. |
| 2 | Share recipe and filtered search | Send tonight’s choice or a useful collection to another person. Use existing query URLs plus native share/copy. | S–M. Verify stable IDs and clean shared URLs; no backend necessary for single recipe/search. |
| 3 | Saved export/import | Keep a collection when changing browsers/phones; portable JSON with schema version and validation. | M. Favor this before account/sync infrastructure. Include duplicates, unknown IDs and future format handling. |
| 4 | Grocery copy/share/print | Bring a plain checklist to another app or household member. | S–M. Define whether checked items and source links are included. This is a snapshot, not live household synchronization. |
| 5 | Ingredient autocomplete | Reduce misspellings and expose known concepts in Must include/Avoid. | M. Use existing vocabulary; support keyboard, free-text fallback and localization. Track zero-result improvement. |
| 6 | “Use what I have” with missing ingredients | Find meals close to the pantry, not only strict matches of every included ingredient. Show exact missing ingredients. | L. Separate this mode from current strict Must include so semantics stay clear. Pantry staples must be configurable, never assumed as facts. |
| 7 | Recently viewed | Recover a recipe after browsing away without requiring deliberate saving. | S–M. Local capped history; clearable; avoid storing unnecessary sensitive filter history. |
| 8 | Servings on recipe sheet | Scale the selected recipe before deciding or shopping. Reuse grocery amount logic, show original yield. | M. Preserve quantities that cannot be safely scaled and keep creator method authoritative. |
| 9 | Saved collections | Separate weeknight favorites, baking and “want to try” without affecting shopping. | M. Add only if saved collections grow; start with one lightweight categorization model. |
| 10 | Mark cooked / personal notes | Record whether a household liked something and practical adjustments. | M. Local private notes; no public ratings needed. User interviews should establish repeat-use demand. |
| 11 | Cuisine filter | Expose existing cuisine tags, with counts and multi-language labels. | M. First audit tag coverage; untagged recipes must not silently appear to be missing cuisines. |
| 12 | Equipment filters | Discover no-oven, air fryer, one-pot or blender-free choices. | M–L. Requires trustworthy extraction and coverage; a keyword guess is not enough to promise suitability. |
| 13 | Ingredient-count / simple recipes | Offer manageable shopping and prep for tired cooks. | M. Define count exclusions and missing-data behavior; “5 ingredients” must not ignore a long optional list deceptively. |
| 14 | Fresh ideas in Pick for me | Avoid repeating the same session draws; offer concise “why this matches.” | S–M. Preserve current constraints; undo/previous draw is more useful than elaborate animation. |
| 15 | Native-language source filter | Find recipes whose original method is in the reader’s language. | S–M if metadata reliable. Keep broad cross-language discovery as default; explain small result counts. |
| 16 | Curated entry links | Share useful searches such as quick dinners or ingredient combinations. | S. Use actual query capabilities; do not invent tags or manually maintained editorial pages unless demand appears. |
| 17 | Explicit offline grocery bundle | Prepare the selected trip and details before going to the store. | L. Gate on versioning and offline tests; show readiness and storage behavior. |
| 18 | Lightweight meal plan | Assign selected recipes to a few days and generate that selection’s list. | L. Only after shopping selection works and users ask for scheduling. |

Do not make launch depend on accounts, live household sync, AI chat, generated recipes, a nutrition planner, exact budget estimates, a social feed, scraping method text, native apps or large-scale new-source expansion. They add operational/data burdens and have weaker evidence than the current dinner task. Exact prices need local store/region/package data; prep-time versus total-time controls need reliable source fields. Treat these as separate research projects if demand emerges.

## Proposed execution sequence

### Increment 1: establish a reliable launch baseline

Reconcile #54 with closed #9/#49 and current production. Fix N1 classification and diagnose N4 diet tags before relying on either in campaign messaging. Re-test title cleanup on representative publishers, English/Italian and known source typos; changing title case does not correct ingredient mappings. Verify performance using the documented real-data throttled-phone command, and test a campaign deep link as well as `/`.

Done when production passes the selected dinner relevance cases, the known diet-badge contradiction has an explained and tested resolution, and no unresolved failure prevents choosing/opening a recipe.

### Increment 2: make promotion understandable and observable

Verify the completed #55 deployment, then complete #56 and #57. Add compact purpose/handoff copy (N2), fix the long CTA layout (N3), clarify device-only saves (N7), and add the simplest feasible share action (N13). Keep creator opt-out/contact easy to find without scrolling through many recipe pages. Decide language-specific campaign destinations and verify each one on production.

Done when a person arriving from a shared link can explain what the app does, reach the promised result, open the creator site, and share a working link; the operator can see aggregate acquisition and meaningful product actions.

### Increment 3: protect the return visit

Implement shopping selection (N6), then portable saved export/import and grocery export. Add ingredient autocomplete only after inspecting failed queries. Fix specific vocabulary/quantity errors revealed by top-used recipes. Test cache refresh, offline saved details and missing-recipe recovery.

Done when someone with many favorites can shop for a few meals without unsaving the rest, and their persistence/offline expectations match actual behavior.

### Increment 4: small launch and observation

Recruit a handful of relevant cooks for task sessions, then publish a small number of community-appropriate posts. Observe comprehension and task completion before scaling spend. Pick one clear scenario per post: dinner within 45 minutes, using tofu and spinach, or combining two recipes into a shopping list. Show the exact real flow in a short recording; no unsupported testimonials or safety/performance superlatives.

Only then choose the next feature from measured friction. Broad feature additions are not required to ask people for feedback.

## Measurement design for #56

Define the primary outcome as **a creator recipe handoff after useful discovery**, with saves as a secondary intent signal. An outbound click is not proof that someone cooked the recipe. A short session ending at a creator can be successful; raw dwell time and bounce are poor standalone product judgments here.

Suggested aggregate events: search submitted (not every keystroke), meaningful filter applied, result set empty, recipe opened, creator clicked, recipe saved, shopping opened, shopping recipe selection changed, share attempted/completed where detectable, and recoverable load error. Use explicit definitions and deduplicate hydration/re-renders. Record campaign, locale, entry type and coarse device category when justified.

Do not send raw free-text searches, avoidance lists, ingredient queries, private notes or complete URLs containing those values as analytics properties. Review SDK default URL collection too. Choose analytics implementation and consent/privacy behavior in #56; this plan does not assume a provider or assert legal requirements.

Questions measurement should answer:

- Which post brings visitors who actually open creator recipes?
- Where do visitors stop: arrival, filtering, recipe sheet or handoff?
- Do Tonight users reach a useful choice more easily than general browsers?
- Are zero results caused by typos, hidden active filters, overstrict pantry input or missing content?
- Do people who save return and use shopping? Can this be answered without cross-device identity?
- Is Italian traffic finding recipes whose method language matches expectations?

Do not invent conversion targets from no baseline. Record baseline observations, compare comparable cohorts and report denominators and uncertainty. Use qualitative sessions for low-volume problems rather than drawing strong conclusions from a few events.

## Release checks tied to the campaign

- Shared preview looks intentional on X and Reddit, with readable text and creator-safe assets. Verify the actual platform unfurl, not just HTML metadata. Static query URLs currently share generic page metadata; decide whether that is acceptable for launch before promising recipe-specific preview cards.
- Campaign link opens the advertised result/filter state in a fresh browser and preserves English/Italian paths.
- Mobile visitor can identify a plausible dinner and reach the source without sign-in or a tutorial.
- Long publisher names, three footer actions, text zoom and narrow screens do not obscure the core task.
- Saving survives reload; device-only scope is communicated; failed persistence is handled.
- Shopping is tested with multiple recipes, ambiguous units, source-language differences and changed serving amounts.
- Non-human food is excluded from dinner; source times and ratings remain faithful; missing nutrition and derived labels are explained.
- Production no-error smoke, documented performance check, full fixture E2E baseline and representative real-data flows pass. Fixture success alone does not certify catalog quality.
- Maintainer has visible feedback/contact, creator removal procedure and a way to recover a faulty dataset/deployment.
- Community posting rules are checked at posting time. Paid promotion and organic feedback posts should be treated as separate decisions; do not assume a subreddit permits either.

## Short user-research script

Ask people to think aloud; do not explain the interface first.

1. “Find a vegan dinner you could cook tonight in under 45 minutes.” Observe first action, understanding of Tonight, choice confidence and creator handoff.
2. “You have tofu and spinach, and you dislike mushrooms.” Observe search versus Must include/Avoid, comma input, visibility of filters and recovery from no results.
3. “Save three recipes, but shop for only two.” This exposes the library/shopping mismatch without leading the person.
4. “Send one recipe to someone else, then return to it tomorrow.” Observe sharing and persistence assumptions.
5. For an Italian reader: “Find something you can follow in Italian.” Observe whether translated titles imply translated instructions.

Capture concrete blockers and misunderstandings, not general ratings of whether the app is “nice.” Include a keyboard user and a small-phone user when feasible. A handful of sessions is exploratory evidence, not proof of population-wide preferences.

## Decisions to make after the first feedback cohort

If users find recipes but do not click through, examine method expectations, CTA layout and source language before adding more content. If people click through successfully but rarely save, the product may be working as a discovery utility; do not force retention mechanics. If saves grow and shopping is painful, prioritize selection and export. If failed ingredient searches dominate, prioritize vocabulary/autocomplete and missing-ingredient matching. If quality complaints concentrate on a few publishers, address those sources and extraction rules before adding new ones.
