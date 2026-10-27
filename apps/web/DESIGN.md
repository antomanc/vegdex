---
name: vegdex
description: Vegan recipes from the best vegan blogs, filtered in a tap.
colors:
  paper: "#f8f8f4"
  surface: "#ffffff"
  ink: "#18271d"
  muted: "#56635a"
  line: "#e3e2da"
  ink-green: "#1d4a31"
  green-wash: "#e4ede2"
  tomato-rule: "#b23f2a"
  tomato-wash: "#f6e3de"
  star-gold: "#a8741c"
  dark-paper: "#121814"
  dark-surface: "#1a221d"
  dark-ink: "#edf0ea"
  dark-muted: "#a1aca4"
  dark-line: "#2c3830"
  dark-ink-green: "#9fd29a"
  dark-green-wash: "#233528"
  dark-tomato-rule: "#f08a6c"
  dark-star-gold: "#e0b252"
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
  aisle:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  tag: "6px"
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
  pill-on:
    backgroundColor: "{colors.ink-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  saved-on:
    backgroundColor: "{colors.tomato-rule}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  time-tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "3px 7px"
  search:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
---

# Design System: vegdex

## Overview

**Creative North Star: the recipe index card.** vegdex is a card file for a home kitchen: card-stock paper, green ink, a single red rule across the top. The photos supply the appetite. The interface supplies the facts a cook needs to choose (time, rating, source, ingredients) and gets out of the way. It is an Operate surface used on a phone in short sessions, so precision and familiar controls come before expression. The identity lives in a few exact details: the Clarendon titles, the tomato rule, label-style time tags and tabular numerals.

Anti-references: beige "organic" palettes, wellness-brand softness, recipe-blog clutter, and any "verified vegan" badge (the guarantee stays implicit; see PRODUCT.md).

## Colors

The palette is restrained. Neutrals carry the page, ink green carries action and selection, and tomato is spent only on the header rule, saved state, the heart and text actions.

### Primary
- **Ink Green** (#1d4a31; dark #9fd29a): primary buttons ("Cook it on…", "Show N recipes", Add), selected pills and segments, focus ring, the wordmark.
- **Green Wash** (#e4ede2; dark #233528): resting quick pills, active-filter chips, diet badges, image placeholders.

### Secondary
- **Tomato Rule** (#b23f2a; dark #f08a6c): the 2px rule under the sticky header, the Saved toggle when on, filled hearts, text buttons (Clear, Try again), aisle headings in the shopping list.
- **Tomato Wash** (#f6e3de; dark #3a2621): "avoid" chips only.

### Tertiary
- **Star Gold** (#a8741c; dark #e0b252): rating stars, everywhere they appear.

### Neutral
- **Paper** (#f8f8f4; dark #121814): page background. Near-neutral card stock, not beige.
- **Surface** (#ffffff; dark #1a221d): sheets, search field, time tags, raised controls.
- **Ink** (#18271d; dark #edf0ea): body text and titles.
- **Muted** (#56635a; dark #a1aca4): metadata, counts, hints, placeholders. 4.5:1 or better on paper and surface.
- **Line** (#e3e2da; dark #2c3830): hairlines, outline pills, list rules.

### Named Rules
**The One Rule Rule.** Tomato appears as a line exactly once per screen, under the header. Never use it as a card border or a decorative stripe.

**The Ink Means Act Rule.** Solid ink green marks the thing you can act on or the choice you made. Don't use it for decoration.

## Typography

Two families with separate jobs. Besley, a Clarendon revival self-hosted through `@fontsource-variable/besley`, gives the wordmark, recipe titles and sheet headings the voice of a pantry label or an old recipe card. The system sans handles everything you operate: pills, buttons, labels, counts, ingredient lines.

### Hierarchy
- **Wordmark** (Besley 700, 1.6rem, -0.02em): "vegdex", always lowercase.
- **Headline** (Besley 600, 1.5rem, 1.2): sheet titles and the "Saved recipes" view title. Balanced wrapping.
- **Title** (Besley 600, 1rem, 1.25): card titles, clamped to two lines, balanced, with the first letter uppercased to absorb publisher casing.
- **Body** (system sans 400, 1rem, 1.55): ingredient lines (`text-wrap: pretty`, 65ch max) and copy.
- **Label** (system sans, 0.8 to 0.92rem, tabular numerals): pills, metadata, counts, times, amounts.
- **Aisle** (system sans 700, 0.8rem, 0.06em, uppercase, tomato): shopping-list aisle headings, the only uppercase text.

### Named Rules
**The Numbers Line Up Rule.** Times, ratings, counts and amounts use tabular numerals.

**The Serif Is For Names Rule.** Besley names things (the app, a recipe, a sheet). It never sets a button, pill or label.

## Layout

Mobile first, with a 1200px max container. The sticky header holds only the brand row and search (about 120px on a phone) and closes with the tomato rule. Quick filters scroll with the page. Once they are out of view, a "Filters" button in the header jumps back to them. Horizontal pill rows fade at the right edge to show there is more.

- **Grid:** `repeat(auto-fill, minmax(160px, 1fr))` (two columns on a phone). At 700px and up, `minmax(220px, 1fr)` with 24px by 16px gaps.
- **Sheets:** bottom sheets on phones (max 640px, 92dvh). Centred dialogs from 700px. The recipe sheet becomes two columns at 900px (920px wide): photo and facts stick on the left, ingredients scroll on the right.
- **Sticky footers:** any sheet with a primary action pins it to the bottom (Save + "Cook it on…", Clear all + "Show N recipes").
- `scroll-padding-top` follows the measured header height, so focus never lands under it.

## Elevation & Depth

Flat by default, with tonal layering (paper → surface). Shadows appear only where something sits physically on top of something else.

### Shadow Vocabulary
- **Tag** (`box-shadow: 0 1px 3px rgb(0 0 0 / 0.18)`): time tags stuck on a photo.
- **Floating control** (`box-shadow: 0 1px 4px rgb(0 0 0 / 0.15)`): the sheet close button.
- **Backdrop** (`rgb(10 15 12 / 0.55)`): behind modal sheets.

## Shapes

Soft rectangles for content, full pills for small controls, near-square tags for labels stuck on photos. Card photos are 1:1 at 14px radius. Sheets round only their top corners on phones (20px). Buttons use 12px, fields 10px.

## Components

### Buttons
- **Primary:** ink green fill, paper text, 12px radius, 48px tall in sheet footers. The label is balanced and the external-link icon stays attached to the last word.
- **Secondary:** transparent with a 1px line border (Save; turns tomato when saved).
- **Text:** tomato, 600 weight, 40px minimum hit area (Clear, Try again, Uncheck all; muted and disabled when there is nothing to clear).
- **Zero state:** "Show N recipes" at zero turns into an outline button reading "No matches. Loosen a filter".

### Pills and segments
- **Quick pill:** green wash at rest, ink green when on, 40px tall.
- **Tonight:** the first quick pill, outlined in ink green with a clock icon at rest. It sets Mains and 45 minutes or less, and shows as one "Tonight" chip.
- **Outline pill:** transparent with a line border (More filters, High protein, free-from).
- **Time segments:** one joined control (≤ 15, 30, 45, 60 min); picking one replaces the last.

### Chips
- Removable active-filter chips: green wash (tomato wash for "no X"), 32px, with a close icon.

### Recipe card
- **Character:** a photo with the facts underneath, nothing more.
- 1:1 photo, label-style time tag bottom-left, heart top-right on a paper disc (dark disc in dark mode). Then the Besley title, then source and gold-star rating with a compact count. The open button's accessible name is the title, and its description is time, source and rating.

### Inputs
- **Search:** pill on surface with a muted search icon, green border and ring on focus, a themed clear icon, and a tomato caret.
- **Sheet fields:** 44px, paper fill, 10px radius, with an Add button beside them. Comma-separated entries split into separate chips, and text left in a field applies when the sheet closes.

### Shopping list
- Aisles in store-walk order, each with an uppercase tomato heading. Rows are 52px full-width labels ruled by hairlines, in sentence case. Checked items sink to the bottom of their aisle and get a strike-through.

## Do's and Don'ts

- **Do** spend tomato on the header rule, saved state and hearts only.
- **Do** use tabular numerals for every time, rating, count and amount.
- **Do** keep the main action of a sheet pinned in a footer.
- **Don't** set buttons, pills or labels in Besley.
- **Don't** add a "verified vegan" mark, badge or headline claim.
- **Don't** return to a beige or cream page background; paper stays near-neutral (#f8f8f4).
- **Don't** use colored side borders, gradient text or decorative glass.
