---
name: vegdex
description: Vegan recipes from the best vegan blogs, filtered in a tap.
colors:
  paper: "#eef0e9"
  surface: "#ffffff"
  rose-stock: "#f7e1e6"
  rose-line: "#e8c1cb"
  ink: "#18271d"
  muted: "#56635a"
  line: "#e3e2da"
  ink-green: "#1d4a31"
  green-wash: "#e4ede2"
  tomato-rule: "#b23f2a"
  tomato-wash: "#f6e3de"
  star-gold: "#a8741c"
  heart-disc: "rgb(255 255 255 / 0.9)"
  shadow: "rgb(0 0 0 / 0.16)"
  card-shadow: "rgb(24 39 29 / 0.07)"
  scrim: "rgb(10 15 12 / 0.55)"
  dark-paper: "#121814"
  dark-surface: "#1a221d"
  dark-rose-stock: "#35242c"
  dark-rose-line: "#573b47"
  dark-ink: "#edf0ea"
  dark-muted: "#a1aca4"
  dark-line: "#2c3830"
  dark-ink-green: "#9fd29a"
  dark-green-wash: "#233528"
  dark-tomato-rule: "#f08a6c"
  dark-star-gold: "#e0b252"
  dark-heart-disc: "rgb(18 24 20 / 0.82)"
typography:
  wordmark:
    fontFamily: "Besley Variable, Besley, Clarendon, Georgia, serif"
    fontSize: "1.6rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Besley Variable, Besley, Clarendon, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  subhead:
    fontFamily: "Besley Variable, Besley, Clarendon, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 700
  title:
    fontFamily: "Besley Variable, Besley, Clarendon, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.55
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.88rem"
    fontFeature: "tnum"
  meta:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8rem"
    fontFeature: "tnum"
  typed:
    fontFamily: "Courier Prime, Courier New, ui-monospace, monospace"
    fontSize: "0.94rem"
    fontWeight: 400
  tag:
    fontFamily: "Courier Prime, Courier New, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 700
  field-label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.06em"
  aisle:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  label: "3px"
  tag: "6px"
  photo: "8px"
  field: "10px"
  button: "12px"
  card: "14px"
  sheet: "20px"
  pill: "999px"
spacing:
  gutter: "12px"
  header: "16px"
  sheet: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    height: "48px"
  pill:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  pick:
    backgroundColor: "{colors.ink-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "40px"
  pill-on:
    backgroundColor: "{colors.ink-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  saved-on:
    backgroundColor: "{colors.tomato-rule}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  tab:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.ink}"
    rounded: "10px 10px 0 0"
    height: "40px"
  tab-on:
    backgroundColor: "{colors.ink-green}"
    textColor: "{colors.paper}"
  time-tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "3px 7px 2px"
  search:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
---

# Design System: vegdex

## Overview

**Creative North Star: the recipe index card.** vegdex is a recipe box for a home kitchen: cards on a sage-grey ground, white card stock for savory and rose for sweet, green ink, one red line per card. The photos supply the appetite. The interface supplies the facts a cook needs to choose (time, rating, source, ingredients) and gets out of the way. It is an Operate surface used on a phone in short sessions, so precision and familiar controls come before expression.

The card file is visible, not only described: categories are divider tabs standing on the edge of the stack, every recipe is a card with the publisher's photo mounted on card stock and its facts ruled underneath, and an open recipe is a recipe card (title above the red line, printed fields below it, ingredients on ruled lines, "From the kitchen of" the blog). The mount frame also evens out photos from 24 blogs with 24 different styles. The box also behaves like one: "Pick for me" pulls a card at random from the best matches, and every card's "From the kitchen of" opens that blog's shelf. The facts are typed onto the cards: times, servings, nutrition, amounts and the blog's name in a typewriter face, the way a recipe card was filled in. The time on each photo is a typed label stuck on by hand, never quite straight. The other details: the Clarendon titles and tabular numerals.

Anti-references: beige "organic" palettes, wellness-brand softness, recipe-blog clutter, and any "verified vegan" badge (the guarantee stays implicit; see PRODUCT.md).

## Colors

The palette is restrained. Neutrals carry the page, ink green carries action and selection, and tomato is spent only on the header rule, saved state, the heart and text actions.

### Primary
- **Ink Green** (#1d4a31; dark #9fd29a): primary buttons ("Cook it on…", "Show N recipes", Add), selected pills and segments, focus ring, the wordmark.
- **Green Wash** (#e4ede2; dark #233528): resting quick pills, active-filter chips, diet badges, image placeholders.

### Secondary
- **Tomato Rule** (#b23f2a; dark #f08a6c): the 2px rule under the sticky header, the red line of an open card (recipe sheet, shopping list), the Saved toggle when on, filled hearts, text buttons (Clear, Try again), aisle headings in the shopping list.
- **Tomato Wash** (#f6e3de; dark #3a2621): "avoid" chips only.

### Tertiary
- **Star Gold** (#a8741c; dark #e0b252): rating stars, everywhere they appear.

### Card stock
- **Rose Stock** (#f7e1e6; dark #35242c) with **Rose Line** (#e8c1cb; dark #573b47): sweet recipes are filed on rose card stock, in the grid and in their open sheet; the Sweet tab rests on it, so the tab row is the legend. Set by the `.sweet` class, which swaps `--surface` and `--line`. Color is never the only signal: the Sweet filter and the recipe itself say it too.

### Neutral
- **Paper** (#eef0e9; dark #121814): the page ground the cards rest on, a cool sage-grey so white card stock reads as cards. Not beige.
- **Surface** (#ffffff; dark #1a221d): savory card stock, sheets, search field, time tags, raised controls.
- **Ink** (#18271d; dark #edf0ea): body text and titles.
- **Muted** (#56635a; dark #a1aca4): metadata, counts, hints, placeholders. 4.5:1 or better on paper and surface.
- **Line** (#e3e2da; dark #2c3830): hairlines, outline pills, list rules.

### Named Rules
**The One Rule Rule.** Tomato appears as a line once per card: under the header (the app's own card) and under the head of an open recipe or shopping list, the way an index card has one red line. Never on grid cards, never as a border around anything, never as a decorative stripe.

**The Ink Means Act Rule.** Solid ink green marks the thing you can act on or the choice you made. Don't use it for decoration. On the browse screen, "Pick for me" is the one solid action at rest.

**The Two Stocks Rule.** Card stock color means flavor: white is savory, rose is sweet. No other card colors, and no stock color on controls except the Savory and Sweet tabs.

## Typography

Three families with separate jobs. Besley, a Clarendon revival self-hosted through `@fontsource-variable/besley`, gives the wordmark, recipe titles and sheet headings the voice of a pantry label or an old recipe card. Courier Prime (`@fontsource/courier-prime`, 400 and 700) types the facts onto the card. The system sans handles everything you operate: pills, buttons, labels, hints, ingredient names.

### Hierarchy
- **Wordmark** (Besley 700, 1.6rem, -0.02em): "vegdex", always lowercase.
- **Headline** (Besley 600, 1.5rem, 1.2): sheet titles and the "Saved recipes" view title. Balanced wrapping.
- **Subhead** (Besley 700, 1.25rem): "Ingredients" inside the recipe sheet.
- **Title** (Besley 600, 1rem, 1.25): card titles, clamped to three lines, balanced, with the first letter uppercased to absorb publisher casing.
- **Body** (system sans 400, 1rem, 1.55): ingredient lines (`text-wrap: pretty`, 65ch max) and copy.
- **Label** (system sans, 0.88rem, tabular numerals): pills, buttons, chips, counts, amounts, form labels.
- **Meta** (system sans, 0.8rem, tabular numerals): card source and rating, hints, footnotes, credits.
- **Typed** (Courier Prime 400, 0.94rem): the values of an open card's printed fields, ingredient amounts (700, a touch tighter), shopping-list amounts, the blog name after "From the kitchen of" (700), and the results count (0.82rem, muted).
- **Tag** (Courier Prime 700, 0.8rem): the time label on a photo.
- **Field label** (system sans 600, 0.75rem, 0.06em, uppercase, muted): the printed labels on an open recipe card (Time, Serves, Per serving).
- **Aisle** (system sans 700, 0.8rem, 0.06em, uppercase, tomato): shopping-list aisle headings. Field labels and aisles are the only uppercase text.

### Named Rules
**The Numbers Line Up Rule.** Times, ratings, counts and amounts use tabular numerals.

**The Serif Is For Names Rule.** Besley names things (the app, a recipe, a sheet). It never sets a button, pill or label.

**The Typewriter Fills In Facts Rule.** Courier Prime sets only values a cook would have typed onto a card: times, amounts, servings, nutrition, a count, the kitchen's name. Never a control, a field label, a sentence of copy or a heading. It runs wide, so keep it at 0.94rem or below and in 400 except for amounts and labels.

## Layout

Mobile first, with a 1200px max container. The sticky header holds only the brand row and search (about 120px on a phone) and closes with the tomato rule. Quick filters scroll with the page. Once they are out of view, a "Back to top" button joins "Pick for me" in the bottom dock (in the Saved view, where there are no filters, it appears after 600px of scrolling). It always says "Back to top", never "Filters", so nobody taps it expecting to keep their scroll position. It returns keyboard focus to the brand without opening the phone keyboard. There is only ever one way back. Horizontal pill rows fade at the right edge to show there is more.

- **Filters:** a controls row first (Tonight, More filters, time). Each filter has one home: time lives only in the row, High protein only in More filters, then the divider tabs (Savory, Sweet, then meals) standing on a hairline that heads the results. The tabs sit next to the cards they sort.
- **Grid:** `repeat(auto-fill, minmax(160px, 1fr))` with 10px gaps (two columns on a phone). At 700px and up, `minmax(220px, 1fr)` with 16px gaps.
- **Sheets:** bottom sheets on phones (max 640px, 92dvh). Centred dialogs from 700px. The recipe sheet becomes two columns at 900px (920px wide): photo and facts stick on the left, ingredients scroll on the right.
- **Sticky footers:** any sheet with a primary action pins it to the bottom (Save + "Cook it on…", Clear all + "Show N recipes").
- `scroll-padding-top` follows the measured header height, so focus never lands under it.

## Elevation & Depth

Flat by default, with tonal layering (paper → surface). Shadows appear only where something sits physically on top of something else.

### Shadow Vocabulary
- **Card** (`0 1px 2px var(--card-shadow), 0 2px 8px var(--card-shadow)`): recipe cards resting on the paper; on hover the card lifts 3px out of the box and the shadow deepens. No border with it.
- **Placed card** (motion): a recipe expands from the tapped card into its sheet in 460ms, settling from a 1.5° tilt. A random pick rises from below; drawing another slides the new content into place in 320ms while the controls stay still. Other sheets enter with a 40px slide and 0.7° tilt in 320ms. Closing takes 180ms with a smaller 32px slide and 0.7° tilt. The backdrop fades with it. Reduced motion removes the recipe entrance and closes immediately; redraws keep a brief fade.
- **Tag** (`box-shadow: 0 1px 3px var(--shadow)`): time tags stuck on a photo.
- **Floating control** (`box-shadow: 0 1px 4px var(--shadow)`): the sheet close button.
- **Floating action** (`0 2px 6px var(--shadow), 0 8px 24px var(--card-shadow)`): the "Pick for me" button docked at the bottom of the browse screen.
- **Backdrop** (`var(--scrim)`): behind modal sheets.

## Interaction feedback

- Controls respond to a press with a small compression (97%); selection colors transition in 160ms. An explicit save compresses the heart, expands it to 140%, and settles it in 440ms; a small ring fades around the grid heart. Restored favorites stay still. Unsaving cancels any pending celebration.
- Checked shopping rows fade their text and move to the end of their aisle in 180ms. Reduced motion keeps the check and text feedback, with immediate reordering.
- Touch gestures scroll horizontally and vertically; double-tap and pinch page zoom are disabled on the page and modal sheets.
- Search results appear immediately. No grid entrance choreography or scroll reveals.
- Reduced motion preserves color and opacity feedback while removing spatial movement, including hover zoom and lift. Hover effects apply only on devices that support hover.

## Shapes

Soft rectangles for content, full pills for small controls, near-square tags for labels stuck on photos. Radii come only from the scale: 3px (the typed time label), 6px (logo, skeleton bars), 8px (photos mounted in a card: 14px minus the 6px mount), 10px (fields, sort select, the top corners of divider tabs), 12px (buttons), 14px (cards), 20px (sheets), full pill. Card photos are 1:1. Sheets round only their top corners on phones (20px). Buttons use 12px, fields 10px.

## Components

### Buttons
- **Primary:** ink green fill, paper text, 12px radius, 48px tall in sheet footers. The label is balanced and the external-link icon stays attached to the last word.
- **Secondary:** transparent with a 1px line border (Save; turns tomato when saved).
- **Text:** tomato, 600 weight, 40px minimum hit area (Clear, Try again, Uncheck all; muted and disabled when there is nothing to clear).
- **Zero state:** "Show N recipes" at zero turns into an outline button reading "No matches. Loosen a filter".

### Pills and segments
- **Quick pill:** green wash at rest, ink green when on, 40px tall.
- **Pick for me:** solid ink green with a shuffle icon, 52px, floating at the bottom centre of the browse screen within thumb reach (floating-control shadow; the page keeps room under the credits so it never covers them). Opens a random recipe from the top 120 of the current matches; the sheet it opens adds "Another" to its footer to draw again in place. Hidden at zero matches and in the Saved view.
- **Tonight:** the first quick pill, outlined in ink green with a clock icon at rest. It sets Mains and 45 minutes or less, and shows as one chip that spells it out ("Tonight: mains, ≤ 45 min"), since its tooltip never shows on a phone.
- **Outline pill:** transparent with a line border (More filters; High protein and free-from inside the sheet).
- **Time segments:** one joined control (≤ 15, 30, 45, 60 min); picking one replaces the last.

### Divider tabs
- Savory, Sweet, then the meals, as recipe-box divider tabs: 40px tall, top corners rounded, green wash with a hairline edge at rest, ink green when on. They stand on a full-width hairline. They are toggles (several can be on), so they keep `aria-pressed` and are not an ARIA tablist.

### Chips
- Removable active-filter chips: green wash (tomato wash for "no X"), 32px, with a close icon.

### Recipe card
- **Character:** a filed card: the photo mounted on card stock, the facts ruled underneath, nothing more.
- Surface card, 6px mount, card shadow. 1:1 photo at 8px, typed time label bottom-left (tilted -2°, +1.5° on even cards), heart top-right on a paper disc (dark disc in dark mode). Then the Besley title, then a hairline rule, the source, and under it the gold star with how many cooks rated it ("★ 1.2K ratings"). Most recipes average 5.0, so the card leads with the count; the average shows only below 4.5 ("★ 4.3 · 12 ratings"), and the sheet always shows both. The rule sits at the same height on every card in a row. The open button's accessible name is the title, and its description is time, source and rating.

### Recipe sheet (the open card)
- Photo, Besley title, then "From the kitchen of <blog>" with the rating. The blog name is an underlined button that opens the blog's shelf: the grid filtered to that source, headed by the blog's name in Besley and a "Visit <site>" link, with a removable "From <blog>" chip. Under that, the red line and the printed fields (Time, Serves, Per serving) in cells split by hairlines: field labels above, values in tabular numerals.
- Ingredients sit on ruled hairlines, no bullets, with the leading amount in bold (`splitAmount` in `labels.ts`).

### Night mode
- A 40px round key in the header, left of Saved, labelled "Night mode" (`aria-pressed`). The icon shows where a tap goes: moon by day, sun by night.
- Follows the system until tapped, then remembers the pick on the device (`lib/theme.svelte.ts`, `vegdex:theme`). An inline script in `index.html` sets `data-theme` before first paint. Dark tokens live once, under `:root[data-theme='dark']`. The switch cross-fades with a view transition unless reduced motion is on.
- Under 420px, Saved shows "♥ 3" (still named "Saved · 3") so the header row holds the language link, Night mode and Saved on one line down to 360px.

### Language and scroll controls

- The other UI language is linked directly in the header and remains available in the footer. Switching keeps URL filters and saved recipes on the device.
- The return control sits in the dock beside "Pick for me": same 52px pill and floating-action shadow, in card stock (surface, hairline, ink) so Pick stays the one solid action.
- The sort chevron uses an SVG mask in the current ink color so it remains readable in both themes.

### Inputs
- **Search:** pill on surface with a muted search icon, green border and ring on focus, a themed clear icon, and a tomato caret.
- **Sheet fields:** 44px, paper fill, 10px radius, with an Add button beside them. Comma-separated entries split into separate chips, and text left in a field applies when the sheet closes.

### Shopping list
- The header (title, count, Scale all recipes) closes with the red line.
- Aisles in store-walk order, each with an uppercase tomato heading. Rows are 52px full-width labels ruled by hairlines, in sentence case. Checked items sink to the bottom of their aisle and get a strike-through.

## Do's and Don'ts

- **Do** spend tomato on the header rule, an open card's red line, saved state and hearts only.
- **Do** use tabular numerals for every time, rating, count and amount.
- **Do** keep the main action of a sheet pinned in a footer.
- **Don't** set buttons, pills or labels in Besley.
- **Don't** add a "verified vegan" mark, badge or headline claim.
- **Don't** return to a beige or cream page background; paper stays cool sage-grey (#eef0e9).
- **Don't** use colored side borders, gradient text or decorative glass.
