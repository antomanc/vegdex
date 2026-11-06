---
title: Keep metric ranges separate from the original cup measure
author: Antonio
date: 2026-11-06
branch: fix/amounts
id: l-f946e757
scope: repo
status: active
src: agent
touches:
  - packages/core/src/ingredients/amount.ts
  - packages/core/test/ingredients.test.ts
  - packages/core/src/ingredients/types.ts
  - packages/core/src/metric.ts
  - packages/core/src/grocery.ts
  - packages/core/test/weights.test.ts
---

## Decided
Keep the lower and upper metric equivalents together without replacing the original quantity or unit. Density validation depends on those original cup amounts; serving scaling must scale both metric endpoints.

## Tried and ruled out
Promoting a metric range into the primary quantity and unit rendered correctly but broke the catalog-based density test (kale's median ratio became 0.62). The test was identifying a real loss of the original volume measure.

## Watch out
The catalog parse diff summarizes primary quantity, unit and concept, omitting metric equivalents and rendered output. Audit scoring checks range maxima only on the primary quantity. Neither report alone verifies metric-range output; inspect rendered examples and focused range/scaling tests too.

In the code: packages/core/src/ingredients/types.ts, packages/core/src/ingredients/amount.ts, packages/core/src/metric.ts, packages/core/src/grocery.ts; pnpm parse:diff, pnpm audit:score, packages/core/test/weights.test.ts.
