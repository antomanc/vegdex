---
title: Metric mode pours liquids in ml and weighs everything else in grams
author: Antonio
date: 2026-11-03
branch: fix/translation-quality
cost: { minutes: 33, tokens: 366104 }
id: l-6bb9b7f1
scope: repo
status: active
replaces: l-903e6c0b
src: agent
touches:
  - packages/ingest/data/vocab/concepts.json
  - packages/ingest/data/vocab/en.json
  - packages/ingest/data/vocab/it.json
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/overlay/en.json
  - e2e/fixtures/data/recipes.full.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/en.json
---

## Decided
- Reversed on 2026-11-03 at the user's request: "metric means grams only" read wrong to Italian cooks ("≈ 300 g latte d'avena" when the blog said 300 mL). Poured liquids (water, broth, plant milks, juices, oils, vinegar, wine, soy sauce) show in ml; isPoured() in packages/core/src/weights.ts decides, with thick or solid forms (coconut oil, condensed milk, chocolate, powders) kept weighed. Everything else still weighs through the density table.
- A blog's own ml are shown exactly when they pass the 50% check against its cups; otherwise cups convert at 240 ml.
- Grams beside ounces or pounds ("8 ounces (227g)") are the blog's conversion and round like ours (225 g); other blog grams stay exact. Package sizes stay exact.
- The shopping list still merges a liquid's ml with grams of the same ingredient through the density table (weighed() in grocery.ts weighs ml amounts too).

## Watch out
- Herbs and greens are bimodal (loose ~15 g/cup, chopped ~60); parsley/kale/basil/mint/dill use the blog median.
- Family patterns misfire on substrings ("coconut" ends in "nut", "butternut", "sugar snap peas"); anchor with \b. "milk chocolate" must not count as poured.
- Blog ml can be typos ("¼ cup (5 ml)"); metric.ts ignores blog ml more than 50% off its cups.
