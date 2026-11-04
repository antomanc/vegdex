---
title: Safari hangs on the ingredient filter because the datalist got the whole suggestion list
author: Antonio
date: 2026-11-04
branch: main
cost: { minutes: 25, tokens: 40000 }
id: l-53d776e6
scope: repo
status: active
src: agent
touches:
  - apps/web/src/lib/FilterBar.svelte
---

Safari froze on "Must include" in apps/web/src/lib/FilterBar.svelte: the datalist got every precomputed ingredient name (1,439 in Italian, 1,699 in English) as an <option>, inserted exactly when focus opened the keyboard.
data/suggest/<lang>.json is not the problem: it is built at ingest (emit.ts), 27 KB, fetched once by loadSuggestions and memoized. Safari rebuilds its native suggestion popup from every option on each keystroke, so the cost is the list size, not a query. Measured in Chromium: +1,699 nodes and a 56 ms long task on desktop-class CPU.
Fix: the datalist now gets at most 50 names — most used when the field is empty, else prefix matches first then substring matches — and typing still reaches names past the cap. e2e mocks a 400-name list to pin the cap.
Watch out: the browser still filters options by prefix, so substring matches are ordered after prefix ones rather than relied on alone.
