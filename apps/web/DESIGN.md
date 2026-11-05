---
name: vegdex
description: Vegan recipes from the best vegan blogs, filtered in a tap.
colors:
  paper: "#ffffff"
  surface: "#ffffff"
  ink: "#151515"
  muted: "#5c5c55"
  line: "#dedcd4"
  rule: "#151515"
  crate-green: "#2f6b3f"
  on-green: "#ffffff"
  green-wash: "#e6efe5"
  sign-red: "#c92e1c"
  tag-red: "#d6311e"
  on-tag: "#ffffff"
  label-yellow: "#f3c623"
  on-label: "#151515"
  heart-disc: "rgb(255 255 255 / 0.92)"
  shadow: "rgb(0 0 0 / 0.2)"
  card-shadow: "rgb(0 0 0 / 0.08)"
  scrim: "rgb(10 10 10 / 0.6)"
  dark-paper: "#121211"
  dark-surface: "#1c1c1a"
  dark-ink: "#f4f2ea"
  dark-muted: "#aaa89f"
  dark-line: "#34332f"
  dark-rule: "#e9e7df"
  dark-crate-green: "#79c58a"
  dark-on-green: "#0e1a11"
  dark-green-wash: "#1f3324"
  dark-sign-red: "#f2593f"
  dark-tag-red: "#f2593f"
  dark-label-yellow: "#e8bd2a"
  dark-on-tag: "#151515"
  dark-heart-disc: "rgb(18 18 17 / 0.85)"
typography:
  wordmark:
    fontFamily: "Bowlby One, Arial Black, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
    lineHeight: 1
  sign:
    fontFamily: "Bowlby One, Arial Black, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
  tag:
    fontFamily: "Bowlby One, Arial Black, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    fontFeature: "tnum"
  screen-title:
    fontFamily: "Bowlby One, Arial Black, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 400
    lineHeight: 1.15
  section-title:
    fontFamily: "Bowlby One, Arial Black, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 400
  recipe-title:
    fontFamily: "Work Sans Variable, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  card-title:
    fontFamily: "Work Sans Variable, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 680
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Work Sans Variable, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.45
  label:
    fontFamily: "Work Sans Variable, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 600
    fontFeature: "tnum"
  meta:
    fontFamily: "Work Sans Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.4
    fontFeature: "tnum"
  field-label:
    fontFamily: "Work Sans Variable, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sign: "2px"
  photo: "4px"
  field: "6px"
  button: "8px"
  sheet: "8px"
  pill: "999px"
spacing:
  edge: "16px"
  edge-narrow: "12px"
  sheet: "20px"
components:
  button-primary:
    backgroundColor: "{colors.crate-green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.button}"
    height: "48px"
  pick:
    backgroundColor: "{colors.crate-green}"
    textColor: "{colors.on-green}"
    typography: "{typography.sign}"
    rounded: "{rounded.button}"
    height: "52px"
  sign:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.sign}"
    rounded: "{rounded.sign}"
    height: "44px"
  sign-on:
    backgroundColor: "{colors.crate-green}"
    textColor: "{colors.on-green}"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "44px"
  pill-on:
    backgroundColor: "{colors.crate-green}"
    textColor: "{colors.on-green}"
  time-tag:
    backgroundColor: "{colors.tag-red}"
    textColor: "{colors.on-tag}"
    typography: "{typography.tag}"
    rounded: "{rounded.sign}"
    padding: "5px 9px 3px"
  rating-label:
    backgroundColor: "{colors.label-yellow}"
    textColor: "{colors.on-label}"
    rounded: "{rounded.sign}"
    padding: "1px 6px"
  search:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.button}"
---

# Design System: vegdex

## Overview

**Creative North Star: the market stall.** vegdex lays recipes out like produce on a stall. The publisher's photo is the crate, the cooking time is written on a red price tag hung off its edge, ratings ride on a yellow shelf label, and courses are lettered on signs above the stall. It is an Operate surface used on a phone in short sessions: the world lends type, palette, density and one signature move, and every control stays one the cook already knows.

The signature move is the red tag. It is the same object on a card, in the open recipe's facts and in the time filter, where the chosen time turns into a tag.

Anti-references: the soft recipe-app card (rounded white tiles, muted meta), beige "organic" palettes, wellness-brand softness, recipe-blog clutter, folk hand-lettering, and any "verified vegan" badge (the guarantee stays implicit; see PRODUCT.md).

## Colors

White ground, black ink and outlines. Three signal colors, each with one job.

### Signals
- **Crate Green** (#2f6b3f; night #79c58a): the thing you can act on or the choice you made. Primary buttons, Pick for me, selected signs and pills, focus rings, the wordmark, links.
- **Tag Red** (#d6311e; night #f2593f): filled tags only. Time tags, the chosen time, the Saved key when on. White text by day, dark text at night.
- **Sign Red** (#c92e1c; night #f2593f): red as ink. Hearts, the saved state, "avoid" chips, the search caret. Text buttons and aisle headings stay in ink. By day it is darker than Tag Red so text clears contrast. At night the two are the same color.
- **Label Yellow** (#f3c623; night #e8bd2a): the rating label and text selection, nothing else. It keeps its ink text in both themes.

### Neutral
- **Paper / Surface** (#ffffff; night #121211 / #1c1c1a): page and sheets.
- **Ink** (#151515; night #f4f2ea): text.
- **Rule** (#151515; night #e9e7df): control outlines and heavy rules.
- **Muted** (#5c5c55; night #aaa89f): metadata, counts, hints, placeholders. 4.5:1 or better on paper and surface.
- **Line** (#dedcd4; night #34332f): hairlines between rows.
- **Green Wash** (#e6efe5; night #1f3324): image and skeleton placeholders and hover washes only. Never a control's resting ground.

### Named Rules
**The Green Means Act Rule.** Solid green marks what you can act on or what you chose. On the browse screen, Pick for me is the one solid action at rest.

**The Red Tag Rule.** Filled red is a tag. Never a stripe, a border around content, or decoration.

**The Yellow Shelf Rule.** Yellow is for ratings. Don't spend it on anything else a cook reads.

**The Night Market Rule.** Dark mode is the same stall after dark: same objects, signal colors lightened for contrast. Dark tokens live once, under `:root[data-theme='dark']`.

## Typography

Two voices. Bowlby One (`@fontsource/bowlby-one`) letters signs: anything that would be painted on a board. Work Sans (`@fontsource-variable/work-sans`) sets everything you read or operate.

### Hierarchy
- **Wordmark** (Bowlby 1.75rem; 1.5rem under 420px): "vegdex", always lowercase, crate green.
- **Sign** (Bowlby 0.9rem): course and flavor signs, Pick for me, time choices (0.85rem).
- **Tag** (Bowlby 0.95rem, tabular): the time.
- **Screen title** (Bowlby 1.4rem): Saved recipes, a blog's shelf, More filters, Shopping list.
- **Section title** (Bowlby 1.15rem): Ingredients. Aisle headings use Bowlby 0.95rem in ink.
- **Recipe title** (Work Sans 760, 1.75rem): the open recipe. A recipe title is content, so it stays in Work Sans.
- **Card title** (Work Sans 680, 1.0625rem; 0.95rem under 380px): clamped to three lines, balanced, with the first letter uppercased to absorb publisher casing.
- **Body** (Work Sans 1rem): ingredient lines (`text-wrap: pretty`, 65ch max), with the leading amount in 700.
- **Label** (Work Sans 600, 0.88rem, tabular): pills, chips, counts, form labels.
- **Meta** (Work Sans 0.875rem, tabular): source, hints, footnotes, credits. Nothing a cook reads goes below this size, except the field labels and the narrow-phone rating.
- **Field label** (Work Sans 600, 0.78rem, 0.06em, uppercase, muted): Time, Serves, Per serving. The only uppercase text.

### Named Rules
**The Painted Board Rule.** Bowlby sets signs, tags and screen titles. It never sets a sentence, a form label, a recipe title or a list row.

**The Numbers Line Up Rule.** Times, ratings, counts and amounts use tabular numerals.

## Layout

Mobile first, with a 1200px content width. Header and content share one left edge (`--edge`: 16px, 12px under 420px).

- **Header:** brand row and search, closed by a 3px rule. On phones, scrolling leaves only the search pinned and the brand row scrolls away; Back to top in the dock brings it back. From 900px, brand, search and keys share one row and the whole header stays.
- **Signs:** dinner courses first (Mains, Soups, Salads, Sides, Breakfast, Snacks, Desserts), then Savory, Sweet and the rest. On phones they are one scrolling row that fades over its last 44px; the fade lets go at the end of the row and a chosen sign slides into view. From 700px they sit in two lines that wrap, and nothing scrolls.
- **Filters:** one row: Tonight, the four times and More filters. On phones More filters is a round key with a count badge, and only the last time spells out its unit (none under 380px); labels stay for screen readers. Every time stays at least 44px wide, so under 360px the times take their own line. Each filter has one home: time lives only in the row, High protein only in More filters.
- **Grid:** `repeat(auto-fill, minmax(160px, 1fr))`, 22px row and 10px column gaps. Under 380px, two fixed columns. From 700px, `minmax(220px, 1fr)` with 30px and 20px gaps.
- **Dock:** Pick for me and Back to top. On phones it sits at the bottom centre over a fade of paper. From 900px Pick ends the filter row, so it never covers a photo, and the dock keeps only Back to top in the bottom-right corner. `scroll-padding-bottom` keeps keyboard focus clear of it. It always says "Back to top", never "Filters", so nobody taps it expecting to keep their place.
- **Sheets:** bottom sheets on phones (640px at most, up to the full height). Centred dialogs from 700px (92dvh). The recipe sheet becomes two columns at 900px: photo and facts stick on the left, ingredients scroll on the right.
- **Sheet scrolling:** opening a modal fixes the background at its scroll position until the last sheet is removed. The dialog owns vertical scrolling, and gestures stay within it at both edges. Closing restores the grid position; opening a source shelf starts at its heading.
- **Sheet bar:** Close sits in a sticky bar that is clear at the top and turns solid with a rule once the sheet scrolls, so content passes under the bar and never under the button. Without scroll-driven animation the bar is solid from the start and takes its own space.
- **Sticky footers:** any sheet with a primary action pins it to the bottom.

## Elevation & Depth

Flat. No card shadows: photos sit straight on the paper. Shadows appear only where an object hangs or floats.

- **Tag** (`0 2px 4px var(--shadow)`): time tags.
- **Floating action** (`0 2px 6px var(--shadow), 0 8px 24px var(--card-shadow)`): the dock's buttons.
- **Backdrop** (`var(--scrim)`): behind modal sheets.

## Interaction feedback

- Controls compress to 97% on press; selection colors transition in 160ms.
- A recipe expands from the tapped card into its sheet in 460ms. A random pick rises from below; drawing another slides new content into place in 320ms while the controls stay still. Other sheets enter with a 40px slide in 320ms and close in 180ms.
- An explicit save compresses the heart, expands it to 140% and settles it in 440ms, with a fading ring around the grid heart. Restored favorites stay still.
- On hover a card's photo brightens a little and its tag swings on its string (hover devices only).
- Unsaving in the Saved view greys the photo and says how to undo; the text stays readable.
- Checked shopping rows strike through and move to the end of their aisle in 180ms.
- Page zoom by double-tap or pinch is disabled on the page and sheets, on purpose.
- Search results appear immediately. No grid entrance choreography or scroll reveals.
- Reduced motion keeps color and opacity feedback and removes spatial movement.

## Shapes

Square-ish and painted. Radii come only from the scale: 2px (signs, tags, rating labels), 4px (photos, chips, badges, checkboxes), 6px (fields, small buttons), 8px (search, buttons, sheets), full pill (pills, round keys, segmented control). Controls carry a 2px outline, heavy rules are 3px, hairlines 1px. Card photos are 1:1, the sheet photo 3:2.

## Components

### Recipe card
- No card stock: the photo, the tag hanging 11px off its bottom-left edge (-4°, -2° on even cards), then title, source (up to two lines, the creator is never cut to an ellipsis) and rating. Meta sits at the same height on every card in a row.
- The title is the card's heading. Its button stretches over the whole card; the heart sits above it. A photo still loading shows a faint leaf.
- Most recipes average 5.0, so the label leads with the count; the average shows only below 4.5 ("★ 4.3 · 12 ratings"), and the sheet always shows both.

### Open recipe
- Photo, title, the original title when translated, "From the kitchen of <blog>" (an underlined button that opens the blog's shelf), the rating label. Then a 3px rule and the facts in cells split by hairlines: field labels above, values below, the time on its red tag.
- Ingredients on hairlines, no bullets, the amount first in bold.
- Footer on phones: Save as a heart key (its label stays for screen readers), Share, and the creator link filling the row. With Another, the creator link takes its own row.

### Signs, pills and segments
- **Sign:** outlined board, 44px, crate green when on. Toggles with `aria-pressed`, not an ARIA tablist.
- **Pill:** outlined, 44px, crate green when on. Tonight sets Mains and 45 minutes and shows as one chip that spells it out.
- **Time segments:** one joined control. The chosen time turns into the red tag. The units switch uses the same control with green.
- Focus on signs and segments is inset, since their rows clip an outer ring.

### Sort
- An outlined pill in the count row with a chevron, so it reads as a control.

### Chips and badges
- Active-filter chips: 44px, 2px green outline ("avoid" in Sign Red), with a close icon.
- Badges: outlined, diet in ink, cuisine in muted.

### Header keys
- Language: a 44px round key reading the other language's code (IT, EN), named in full for screen readers. The footer spells it out.
- Night mode: a 44px round key, the icon shows where a tap goes. Follows the system until tapped, then remembers (`lib/theme.svelte.ts`, `vegdex:theme`); an inline script sets `data-theme` before first paint.
- Saved: the heart is outlined and muted when nothing is saved, red once something is. Under 420px it shows "♥ 3", still named "Saved · 3". Under 360px the leaf logo drops so the row holds.

### Inputs
- **Search:** 2px outline, 8px radius, red caret, and a real 44px clear button that stays after the keyboard closes.
- **Sheet fields:** 44px; Add appears once there is text. Typing suggests up to five names in the sheet's flow, prefix matches first with the typed part in green (`IngredientField`, a combobox: arrows, Enter, Escape), never a native datalist, which rebuilds on every keystroke and lags on phones. Comma-separated entries split into chips. Text left in a field applies when the sheet closes, and the footer then says "Add and show recipes" rather than a stale count.

### Shopping list
- Aisles in store-walk order under Bowlby headings. Rows are 52px labels on hairlines with a 24px drawn checkbox. Checked rows sink to the bottom of their aisle: the name strikes through and dims, the amount keeps its contrast. Copy list is the sheet's solid action.

## Do's and Don'ts

- **Do** keep the photo the largest thing on a card.
- **Do** use the red tag for time everywhere time is the headline.
- **Do** use tabular numerals for every time, rating, count and amount.
- **Do** keep the main action of a sheet pinned in a footer.
- **Do** check every change at 320px in Italian, the longest labels on the narrowest screen.
- **Don't** set sentences, form labels or recipe titles in Bowlby.
- **Don't** give controls a sage or tinted resting ground; they are outlined.
- **Don't** add a "verified vegan" mark, badge or headline claim.
- **Don't** use colored side borders, gradient text, decorative glass, or card shadows.
