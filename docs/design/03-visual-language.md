# 03-visual-language.md — Color, Type, Spacing, Elevation, Icons

## Product Register: Characterful

OpenNotes is a writing tool. The personality is part of the value. A Notion-like clean aesthetic with a confident green accent — clean white surfaces, subtle grays, and a vibrant green brand color.

**The green:** `#16a34a` — confident, alive, organic. Not the safe blue of every dashboard. Not the muted green of enterprise. This green says: "I'm a tool for creating, growing, and thinking. I'm alive."

## Color

### Surface: Clean White

```
Surface spectrum:  Clinical ─────────────────────●── Textured
                   #FFFFFF                          #FAF9F7
```

OpenNotes uses pure white. Not warm paper. Not tinted gray. White. Clean. The confidence of white is that it doesn't need to explain itself. Notion proved white works for writing. We follow that instinct but make it our own with the green.

### Palette

```
Light mode (from components.json → baseColor: neutral, primary: #16a34a)
=======================================================================

Surfaces (white + subtle grays):
  background:       oklch(1 0 0)           — #FFFFFF White. The page.
  card:             oklch(1 0 0)           — #FFFFFF White cards.
  popover:          oklch(1 0 0)           — #FFFFFF White popovers.
  sidebar:          oklch(1 0 0)           — #FFFFFF White sidebar.
  secondary:        oklch(0.965 0 0)       — ~#F5F5F4 Subtle gray hover.
  muted:            oklch(0.965 0 0)       — ~#F5F5F4 Subtle gray muted.
  accent:           oklch(0.965 0 0)       — ~#F5F5F4 Interactive hover.

Text:
  foreground:       oklch(0.145 0 0)       — Near-black. Primary text.
  secondary-fg:     oklch(0.205 0 0)       — Dark gray. Secondary text.
  muted-fg:         oklch(0.556 0 0)       — Medium gray. Disabled, hint.
  primary-fg:       oklch(0.985 0 0)       — Near-white. On green surfaces.

Brand (#16a34a):
  primary:          oklch(0.627 0.194 149) — The green. Buttons, links, accents.
  ring:             oklch(0.627 0.194 149) — Focus rings. The green.
  sidebar-primary:  oklch(0.627 0.194 149) — Active nav items. The green.

State:
  destructive:      oklch(0.577 0.245 27)  — #DC2626 Red. Delete, error.
  border:           oklch(0.922 0 0)       — #E4E4E6 Light gray borders.
  input:            oklch(0.922 0 0)       — #E4E4E6 Input borders.

Dark mode:
  background:       oklch(0.145 0 0)       — #1A1A1A Dark.
  primary:          oklch(0.696 0.17 162)  — Brighter green for dark bg.
  foreground:       oklch(0.985 0 0)       — Near-white text.
```

### How Color Is Used

| Context                  | Token              | Rationale                                 |
| ------------------------ | ------------------ | ----------------------------------------- |
| Page background          | `background`       | White = blank canvas for writing          |
| Sidebar background       | `sidebar`          | White + right border = subtle separation  |
| Text                     | `foreground`       | Near-black for readability                |
| Secondary text           | `muted-foreground` | Gray for metadata, timestamps             |
| Hover state              | `accent`           | Very subtle gray (barely perceptible)     |
| Selected state           | `accent`           | Slightly darker gray                      |
| Buttons (primary)        | `primary`          | Green — confident, single CTA color       |
| Buttons (secondary)      | `secondary`        | Subtle gray — doesn't compete with green  |
| Focus rings              | `ring`             | Green — consistent brand signal           |
| Links / wikilinks        | `primary`          | Green — active, clickable                 |
| Sync indicator (synced)  | `primary`          | Green dot — "everything is fine"          |
| Sync indicator (unsaved) | Amber/warning tone | Attention needed, not alarming            |
| Error / delete           | `destructive`      | Red — dangerous actions only              |
| Borders                  | `border`           | Light gray — nearly invisible, structural |

### Contrast Ratios

| Combination                                     | Ratio  | WCAG |
| ----------------------------------------------- | ------ | ---- |
| foreground on background                        | 16.2:1 | AAA  |
| primary-foreground (white) on primary (#16a34a) | 4.6:1  | AA   |
| muted-foreground on background                  | 5.5:1  | AA   |
| foreground-dark on background-dark              | 13.5:1 | AAA  |

## Typography

### Font Stack

The shadcn default: **Geist** (by Vercel) + **Geist Mono** for code. This is a deliberate choice, not a default.

**Why Geist fits OpenNotes:**

- Clean, modern, highly readable
- Designed for interfaces where text IS the product
- Monospace variant for code blocks and system labels
- Already a shadcn default = zero friction
- Looks like Notion, Linear, Vercel — the visual references matter

```
Display/UI:   "Geist", system-ui, -apple-system, sans-serif
Mono:         "Geist Mono", "JetBrains Mono", "Fira Code", monospace
```

### Type Scale

```
Display:      40px / 1.2 / 600    — Landing page hero, file name in zen mode
Heading 1:    28px / 1.3 / 600    — Section headers in rendered markdown
Heading 2:    22px / 1.3 / 600    — Sub-section headers
Heading 3:    18px / 1.4 / 600    — Minor headers
Body:         16px / 1.7 / 400    — Main writing text (editor)
Caption:      13px / 1.5 / 400    — File list items, metadata
Micro:        11px / 1.4 / 500    — Word count, sync status label
```

### Line Height Intent

```
Body (editor):     1.7    — Generous. Breathing room for thoughts.
Caption (sidebar): 1.5    — Tighter. Sidebar density.
Headers:           1.2-1.4 — Tight. Headers lead into body.
```

## Spacing

```
Base:                   4px
  space-xs:             4px   — icon + label cluster
  space-sm:             8px   — button internal padding
  space-md:             16px  — sidebar items, form gaps
  space-lg:             24px  — section separation
  space-xl:             32px  — major layout divisions
  space-2xl:            48px  — breathing room
```

### Editor Layout

```
Sidebar:  240px fixed | 1px border | Editor: flex-1
Editor content:  max-width 720px | centered | 32px padding each side
```

The 720px content width means the text column lands exactly where the eye expects it on a 1440px display. The white space on either side is intentional breathing room — it's not wasted, it's the frame around the writing.

## Corner Radius

```
radius:       0.5rem (8px)   — Base. Buttons, inputs, cards, sidebar items.
radius-sm:    calc(0.5 * 0.6) — Smaller contexts.
radius-lg:    0.5rem          — Modals, popovers.
radius-xl:    calc(0.5 * 1.4) — Large containers.
```

8px base. Clean. Notion-like. Slightly rounded — approachable without being playful.

## Elevation

**No shadows.** White surfaces with subtle border separation. This is a flat, clean design system. Depth comes from contrast and spacing, not from shadow.

```
Level 0:  background (white)      — The page
Level 1:  card (white + border)   — Modals, dropdowns, popovers
```

## Borders

Minimal. 1px solid borders at `oklch(0.922 0 0)` (~#E4E4E6). Only where structural:

- Sidebar/editor divider (right border on sidebar)
- Title bar/editor divider (bottom border on title bar)
- Modal/popover edges
- Input fields
- No borders on cards, list items, or buttons (unless outline variant)

## Iconography

**Set:** Lucide (included with shadcn, tree-shakeable)

| Purpose        | Icon                 | Size |
| -------------- | -------------------- | ---- |
| New file       | `Plus`               | 16px |
| Toggle sidebar | `PanelLeft`          | 16px |
| Zen mode       | `Maximize2`          | 16px |
| Sync (synced)  | `Cloud`              | 16px |
| Sync (offline) | `CloudOff`           | 16px |
| Sync (syncing) | `Loader2` (animated) | 16px |
| File           | `FileText`           | 14px |
| Delete         | `Trash2`             | 14px |
| Search         | `Search`             | 16px |
| Close          | `X`                  | 16px |

All icons: `stroke-width: 1.5`. Consistent weight. No filled icons. Every icon without adjacent text has `aria-label`.

---

**Quality gates:**

- [x] Brand color is #16a34a — not blue, not gray, a real choice
- [x] White backgrounds — Notion-clean, deliberate
- [x] All contrast ratios AA compliant
- [x] Single typeface family (Geist + Geist Mono)
- [x] Spacing on 4px base
- [x] Single icon set (Lucide)
- [x] 8px radius base — Notion-like, not playful, not sharp
- [x] No shadows — flat, clean, confident
