# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mantle: an interactive desktop wallpaper built for Lively Wallpaper on Windows. A React frontend (served by a local Node companion at `http://127.0.0.1:7337/`) detects and launches real Windows applications. Wallpaper detail lives in [README.md](README.md); visual system in [DESIGN.md](DESIGN.md).

## Commands

```bash
npm install
npm run dev            # companion (:7337, tsx watch) + Vite (:5173); open http://127.0.0.1:5173
npm run build          # web then server; required before testing the production bundle
npm start              # serve built frontend from :7337 (what Lively loads)
npm run typecheck      # both workspaces
npm run install:lively # copy manifest into Lively's library (flag -NoBuild via direct powershell call)
npm run install:autostart   # scheduled task that runs the companion at logon
```

Testing is Playwright-driven; there is no unit-test runner. Install the tools once without touching `package.json`:

```bash
npm i -D playwright@1.64.1 pngjs --no-save
```

Then, against a running server (`MANTLE_URL` defaults to `:7337`):

```bash
node tools/check.mjs        # 22 DOM-level checks (quiet state, drag persistence, search, settings, offline)
node tools/buttons.mjs      # 31 button/minimize/hover-peek/multi-select checks
node tools/nudge.mjs        # 10 neighbour-slide checks
node tools/reorder.mjs      # 8 drag-to-reorder checks
node tools/dragstress.mjs   # 4 panel-drag-robustness checks
node tools/statesync.mjs    # 5 settings-sync checks (wipe → companion restore)
node tools/magnetprobe.mjs  # 10 dock magnetic-hover checks (follow, reset, drag intact)
node tools/rescan.mjs       # rescans the machine, verifies user organization survives
node tools/shot.mjs panels  # screenshots to tools/shots/ (small JPEGs — large images have disrupted sessions here)
node tools/watch-requests.mjs 60   # tails the companion request log, tags [wallpaper]/[vite-dev]/[headless-test]
```

Run every suite after touching panel layout, drag, or the store.

## Architecture

**Two halves; organization owned by the web, mirrored opaquely by the server.**

- `server/` (Express 5, TS → `server/dist`): owns *detected* applications only. `scanner.ts` walks Start menu / desktop shortcuts, `Get-StartApps`, Appx manifests and the registry, then filters junk (`JUNK_NAME`, `JUNK_EXE`, `INTERNAL_EXE`). IDs are `sha1` of the stable launch target, so rescans keep them. PowerShell scripts in `server/powershell/` do the Windows work; `src/scripts.ts` wraps them and **must** resolve paths via `directoryOf()` (use `fileURLToPath`, never `URL.pathname`). Store: `%LOCALAPPDATA%\Mantle Wallpaper\apps.json`, atomic write.
- `web/` (React 19, Vite, Zustand): owns *all* user organization — categories, panel geometry, dock, favourites, per-collection ordering, hidden apps — persisted in `localStorage` under `mantle.v1` and **mirrored to the companion** via `state/serverSync.ts` (`GET/PUT /api/ui-state`, opaque envelope at `%LOCALAPPDATA%\Mantle Wallpaper\ui-state.json`) so settings survive Lively wiping its embedded browser profile. Boot reconciliation: newer `savedAt` wins; a local snapshot without sync metadata (test seeds, pre-sync profiles) always wins and is then backed up. localStorage edits made behind a live page's back (test seeds) beat that page's stale memory — `persistCacheExternal()` in `state/store.ts`. Merged with detected apps at render time via `useAppIndex()` (`hooks/useAppIndex.ts` + `lib/apps.ts`). **A rescan must never erase organization**; the server stores the mirror verbatim and never reads into it.

**Serving and auth.** The companion serves the built frontend and injects `window.__MANTLE_TOKEN__` into `index.html`; every `/api` call carries `X-Mantle-Token` (or the `mantle_session` cookie the server sets). Dev icons need `?t=` because `<img>` cannot send headers. CORS allows only `127.0.0.1/localhost` on 7337 and 5173. Launch accepts only `{ id }`; paths come from the scan store and must sit under a known root.

**Floating elements.** Each category panel renders as an outer `[data-floating-slot]` (holds stored position + the sideways nudge) wrapping the inner `[data-floating-root]` glass panel. Two reasons this split exists: the nudge transform must not fight the collapse transition, and slot/root positions must be measured separately in tests.

- Closed panels stay **mounted** with `display: none` — unmounting mid-gesture kills a drag.
- `components/floating/usePanelDrag.ts` handles `pointerdown/move/up` on `window` (capture), not on the handle, and skips presses that land on buttons/inputs. Never rely on `setPointerCapture` alone.
- `state/layout.ts` (`pushFor`) makes panels to the right of an expanded neighbour slide aside; positions in storage are never rewritten.
- Context menus must be portalled to `document.body` — rendering inside a panel caps their z-index beneath the panel.

**Persistence shape** is in `state/defaults.ts` (`createDefaultState`) and `types.ts`. Per-app overrides live in `persist.appOverrides[appId]`: `categories`, `categoriesManual` (set on manual edits; auto-suggestions never touch it), `isFavorite`, `displayName` (the sentinel `\u0000hidden` hides an app), `iconDataUrl`, `order[categoryId]` (manual sort rank).

## Conventions worth knowing

- App IDs and all `/api` payloads are validated with zod (`server/src/app.ts`).
- New Windows integrations belong in `server/powershell/` + `src/scripts.ts`; keep `spawn` args as arrays, never shell strings.
- The visual tokens (`GLASS_CLASS`, colours, type scale) are documented in [DESIGN.md](DESIGN.md) — reuse them rather than inventing new surfaces.
- Test scripts share no helpers: if you change test selectors, update `tools/*.mjs` together.
- Lively never forwards mouse-wheel events to web wallpapers ([rocksdanister/lively#3042](https://github.com/rocksdanister/lively/issues/3042)); every scrollable surface wires `hooks/useDragScroll.ts` (press-drag pan, flick momentum, middle-drag). Never build wheel-only interactions.
