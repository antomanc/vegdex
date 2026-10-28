# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Home cooks deciding what to make for dinner: vegans and vegan-curious people, usually on a phone, often in the kitchen or at the store. The job is to get from "what do I cook tonight?" to a recipe they trust, usually narrowing by meal, time, and what they already have.

## Product Purpose
vegdex gathers vegan recipes from the best vegan food blogs into one fast, filterable app. It shows the facts a cook needs to choose (title, photo, time, servings, rating, nutrition, ingredients) and links to the creator for the method. Success is a cook finding a recipe they want to make quickly, then going to the blog to cook it.

## Positioning
Guaranteed vegan. Every source is an all-vegan publisher, and a second check drops any recipe whose ingredients name an animal product without a plant-based qualifier. Users never have to second-guess an ingredient. Future work must protect and never dilute this claim.

## Operating Context
- Mobile-first: the phone is the main device; desktop is secondary.
- Used in short sessions while deciding dinner, sometimes with wet or busy hands, sometimes in a store.
- Installable PWA that works offline once loaded. No accounts, no server, no database.
- Saved recipes and the shopping list live in the browser on that device.
- The same dataset also powers an MCP server and CLI (`packages/mcp`) for AI agents; that is a separate surface.

## Capabilities and Constraints
- Search by text; quick filters for savory/sweet and meal type; time (≤15/30/45/60 min); high protein; "free from" (gluten, nut, soy, oil); "I have" and "avoid" ingredient lists; sort (top rated, newest, fastest, best match).
- "Pick for me": a random recipe from the best current matches, with "Another" to draw again.
- Recipe sheet: photo, meta, nutrition, diet badges, ingredient list, "Cook it on <blog>" link, save. The blog name opens that blog's shelf (all its recipes, plus a link to the site).
- Saved view with a combined shopping list built from saved recipes.
- Filter state lives in the URL; data is a static catalog refreshed daily by GitHub Actions and deployed to GitHub Pages.
- vegdex never stores or shows the method or the blogger's writing. Images load directly from the publisher.
- Stack: Svelte 5 + Vite PWA, plain CSS (`apps/web/src/app.css`).

## Brand Commitments
- Name: "vegdex", lowercase.
- Credit to creators is part of the product: every recipe names its blog and links back to it ("Visiting supports the creator").
- The vegan guarantee stays implicit in the UI: no headline claim or per-recipe "verified" marks. The name and sources carry it.

## Evidence on Hand
- Real catalog data in `apps/web/public/data` (recipes from ~25 vegan blogs); a fixed fixture dataset in `e2e/fixtures/`.
- The interface is English at `/` and Italian at `/it/` (UI languages under path prefixes, see `docs/adr/0002`). Recipes are still English only: translated editions of a blog (a `/de/`-style path) are never crawled or published, because the tagger and the vegan check read English ingredient names. Recipes translated through language-neutral concepts are designed but not built (`docs/adr/0003`–`0004`).
- No testimonials, user counts, or press exist. Do not invent them.

## Product Principles
1. Vegan certainty first: nothing in the UI may imply a non-vegan option or cast doubt on the vegan check.
2. Get to "tonight's recipe" in as few taps as possible on a phone.
3. Send the cook to the creator: the blog link is the success path, not a leak.
4. Facts, not prose: show what helps a choice, leave the writing to the blogger.
5. Every recipe in every language, the original one tap away: when no safe translation exists, show the source's own words, never a guess.
