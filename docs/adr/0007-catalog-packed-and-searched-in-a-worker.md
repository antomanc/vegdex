# The catalog ships packed and is searched in a worker

On a mid-range phone the app took 6 s to show the first recipe, and each keystroke of a search took about 3 s. catalog.json was 4.1 MB gzipped (22 MB parsed). The page thread parsed it, held it as deeply reactive state, and on every keystroke re-tokenized all 16,000 titles and ingredient names.

The page now does as little as possible before it shows recipes, and nothing heavy afterwards:

- **Packed catalog.** catalog.json stores each concept, ingredient name and tag once in a table and refers to them by position. Each recipe lists only the concepts its other concepts do not imply, and a parent table restores the families (`packCatalog` and `unpackCatalog` in core). It is 2.2 MB gzipped and 9 MB raw. `unpackCatalog` gives back exactly the rows in recipes.full.json, and it passes an older, unpacked catalog through unchanged.
- **First page.** first.json holds the 96 best-rated recipes (23 KB gzipped). A plain landing (no search, filter, saved view or chosen order) shows them while catalog.json downloads. A link with filters waits for the catalog instead, because the first page could contradict its filters. index.html preloads first.json and the page language's overlay first, and the catalog and lookup at low priority.
- **Worker.** The page fetches catalog.json as bytes and transfers them to a worker (`lib/catalog.worker.ts`). The worker parses, indexes and searches the catalog, and answers each question with only what the page shows: a page of rows with counts, the draw pool, rows by id, and the counts behind the zero-results suggestion.
- **Indexed search.** Core keeps per-recipe indexes and word indexes (word → recipe positions, prefixes found by binary search). They only narrow a search: every candidate still goes through the same checks, so results match the old search. Indexes are cached per recipes array and per title function, so new data needs a new array, and new titles a new function.

`pnpm perf` measures the result on a Pixel 7 with a 4× slower CPU on fast 4G. The first card shows in 0.93 s, the catalog is searchable at 3.1 s, keystrokes and filter taps take at most 64 ms, and the page heap is 10 MB.

## Considered Options

- **Search on the page thread with indexes only.** Keystrokes became fast, but parsing and indexing still froze the page for about a second while the visitor scrolled the first page.
- **Ship tokens precomputed.** It costs 176 KB gzipped to save about 50 ms of work, which runs in the worker anyway.
- **Load the recipe and shopping sheets on demand.** It saves 4 KB gzipped from the main bundle, because the filters and the first page still need the parser, and it makes opening a sheet asynchronous.

## Consequences

Anything that reads catalog.json must unpack it first. The page has no recipe list of its own, so features that need recipes the page is not showing ask the worker for them. The MCP server still reads the unpacked recipes.full.json.
