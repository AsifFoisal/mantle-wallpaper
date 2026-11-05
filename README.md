# Mantle

**An interactive desktop wallpaper that doubles as a personal taskbar and app organizer — built for [Lively Wallpaper](https://www.rocksdanister.com/lively/) on Windows.**

The quiet state is just a wallpaper: a slow nebula, a large clock, a slim dock. Interaction unfolds the rest — floating collections of your real installed apps, a working taskbar with minimize/restore, instant search, and a floating settings orb you can put anywhere.

![Mantle](lively/thumbnail.jpg)

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Using it](#using-it)
- [The dock is a taskbar](#the-dock-is-a-taskbar)
- [Drag grips](#drag-grips)
- [Multi-monitor](#multi-monitor)
- [Settings](#settings)
- [API surface](#api-surface)
- [Configuration](#configuration)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Project layout](#project-layout)

---

## What it does

- **Quiet by default.** No dashboard, sidebar, header or grid. Clock, dock, settings orb. Nothing else until you ask.
- **A real taskbar.** Pinned apps launch, running apps minimize and restore, minimized apps stay visible but dimmed, closed apps disappear from the dock automatically.
- **Real Windows apps.** Discovers Start menu shortcuts, desktop shortcuts, packaged (Microsoft Store) apps and installed programs from the registry — and launches them, including apps that require administrator approval (the UAC prompt appears).
- **Floating everything.** Collections, the dock, the clock and the settings orb are independently draggable, resizable, lockable and persistent. Every draggable element has a dedicated `;;;` grip zone, so panels never move when you only meant to click.
- **Organize without friction.** Drag apps between collections, right-click for a context menu, `Ctrl+K` to search everything.
- **Rescans never destroy your work.** User organization lives in the browser keyed by stable app ids; detection lives in the companion service. A rescan replaces detections only.
- **Works offline.** If the companion is down, the wallpaper still renders and your layout still works; a small notice says desktop launching is paused.

---

## Architecture

```
Lively Wallpaper ──loads──▶ http://127.0.0.1:7337/   (companion serves the built frontend)
                                     │
                                     ├── /api/*        REST, token auth, CORS allowlist
                                     ├── /api/icons/*  PNG icons extracted + cached on disk
                                     ├── /api/windows  window snapshot (taskbar) + minimize/restore
                                     └── PowerShell    shortcuts · Appx · registry · icons · windows · launch
```

- **Frontend** (`web/`) — React 19, Vite, TypeScript, Tailwind CSS v4, Motion, lucide-react, Zustand. State persisted in `localStorage` and mirrored to the companion so it survives Lively wiping its browser profile.
- **Companion** (`server/`) — Node 20+, Express 5, TypeScript. JSON storage written atomically to `%LOCALAPPDATA%\Mantle Wallpaper\`. Runs as a scheduled task at logon.
- **Windows integration** (`server/powershell/`) — PowerShell 5.1 scripts, never shell strings:
  - `resolve-shortcuts.ps1` — `.lnk` targets via `WScript.Shell`
  - `list-uwp.ps1` / `list-appx.ps1` — packaged apps + icon manifests
  - `list-registry.ps1` — installed programs
  - `extract-icon.ps1` / `find-logo.ps1` — icon extraction
  - `windows.ps1` — `EnumWindows` snapshot (title, process, minimized) + minimize/restore by `hwnd`; compiles its Win32 helper to `MantleWin.Windows.dll` once so repeated polls are cheap
  - `launch.ps1` — launches through the shell (`Start-Process`) so elevation manifests raise the UAC prompt

---

## Quick start

Requires Windows 10/11 and Node.js 20+ (24 recommended). Lively Wallpaper for wallpaper mode; a plain browser works too for development.

```bash
npm install
npm run dev          # companion on :7337 + Vite on :5173 (open http://127.0.0.1:5173)
```

Production + wallpaper:

```bash
npm run build               # web then server
npm start                   # serve the built frontend at http://127.0.0.1:7337 — this is what Lively loads
npm run install:lively      # copy the wallpaper manifest into Lively + enable mouse input
npm run install:autostart   # scheduled task that starts the companion at every logon
```

Then open Lively → Library → **Mantle** → set as wallpaper. After changing server code, restart the companion (Task Scheduler → **Mantle Companion** → Run, or `schtasks /run /tn "Mantle Companion"`).

---

## Using it

| Interaction | Result |
| --- | --- |
| Click a dock icon (closed app) | Launch it |
| Click a dock icon (running app) | Minimize its windows |
| Click a dock icon (all windows minimized) | Restore + focus |
| Right-click a pinned dock icon | Remove from dock |
| Right-click a running (unpinned) dock icon | Pin it |
| Drag a dock icon | Reorder pins |
| Drag an app from anywhere onto the dock | Pin it |
| Drag the `;;;` grip on the dock's left edge | Move the dock |
| Right-click the dock | Lock / unlock position |
| Drag any panel's `;;;` grip | Move it (position saved) |
| Drag a panel's bottom-right corner | Resize |
| Hover a minimized collection | Peeks it open; collapses when you leave |
| Drag an app onto another | Reorder inside the collection |
| Shift-click apps, then drag one | Moves the whole selection together |
| Selection bar | Remove / dock / favourite several apps at once |
| Right-click an app | Context menu (open, favourite, dock, categories, rename, hide) |
| `Ctrl K` | Search apps and collections |
| `↑ ↓ Enter Esc` | Search navigation |
| Drag the clock's `;;;` grip | Move the clock |
| Drag the settings orb | Move the orb (the orb itself is the grip) |
| Double-click the wallpaper | Nothing — it is still a wallpaper |

---

## The dock is a taskbar

The dock's left edge starts with a `;;;` move grip, then your **pinned** apps, then a **taskbar section**:

- Any app with an open window that is **not pinned** appears automatically with its real icon and a running dot. It disappears the moment its last window closes.
- Minimized apps stay on the dock with a dimmed icon and dimmed dot — click to bring them back.
- Clicking a running app minimizes its windows; clicking again restores and focuses them.
- Hovering shows the real window titles; right-click a running app to pin it permanently.
- A fast window poll (every 3 s, paused in low-resource mode and when the page is hidden) keeps the taskbar in sync, and actions taken through the dock refresh it instantly.

Windows of Microsoft Store apps are hosted by `ApplicationFrameHost.exe`, so they are not matched to their app and do not appear in the taskbar section; pinned ones still launch normally.

---

## Drag grips

Every draggable element exposes a dedicated grip — two columns of three dots, rendered as `;;;`-style sections:

- Category panels, the settings window, the search palette and every glass window carry the grip in their header, next to the title.
- The dock and the clock carry theirs at the edge.
- The grip has a generous hit area and a grab cursor; the rest of the surface (titles, text, icons, the clock face) is free for clicking, selecting and hovering without ever moving the element.
- When a position is locked, the grip dims and refuses the drag.

---

## Multi-monitor

In **Extend** mode Lively runs one wallpaper instance per display; each instance is independent.

1. Open the Lively app (tray icon → Open Lively).
2. Hover Mantle in the library and click the **monitor icon** in the thumbnail's corner.
3. Select the second display (or *all displays*) and apply.

The layout is stored per browser profile, so both instances share the same arrangement but position their floating elements independently within their own viewport. Make sure `Win + P` is set to **Extend**.

---

## Settings

Everything lives in the floating settings window opened from the orb:

| Section | What it holds |
| --- | --- |
| **General** | Display name, clock/date format, greeting, orb visibility, hover-only mode |
| **Categories** | Create, rename, re-icon, recolour, reorder, show/hide, lock, delete collections |
| **Applications** | Rescan, filter, sort, assign collections, favourite, dock, hide, launch |
| **Dock** | Show, lock, orientation, icon size, spacing, labels, magnification, restore position |
| **Layout** | Lock clock/orb, clock size, restore default layout, close all panels |
| **Appearance** | Nebula / gradient / image background, ambient intensity, animations |
| **Performance** | Low-resource mode, running indicators, effects |
| **About** | Shortcuts and connection state |

---

## API surface

All routes require the token (see [Security](#security)).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/system/status` | Companion version, scan status |
| `GET` | `/api/apps` | Detected applications |
| `POST` | `/api/apps/scan` | Start a rescan |
| `POST` | `/api/apps/launch` | Launch by `{ id }` only |
| `POST` | `/api/apps/running` | Which of the given ids are running |
| `GET` | `/api/windows` | Visible top-level windows (`hwnd`, `pid`, `title`, `exe`, `minimized`) |
| `POST` | `/api/windows/action` | `{ action: "minimize" \| "restore", hwnd }` |
| `GET` | `/api/icons/:id` | Extracted app icon (PNG) |
| `GET`/`PUT` | `/api/ui-state` | Opaque mirror of the frontend organization |

---

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `MANTLE_PORT` | `7337` | Companion port |
| `MANTLE_NO_AUTOSCAN` | unset | Set `1` to skip the boot scan |
| `LOCALAPPDATA` | user profile | Data directory root |

Data files (`%LOCALAPPDATA%\Mantle Wallpaper\`):

- `apps.json` — detected applications (regenerated by scans)
- `manifests.json` — packaged-app metadata for icon lookup
- `ui-state.json` — mirror of the frontend layout (collections, panels, dock, settings)
- `token` — shared secret between the wallpaper and the API
- `icons\` — extracted icon cache (safe to delete)
- `background` — wallpaper image uploaded from Appearance settings

`MantleWin.Windows.dll` (compiled once beside `server/powershell/windows.ps1`) caches the taskbar's Win32 helper — delete it freely; it rebuilds on the next poll.

---

## Security

- The service binds to **127.0.0.1 only** and is not reachable from the network.
- CORS accepts only `http://127.0.0.1:7337`, `http://localhost:7337`, `http://127.0.0.1:5173` and `http://localhost:5173`.
- Every `/api` call needs the 64-hex token from `%LOCALAPPDATA%\Mantle Wallpaper\token`, sent as `X-Mantle-Token` (or the `mantle_session` cookie the server sets when serving the wallpaper).
- The launch endpoint accepts **only** `{ "id": "<app id>" }`. Paths, arguments and working directories come from the scan store — never from the request — and must sit under known roots (Start Menu, Desktop, Program Files, `%LOCALAPPDATA%`, `D:\Softwares`, `D:\Games`). Anything else is refused.
- Launches go through the shell, so elevation-requiring apps show the standard UAC prompt; declining it is reported back, never hidden.
- Window actions are zod-validated and scoped to a single `hwnd`; there are no process handles, no shell strings anywhere, and every PowerShell invocation passes arguments as arrays over stdin.
- Strict CSP, `nosniff`, no framing.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Amber dot on the settings orb, "Desktop bridge offline" | Run `npm start`, or `npm run install:autostart`, or run the **Mantle Companion** task in Task Scheduler |
| Wallpaper blank in Lively | Companion not running — Lively loads `http://127.0.0.1:7337/` |
| Clicks pass through the wallpaper | Lively → Settings → ensure mouse input is on (`install:lively` sets it) |
| An app "launches" but nothing opens | It needs admin rights — a UAC prompt appears; approve it. Declining is reported as a toast |
| Elevated app never opens, dock says "Timed out waiting for Windows permission (UAC)" | The consent dialog wasn't answered within ~90 s — click the icon again |
| Taskbar section doesn't update | Low-resource mode pauses the window poll; also the page pauses while hidden |
| Minimized Store apps don't appear | Windows hosts them under `ApplicationFrameHost.exe`; they can't be matched |
| New install not found | Settings → Applications → Rescan |
| App icon missing | Right-click app, or rescan; the icon cache is `%LOCALAPPDATA%\Mantle Wallpaper\icons` (delete freely) |
| Wallpaper only on one monitor | See [Multi-monitor](#multi-monitor) — assign the wallpaper to each display in Lively |
| Floating element drags when you meant to click | It doesn't anymore — use the `;;;` grip; if a position is locked the grip is dimmed |

---

## Development

```bash
npm run typecheck      # both workspaces
npm run dev            # companion (:7337, tsx watch) + Vite (:5173)
npm run build          # web then server; required before testing the production bundle
```

Testing is Playwright-driven; there is no unit-test runner. Install the tools once without touching `package.json`:

```bash
npm i -D playwright@1.64.1 pngjs --no-save
```

Then, against a running server (`MANTLE_URL` defaults to `:5173`):

```bash
node tools/check.mjs        # 22 DOM-level checks (quiet state, drag persistence, search, settings, offline)
node tools/buttons.mjs      # 31 button/minimize/hover-peek/multi-select checks
node tools/nudge.mjs        # 10 neighbour-slide checks
node tools/reorder.mjs      # 8 drag-to-reorder checks
node tools/dragstress.mjs   # 4 panel-drag-robustness checks (grip-based)
node tools/dragprobe.mjs    # drag-follows-cursor 1:1 probe
node tools/statesync.mjs    # 5 settings-sync checks (wipe → companion restore)
node tools/magnetprobe.mjs  # 10 dock magnetic-hover checks + dock grip drag
node tools/rescan.mjs       # rescans the machine, verifies user organization survives
node tools/shot.mjs panels  # screenshots to tools/shots/ (small JPEGs)
node tools/watch-requests.mjs 60   # tails the companion request log
```

Run every suite after touching panel layout, drag, the dock or the store. Drag tests press the `[data-drag-handle]` grip; the dock drag is scoped to `[data-floating-root='dock']`.

### Notes worth knowing

- Closed panels stay **mounted** with `display: none` — unmounting mid-gesture kills a drag.
- `usePanelDrag` listens on `window` (capture) and starts drags **only** from `[data-drag-handle]` inside its own element; the settings orb opts out via an empty `handleSelector` because the orb itself is the handle.
- Context menus are portalled to `document.body` — rendering inside a panel caps their z-index beneath it.
- Test scripts share no helpers: if you change selectors, update `tools/*.mjs` together.
- After changing **server** code, restart the companion process — the scheduled task runs the compiled `server/dist`, not `tsx watch`.

---

## Project layout

```
web/                   React wallpaper
  src/components/{wallpaper,floating,panels,dock,settings,ui,search}
  src/components/floating/DragGrip.tsx    shared ;;; grip
  src/components/floating/usePanelDrag.ts grip-gated pointer drag
  src/state/                              Zustand store + persistence
server/                 Express companion
  src/scanner.ts                          Start menu / desktop / Appx / registry detection
  src/launcher.ts                         id-only launch, root allowlist, shell elevation
  src/windows.ts                          window snapshot + minimize/restore
  src/scripts.ts                          PowerShell wrappers (paths resolved, never URL.pathname)
  powershell/                             windows.ps1, launch.ps1, scanner scripts, MantleWin.Windows.dll cache
lively/                 LivelyInfo.json + thumbnail
scripts/                install-lively.ps1, install-autostart.ps1, uninstall-autostart.ps1
tools/                  Playwright check/screenshot scripts
```
