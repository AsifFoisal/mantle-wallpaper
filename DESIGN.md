# Mantle — visual system

## Intent

A wallpaper that happens to organize your desktop. Read from across the room it is a night sky with a clock. Read up close it holds every app you launch. The dress code is calm: nothing on screen unless the desktop calls for it.

## Direction: deep space, warm ink

| Token | Value | Use |
| --- | --- | --- |
| `ink-950` | `#060709` | Page base behind everything |
| `ink-900` | `#0b0d12` | Panel base when glass has no backdrop |
| `mist-100` | `#f2f1ee` | Primary text |
| `mist-300` | `#c9cad0` | Secondary text |
| `mist-500` | `#8d909c` | Tertiary text |
| `mist-600` | `#6b6e7a` | Metadata, captions |
| `champagne-400` | `#d9c7a3` | Single accent: active, running dots, focus |
| `indigo-deep` | `#3a46a0`-ish bloom | Nebula primary |
| `violet-deep` | `#7a4aa0`-ish bloom | Nebula secondary |
| `teal-deep` | `#1d5c58`-ish bloom | Nebula tertiary |

Categories carry their own hue, used only for their glyph chip, panel header accent and drop highlight.

## Type

- **Instrument Serif italic** — clock numerals only. Large, tight, tabular. This is the one piece of display type.
- **Geist Variable** — everything else. 11–13.5px at normal weight; labels use uppercase with 0.2–0.34em tracking.
- Numerals in use: `font-variant-numeric: tabular-nums` everywhere a number can change.

## Surface

Every floating element is one material:

```
background: linear-gradient(rgba(255,255,255,.05), rgba(255,255,255,.012)), rgba(9,10,15,.82)
backdrop-filter: blur(26px) saturate(150%)
border: 1px solid rgba(255,255,255,.075)
radius: 20–28px
shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 28px 70px -26px rgba(0,0,0,.9)
```

The dock and orb reuse the same material at smaller radius. No second surface style exists.

## Background

Layered, back to front:

1. Base wash — two large radial gradients over `#0a0b10`.
2. Three drifting nebula blobs (indigo, violet, teal), `blur(50–65px)`, animated on 72/86/94s loops, transforms only.
3. Colour bloom — three wide radial glows composited at `opacity .5–1`.
4. Star field — ~30–170 1px dots, three twinkle classes, staggered negative delays.
5. Film grain — SVG feTurbulence, `mix-blend-mode: overlay`, 0.05.

`lowResourceMode` or `animationEnabled: false` pauses all of it without removing the look.

## Motion

- Panel entrance: `panel-in` — 260ms, `translateY(6px) scale(.972)` → resting.
- Menus: `pop-in` — 140ms.
- Toasts: spring 420/34, exit slide.
- Hover: 150–200ms colour and 1px lift on app icons.
- Dock ("magnetic glass"): icons swell ~24%, lift and lean toward the cursor under a gaussian falloff (σ ≈ 0.9× icon width) while a white/champagne sheen tracks the pointer across each tile (`--sheen-x/y/o` fed by a rAF loop — no re-renders). Leaving settles with an overshoot spring (`cubic-bezier(.2,1.5,.3,1)`). Off when magnification is disabled, in low-resource mode or reduced motion — those get the plain 1px lift.
- Collapsing a collection animates `flex-basis` 340ms with the body fading 240ms and sliding 4px, so a minimized panel breathes rather than snapping.
- Hovering a minimized collection peeks it open for reading; leaving waits 260ms before collapsing (the panel edge can move under the cursor).
- All of it honours `prefers-reduced-motion`.

## Layout rules

- Nothing is fixed except what the user pins. Every element stores an `{x, y, w, h}` in CSS px.
- Negative `x`/`y` mean "anchored to the right/bottom edge" (the dock and orb defaults).
- On resize, positions clamp back into the viewport rather than persisting out-of-bounds values.
- Clicking bare wallpaper closes transient surfaces (settings, search, favourites). Category panels stay until closed.
