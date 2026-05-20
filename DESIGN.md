# Design System — SphynxPlay

## Product Context
- **What this is:** African drama streaming platform with a Soul Token engagement economy
- **Who it's for:** African consumers and diaspora audiences who want premium entertainment on par with Netflix/Disney+
- **Space/industry:** African OTT streaming — peers are ShowMax, IROKOtv, Netflix Africa
- **Project type:** Consumer mobile app (PWA + Capacitor native iOS/Android)

## The Memorable Thing
> "Sleek and modern — on par with Netflix/Disney+"

The Africanness is in the content, not the chrome. No decorative patterns or cultural motifs in the UI shell. Design competes with global streaming giants on polish.

## Aesthetic Direction
- **Direction:** Obsidian Cinema
- **Decoration level:** Minimal — typography and poster art do all the work. Dark glass surfaces with subtle depth via elevation (shadow + slightly lighter background value). No gradient blobs, no icon grids, no decorative fills.
- **Mood:** A darkened cinematheque, not a buffet. Stillness before the drama. The user steps into something serious before the content earns their excitement.

## Typography

| Role | Font | Rationale |
|------|------|-----------|
| Display / Hero | **Fraunces** (variable, Google Fonts) | Editorial weight, literary gravity. Makes drama titles feel like they matter. Free equivalent of Canela without a commercial license. |
| Body | **Geist Sans** (Vercel CDN / npm) | Neutral, clean, modern. Zero cultural baggage. Long descriptions read without fatigue. |
| UI / Labels | **Plus Jakarta Sans** (Google Fonts) | For nav, buttons, badges, tabs. Slightly geometric, confident at 12–14px. |
| Data / Tokens | **JetBrains Mono** (Google Fonts) | Soul Token counts, episode numbers, watch progress. Renders `◈ 2,840` cleanly. |

**Loading:**
```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.css">
```

**Scale (mobile-first):**

| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| hero | 52–88px | 800 | Fraunces | Featured show title on hero still |
| h1 | 30–36px | 800 | Fraunces | Drama detail title |
| h2 | 22px | 700 | Fraunces italic | Section hero headings |
| h3 | 15–16px | 700 | Plus Jakarta Sans | Browse row labels, card titles |
| body | 15–16px | 400 | Geist Sans | Descriptions, episode summaries |
| label | 12–13px | 500–600 | Plus Jakarta Sans | Nav, buttons, metadata labels |
| caption | 10–11px | 400 | Plus Jakarta Sans | Secondary metadata, timestamps |
| mono | 11–28px | 400–600 | JetBrains Mono | `◈ token`, ep numbers, durations |

**Font blacklist (never use as primary):** Inter, Roboto, Arial, Helvetica, Space Grotesk, system-ui, -apple-system, Montserrat, Poppins, Lato, Open Sans.

## Color

**Approach:** Restrained — each color has one job. Color is rare and meaningful, never decorative.

```css
:root {
  /* Surfaces */
  --bg:              #08080A;  /* App shell, page background */
  --surface:         #111114;  /* Cards, modals, bottom sheets */
  --surface-el:      #1A1A1F;  /* Dropdowns, tooltips, hover states */
  --surface-hover:   #22222A;  /* Active pressed states */

  /* Text */
  --text:            #F0EDE8;  /* Primary — warm white, softer on OLED than pure #FFF */
  --muted:           #6B6872;  /* Metadata, timestamps, secondary labels */

  /* Brand */
  --accent:          #E61E24;  /* Primary CTA, active tab, brand mark — use sparingly */
  --accent-dim:      rgba(230, 30, 36, .15);  /* Accent tint backgrounds */

  /* Economy */
  --token-gold:      #C9A84C;  /* ◈ Soul Token counter ONLY — old coin, not Vegas */
  --token-dim:       rgba(201, 168, 76, .12); /* Token tint backgrounds */

  /* Semantic */
  --live:            #1DB87E;  /* Episode progress, live indicator, success */
  --error:           #FF4D4D;  /* Errors, destructive actions */

  /* Structure */
  --border:          rgba(255, 255, 255, .06); /* All borders and dividers */
}
```

**Dark mode:** This IS the dark mode. There is no light mode — streaming apps live in the dark. If a light reading view is ever needed, increase surface values to #F5F2ED / #EDEAE4 and flip text to #0D0D10, reduce accent saturation by 15%.

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable — streaming apps need room for poster art to breathe
- **Card gutter:** 12px
- **Section padding:** 24px horizontal · 16–24px vertical between rows
- **Content max-width:** 430px mobile-native · 1200px web

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 4px | Icon internal padding, tiny gaps |
| xs | 8px | Tag internal padding, inline gaps |
| sm | 12px | Card gutter, compact stack |
| md | 16px | Standard vertical rhythm |
| lg | 24px | Section padding, card padding |
| xl | 32px | Large section gap |
| 2xl | 48px | Between major sections |
| 3xl | 64px | Hero breathing room |

**Border radius scale:**

| Token | Value | Usage |
|-------|-------|-------|
| sm | 6px | Buttons (small), genre tags |
| md | 8px | Buttons (default), inputs, cards |
| lg | 12px | Modals, bottom sheets |
| card | 10px | Poster cards |
| phone | 40px | Phone frame chrome |
| pill | 100px | Badges, rank pills, tags |

## Layout

- **Approach:** Content-poster grid, mobile-first
- **Hero:** Single full-bleed still frame — one show, full attention, no carousel, no dots, no arrows. One cinematic image with show title in Fraunces and a Watch Now button.
- **Browse:** Horizontal scroll rows by category. Portrait 9:16 aspect ratio cards for vertical drama content.
- **Bottom nav:** 4 items — Home, Discover, Soul (◈), Library
- **Grid:** 1-column mobile · 2-column tablet · 4-column desktop for card grids
- **Max content width:** 430px (mobile-native shell) · 1200px (web browse)

## Motion

- **Approach:** Intentional — only transitions that aid comprehension or reward action

| Duration | Value | Usage |
|----------|-------|-------|
| micro | 50–100ms | Tap states, toggle switches |
| short | 150ms | Card fade-up enter, button hover |
| medium | 250–400ms | Screen transitions, modal open/close |
| token-pulse | 600ms | Soul Token reward — brief gold glow on counter |

**Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`

Nothing auto-plays motion without user intent. No parallax, no auto-advancing carousels, no ambient animation.

## The One Risk

**Soul Tokens are typographic, not iconographic.**

Token balance renders as `◈ 2,840` in JetBrains Mono. No trophy icon, no star badge, no gamification sparkle. A symbol and a number — quiet status. Let the number speak.

- Display in status bar (top-right of app header) on all screens
- Display in Soul tab with rank progress bar
- Gold pulse animation (600ms) when tokens are earned
- New users: one tooltip on first view explaining `◈`

This is the single deliberate departure from streaming app convention. It makes SphynxPlay feel like a real economy, not a loyalty points widget from a hotel app.

## Safe Choices (table stakes — don't break these)

1. **Dark background** — universal for streaming. Content pops, OLED battery savings, dark feels premium.
2. **Horizontal scroll rows by category** — the discover pattern users expect. Don't reinvent.
3. **Red (#E61E24) as primary action color** — already established in brand. Keep consistent.
4. **Portrait 9:16 poster cards** — matches vertical video content format.

## Logo
- To be uploaded. Will replace wordmark on home feed hero and app header.
- Until uploaded: use `Fraunces italic` wordmark "Sphynx**Play**" with accent red on "Play".
- Logo file should be provided as SVG for sharpness at all densities.

## CSS Custom Properties Template

Add to the `:root` in `index.html` (or a `<style>` block in the `<head>`):

```css
:root {
  --bg:           #08080A;
  --surface:      #111114;
  --surface-el:   #1A1A1F;
  --text:         #F0EDE8;
  --muted:        #6B6872;
  --accent:       #E61E24;
  --accent-dim:   rgba(230,30,36,.15);
  --token-gold:   #C9A84C;
  --token-dim:    rgba(201,168,76,.12);
  --live:         #1DB87E;
  --error:        #FF4D4D;
  --border:       rgba(255,255,255,.06);

  --r-sm:         6px;
  --r-md:         8px;
  --r-lg:         12px;
  --r-card:       10px;
  --r-pill:       100px;

  --sp-2xs:       4px;
  --sp-xs:        8px;
  --sp-sm:        12px;
  --sp-md:        16px;
  --sp-lg:        24px;
  --sp-xl:        32px;
  --sp-2xl:       48px;
  --sp-3xl:       64px;

  --t-micro:      75ms;
  --t-short:      150ms;
  --t-medium:     300ms;
  --t-pulse:      600ms;
  --ease-in:      cubic-bezier(.4,0,1,1);
  --ease-out:     cubic-bezier(0,0,.2,1);
  --ease-move:    cubic-bezier(.4,0,.2,1);
}
```

## Decisions Log

| Date | Decision | Tag | Rationale |
|------|----------|-----|-----------|
| 2026-05-13 | Aesthetic: Obsidian Cinema | safe | Dark is table stakes for streaming. OLED-optimised. Matches north star. |
| 2026-05-13 | Display: Fraunces | safe | Drama titles need literary gravity. Free on Google Fonts. |
| 2026-05-13 | Body: Geist Sans | safe | Neutral, clean. Zero cultural baggage. Reads long copy without fatigue. |
| 2026-05-13 | Text: #F0EDE8 warm white | safe | Pure white on near-black causes eye strain on OLED. Warm is softer and more cinematic. |
| 2026-05-13 | Soul Tokens: ◈ 2,840 JetBrains Mono | **risk** | Quiet typographic status over gamification badge. Feels like a real economy. New users need tooltip. |
| 2026-05-13 | Hero: single still frame, no carousel | safe | One show, full attention. Carousel removed as risk — typographic tokens is the one bold departure. |
| 2026-05-13 | Token gold: #C9A84C old coin | safe | Warmer, more earned than bright gold. Doesn't cheapen dark aesthetic. |
| 2026-05-13 | Logo: placeholder wordmark until asset uploaded | safe | Fraunces italic "SphynxPlay" with red "Play" until SVG logo is provided. |
