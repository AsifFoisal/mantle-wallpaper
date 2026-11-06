import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDragScroll } from "../../hooks/useDragScroll";
import { Check, Copy, Eye, EyeOff, FolderOpen, RefreshCw, Search, Star, ArrowUpDown } from "lucide-react";
import { useStore } from "../../state/store";
import { useViewportSize, resolvePosition } from "../../hooks/useAppIndex";
import { usePanelDrag } from "../floating/usePanelDrag";
import { DragGrip } from "../floating/DragGrip";
import { collectSnapTargets, computeSnap } from "../../lib/positioning";
import { PositionMenu } from "../floating/PositionMenu";
import { GLASS_CLASS } from "../floating/FloatingWindow";
import { CategoryGlyph } from "../ui/CategoryGlyph";
import { AppIcon } from "../ui/AppIcon";
import { mantleApi } from "../../api/mantle";
import { launchApp } from "../../lib/launch";
import { HIDDEN_SENTINEL } from "../../lib/apps";

export type SettingsSection = "general" | "categories" | "applications" | "dock" | "layout" | "appearance" | "performance" | "about";

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "categories", label: "Categories" },
  { id: "applications", label: "Applications" },
  { id: "dock", label: "Dock" },
  { id: "layout", label: "Layout" },
  { id: "appearance", label: "Appearance" },
  { id: "performance", label: "Performance" },
  { id: "about", label: "About" },
];

export function SettingsWindow({ section, onSection }: { section: SettingsSection; onSection: (s: SettingsSection) => void }) {
  const panel = useStore((s) => s.persist.settingsPanel);
  const setPos = useStore((s) => s.setSettingsPanelPos);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const viewport = useViewportSize();
  const ref = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  useDragScroll(contentRef);

  const [posMenu, setPosMenu] = useState<{ x: number; y: number } | null>(null);
  usePanelDrag(headerRef, {
    getPanel: () => ref.current,
    onEnd: (x, y) => setPos(x, y),
    snap: (x, y, w, h) => computeSnap(x, y, w, h, viewport.w, viewport.h, collectSnapTargets(ref.current)),
  });

  const width = Math.min(760, viewport.w - 48);
  const height = Math.min(560, viewport.h - 96);
  const pos = resolvePosition({ x: Math.round((viewport.w - width) / 2), y: Math.max(64, Math.round((viewport.h - height) / 2) - 20) }, width, height, viewport);
  const final = panel.x >= 0 ? { x: panel.x, y: panel.y } : pos;
  const clamped = resolvePosition(final, width, height, viewport);

  return (
    <div
      ref={ref}
      data-floating-root="settings"
      className={`fixed z-40 flex animate-panel flex-col overflow-hidden rounded-[22px] ${GLASS_CLASS}`}
      style={{ left: clamped.x, top: clamped.y, width, height }}
    >
      <div ref={headerRef} className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-3.5" style={{ touchAction: "none", cursor: "auto" }}>
        <DragGrip
          className="size-7 text-mist-500"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPosMenu({ x: e.clientX, y: e.clientY });
          }}
        />
        <div className="flex size-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
          <span className="font-serif text-[16px] italic leading-none text-champagne-300">n</span>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-medium text-mist-100">Mantle</span>
            <span className="text-[10.5px] uppercase tracking-[0.2em] text-mist-600">Organizer</span>
          </div>
        </div>
        <ConnectionPill />
        <button
          onClick={() => setSettingsOpen(false)}
          aria-label="Close settings"
          className="grid size-7 place-items-center rounded-lg text-mist-600 transition-colors hover:bg-white/[0.07] hover:text-mist-300"
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      </div>
      <div className="h-px bg-white/[0.06]" />
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[156px] shrink-0 flex-col gap-0.5 border-r border-white/[0.05] p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              className={`rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                section === s.id ? "bg-white/[0.075] text-mist-100" : "text-mist-500 hover:bg-white/[0.04] hover:text-mist-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div ref={contentRef} className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
          {section === "general" && <GeneralSection />}
          {section === "categories" && <CategoriesSection />}
          {section === "applications" && <ApplicationsSection />}
          {section === "dock" && <DockSection />}
          {section === "layout" && <LayoutSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "performance" && <PerformanceSection />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
      {posMenu && createPortal(
        <PositionMenu target={{ kind: "settings" }} x={posMenu.x} y={posMenu.y} onClose={() => setPosMenu(null)} />,
        document.body,
      )}
    </div>
  );
}

function ConnectionPill() {
  const online = useStore((s) => s.backend === "online");
  const scan = useStore((s) => s.scan);
  const label = online ? (scan.scanning ? "Scanning" : `${scan.appCount} apps`) : "Offline";
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/20 px-2 py-0.5 text-[10px] text-mist-500">
      <span className={`size-1.5 rounded-full ${online ? "bg-emerald-400/80" : "bg-amber-400/90"}`} />
      {label}
    </span>
  );
}

// ───────────────────────── Sections ─────────────────────────

import { Toggle, Slider, Segmented, TextInput, Button, Field } from "../ui/Controls";

function GeneralSection() {
  const settings = useStore((s) => s.persist.settings);
  const update = useStore((s) => s.updateSettings);
  return (
    <div>
      <Field label="Display name" hint="Shown in the clock greeting.">
        <TextInput value={settings.username} onChange={(v) => update({ username: v })} placeholder="Your name" maxLength={32} />
      </Field>
      <Field label="Clock format" inline>
        <Segmented
          value={settings.clockFormat}
          options={[
            { value: "12h", label: "12-hour" },
            { value: "24h", label: "24-hour" },
          ]}
          onChange={(v) => update({ clockFormat: v })}
        />
      </Field>
      <Field label="Date format" inline>
        <Segmented
          value={settings.dateFormat}
          options={[
            { value: "long", label: "Thursday, June 4" },
            { value: "short", label: "Thu, Jun 4" },
            { value: "numeric", label: "2026-06-04" },
          ]}
          onChange={(v) => update({ dateFormat: v })}
        />
      </Field>
      <Field label="Show clock" inline>
        <Toggle checked={settings.showClock} onChange={(v) => update({ showClock: v })} label="Show clock" />
      </Field>
      <Field label="Show date" inline>
        <Toggle checked={settings.showDate} onChange={(v) => update({ showDate: v })} label="Show date" />
      </Field>
      <Field label="Greeting line" inline>
        <Toggle checked={settings.clockGreeting} onChange={(v) => update({ clockGreeting: v })} label="Greeting" />
      </Field>
      <Field label="Settings button" inline hint="Visible, or revealed on hover only.">
        <div className="flex items-center gap-3">
          <Segmented
            value={settings.floatingButton.hoverOnly ? "hover" : "always"}
            options={[
              { value: "always", label: "Always" },
              { value: "hover", label: "On hover" },
            ]}
            onChange={(v) => useStore.getState().updateFloatingButton({ hoverOnly: v === "hover" })}
          />
          <Toggle
            checked={settings.floatingButton.visible}
            onChange={(v) => useStore.getState().updateFloatingButton({ visible: v })}
            label="Show settings button"
          />
        </div>
      </Field>
      <Field label="Lock settings button" inline>
        <Toggle
          checked={settings.floatingButton.locked}
          onChange={(v) => useStore.getState().updateFloatingButton({ locked: v })}
          label="Lock settings button"
        />
      </Field>
      <Field label="Startup" hint="Mantle opens with everything closed and only the clock, dock and settings button visible.">
        <div className="text-[11.5px] leading-relaxed text-mist-500">
          Your arrangement is restored exactly as you left it. Companion autostart is managed with{" "}
          <code className="rounded bg-black/30 px-1 py-0.5 text-[10.5px] text-mist-400">npm run install:autostart</code>.
        </div>
      </Field>
    </div>
  );
}

function CategoriesSection() {
  const categories = useStore((s) => s.persist.categories);
  const panels = useStore((s) => s.persist.panels);
  const addCategory = useStore((s) => s.addCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const reorder = useStore((s) => s.reorderCategories);
  const openCategory = useStore((s) => s.openCategory);
  const updatePanel = useStore((s) => s.updatePanel);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  const move = (id: string, dir: -1 | 1) => {
    const ids = sorted.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  };

  return (
    <div>
      <div className="flex gap-2">
        <TextInput value={name} onChange={setName} placeholder="New collection name" onEnter={() => { if (name.trim()) { addCategory(name); setName(""); } }} />
        <Button variant="accent" onClick={() => { if (name.trim()) { addCategory(name); setName(""); } }}>Add</Button>
      </div>

      <div className="mt-4 space-y-1">
        {sorted.map((cat) => {
          const panel = panels[cat.id];
          const isEditing = editing === cat.id;
          return (
            <div key={cat.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <button
                  className="grid size-7 place-items-center rounded-lg"
                  style={{ color: cat.color, background: `color-mix(in oklab, ${cat.color} 12%, transparent)` }}
                  title="Open panel"
                  onClick={() => openCategory(cat.id)}
                >
                  <CategoryGlyph icon={cat.icon} size={13} />
                </button>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <CategoryEditor cat={cat} onDone={() => setEditing(null)} />
                  ) : (
                    <button className="truncate text-left text-[12.5px] text-mist-200 hover:text-mist-100" onClick={() => setEditing(cat.id)}>
                      {cat.name}
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1 text-[10px] text-mist-600" title="Show this collection">
                  <Toggle
                    checked={Boolean(panel?.open)}
                    onChange={(v) => updatePanel(cat.id, { open: v, minimized: false })}
                    label={`Show ${cat.name}`}
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-mist-600" title="Lock position">
                  <Toggle
                    checked={Boolean(panel?.locked)}
                    onChange={(v) => updatePanel(cat.id, { locked: v })}
                    label={`Lock ${cat.name}`}
                  />
                </label>
                <div className="flex flex-col">
                  <button onClick={() => move(cat.id, -1)} className="text-mist-600 hover:text-mist-300" aria-label="Move up">▲</button>
                  <button onClick={() => move(cat.id, 1)} className="text-mist-600 hover:text-mist-300" aria-label="Move down">▼</button>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete “${cat.name}”? Applications stay in the organizer; only the collection is removed.`)) deleteCategory(cat.id);
                  }}
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-mist-600 hover:bg-red-500/10 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {categories.length === 0 && <div className="py-8 text-center text-[12px] text-mist-600">No collections. Add one above.</div>}
    </div>
  );
}

import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS } from "../../state/defaults";
import type { Category, CategoryIcon } from "../../types";

function CategoryEditor({ cat, onDone }: { cat: Category; onDone: () => void }) {
  const updateCategory = useStore((s) => s.updateCategory);
  const [name, setName] = useState(cat.name);
  return (
    <div className="py-1">
      <div className="flex gap-1.5">
        <TextInput value={name} onChange={setName} onEnter={() => { updateCategory(cat.id, { name: name.trim() || cat.name }); onDone(); }} autoFocus />
        <Button size="sm" variant="solid" onClick={() => { updateCategory(cat.id, { name: name.trim() || cat.name }); onDone(); }}>Save</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {CATEGORY_ICON_OPTIONS.map((icon) => (
          <button
            key={icon}
            onClick={() => updateCategory(cat.id, { icon: icon as CategoryIcon })}
            className={`grid size-6 place-items-center rounded-md ${cat.icon === icon ? "bg-white/[0.12] text-mist-100" : "text-mist-500 hover:bg-white/[0.06]"}`}
            aria-label={icon}
          >
            <CategoryGlyph icon={icon} size={12} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {CATEGORY_COLOR_OPTIONS.map((color) => (
          <button
            key={color}
            onClick={() => updateCategory(cat.id, { color })}
            className={`size-4 rounded-full ${cat.color === color ? "ring-2 ring-white/70 ring-offset-2 ring-offset-ink-900" : ""}`}
            style={{ background: color }}
            aria-label={`Colour ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

function ApplicationsSection() {
  const listRef = useRef<HTMLDivElement | null>(null);
  useDragScroll(listRef);
  const apps = useStore((s) => s.apps);
  const overrides = useStore((s) => s.persist.appOverrides);
  const categories = useStore((s) => s.persist.categories);
  const scan = useStore((s) => s.scan);
  const online = useStore((s) => s.backend === "online");
  const setOverride = useStore((s) => s.setOverride);
  const toggleDock = useStore((s) => s.toggleDock);
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [sort, setSort] = useState<"name" | "recent" | "source">("name");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = apps
      .filter((a) => {
        const o = overrides[a.id];
        const hidden = o?.displayName === HIDDEN_SENTINEL;
        if (hidden !== showHidden) return false;
        const name = o?.displayName ?? a.displayName ?? a.name;
        return !q || name.toLowerCase().includes(q) || (a.executablePath ?? "").toLowerCase().includes(q);
      })
      .map((a) => ({
        app: a,
        name: overrides[a.id]?.displayName && overrides[a.id]?.displayName !== HIDDEN_SENTINEL ? overrides[a.id].displayName! : a.displayName || a.name,
      }));
    list.sort((x, y) => {
      if (sort === "name") return x.name.localeCompare(y.name);
      if (sort === "recent") return x.app.dateDetected < y.app.dateDetected ? 1 : -1;
      return x.app.source.localeCompare(y.app.source) || x.name.localeCompare(y.name);
    });
    return list;
  }, [apps, overrides, query, showHidden, sort]);

  const hiddenCount = useMemo(
    () => Object.values(overrides).filter((o) => o.displayName === HIDDEN_SENTINEL).length,
    [overrides],
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button
          variant="accent"
          disabled={!online || scan.scanning}
          onClick={async () => {
            try {
              await mantleApi.scan();
              useStore.getState().setScan({ scanning: true, phase: "Starting…", progress: 0 });
            } catch {
              useStore.getState().toast({ title: "Scan unavailable", detail: "Companion is offline.", tone: "warn" });
            }
          }}
        >
          <span className="flex items-center gap-1.5">
            <RefreshCw size={12} className={scan.scanning ? "animate-spin" : ""} />
            {scan.scanning ? scan.phase ?? "Scanning…" : "Rescan applications"}
          </span>
        </Button>
        <span className="text-[11px] text-mist-600">
          {scan.lastScanAt ? `Last scan ${new Date(scan.lastScanAt).toLocaleString()}` : "Never scanned"}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${showHidden ? "hidden" : "detected"} applications`}
            className="w-full rounded-lg border border-white/[0.08] bg-black/25 py-1.5 pl-7 pr-2 text-[12px] text-mist-100 placeholder:text-mist-600 focus:border-champagne-400/40 focus:outline-none"
          />
        </div>
        <Button size="sm" onClick={() => setSort(sort === "name" ? "recent" : sort === "recent" ? "source" : "name")}>
          <span className="flex items-center gap-1"><ArrowUpDown size={11} /> {sort}</span>
        </Button>
        <Button size="sm" variant={showHidden ? "solid" : "ghost"} onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? <EyeOff size={11} /> : <Eye size={11} />} Hidden {hiddenCount || ""}
        </Button>
      </div>

      <div ref={listRef} className="mt-3 max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.05]">
        {rows.length === 0 && (
          <div className="grid place-items-center py-10 text-[12px] text-mist-600">
            {online ? "No applications match." : "Companion offline — detected apps unavailable."}
          </div>
        )}
        {rows.map(({ app, name }) => {
          const o = overrides[app.id];
          return (
            <div key={app.id} className="group flex items-center gap-2.5 border-b border-white/[0.04] px-3 py-1.5 last:border-0 hover:bg-white/[0.025]">
              <AppIcon view={{ app, name, categories: o?.categories ?? [], isFavorite: Boolean(o?.isFavorite), inDock: false, iconDataUrl: o?.iconDataUrl ?? null, broken: !app.targetExists, orderOf: () => undefined }} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-mist-200">{name}</div>
                <div className="truncate text-[9.5px] uppercase tracking-[0.12em] text-mist-600">
                  {app.source} {app.executableName ? `· ${app.executableName}` : ""} {!app.targetExists ? "· missing" : ""}
                </div>
              </div>
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const cats = new Set(o?.categories ?? []);
                  if (cats.has(id)) cats.delete(id);
                  else cats.add(id);
                  setOverride(app.id, { categories: [...cats], categoriesManual: true });
                  e.target.value = "";
                }}
                className="w-24 rounded-md border border-white/[0.07] bg-ink-850 px-1 py-0.5 text-[10.5px] text-mist-400 focus:outline-none"
                aria-label="Toggle category"
              >
                <option value="">{o?.categories?.length ? `${o.categories.length} collection${o.categories.length > 1 ? "s" : ""}` : "Collections"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{(o?.categories ?? []).includes(c.id) ? "✓ " : "+ "}{c.name}</option>
                ))}
              </select>
              <button
                title={o?.isFavorite ? "Remove favorite" : "Add favorite"}
                onClick={() => useStore.getState().toggleFavorite(app.id)}
                className={`grid size-6 place-items-center rounded-md transition-colors hover:bg-white/[0.07] ${o?.isFavorite ? "text-champagne-300" : "text-mist-600"}`}
              >
                <Star size={11} fill={o?.isFavorite ? "currentColor" : "none"} />
              </button>
              <button
                title="Toggle dock"
                onClick={() => toggleDock(app.id)}
                className="grid size-6 place-items-center rounded-md text-mist-600 transition-colors hover:bg-white/[0.07] hover:text-mist-300"
              >
                <Copy size={11} />
              </button>
              <button
                title={showHidden ? "Restore" : "Hide"}
                onClick={() => setOverride(app.id, { displayName: showHidden ? undefined : HIDDEN_SENTINEL })}
                className="grid size-6 place-items-center rounded-md text-mist-600 transition-colors hover:bg-white/[0.07] hover:text-mist-300"
              >
                {showHidden ? <Check size={11} /> : <EyeOff size={11} />}
              </button>
              <button
                title="Launch"
                onClick={() => void launchApp({ app, name, categories: [], isFavorite: false, inDock: false, iconDataUrl: null, broken: !app.targetExists, orderOf: () => undefined }, app.id)}
                className="grid size-6 place-items-center rounded-md text-mist-600 transition-colors hover:bg-white/[0.07] hover:text-mist-300"
              >
                <FolderOpen size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DockSection() {
  const dock = useStore((s) => s.persist.dock);
  const update = useStore((s) => s.updateDock);
  return (
    <div>
      <Field label="Show dock" inline>
        <Toggle checked={dock.visible} onChange={(v) => update({ visible: v })} label="Show dock" />
      </Field>
      <Field label="Lock position" inline hint="Right-click the dock to toggle without opening settings.">
        <Toggle checked={dock.locked} onChange={(v) => update({ locked: v })} label="Lock dock" />
      </Field>
      <Field label="Orientation" inline>
        <Segmented
          value={dock.orientation}
          options={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
          ]}
          onChange={(v) => update({ orientation: v })}
        />
      </Field>
      <Field label="Icon size">
        <Slider value={dock.iconSize} min={32} max={72} step={2} onChange={(v) => update({ iconSize: v })} format={(v) => `${v}px`} />
      </Field>
      <Field label="Spacing">
        <Slider value={dock.gap} min={2} max={24} onChange={(v) => update({ gap: v })} format={(v) => `${v}px`} />
      </Field>
      <Field label="Labels" inline>
        <Toggle checked={dock.labels} onChange={(v) => update({ labels: v })} label="Dock labels" />
      </Field>
      <Field label="Hover magnification" inline>
        <Toggle checked={dock.magnification} onChange={(v) => update({ magnification: v })} label="Magnification" />
      </Field>
      <Field label="Position" hint="Drag the dock anywhere on screen. Restore snaps it back to the bottom centre.">
        <Button size="sm" onClick={() => update({ x: -1, y: -1, anchored: true })}>Restore default position</Button>
      </Field>
    </div>
  );
}

function LayoutSection() {
  const resetLayout = useStore((s) => s.resetLayout);
  const settings = useStore((s) => s.persist.settings);
  const update = useStore((s) => s.updateSettings);
  const updateFB = useStore((s) => s.updateFloatingButton);
  return (
    <div>
      <Field label="Lock clock position" inline>
        <Toggle checked={settings.clockLocked} onChange={(v) => update({ clockLocked: v })} label="Lock clock" />
      </Field>
      <Field label="Clock size">
        <Slider value={settings.clockSize} min={48} max={200} step={2} onChange={(v) => update({ clockSize: v })} format={(v) => `${v}px`} />
      </Field>
      <Field label="Lock settings button" inline>
        <Toggle checked={settings.floatingButton.locked} onChange={(v) => updateFB({ locked: v })} label="Lock settings button" />
      </Field>
      <Field label="Layout" hint="Positions of every floating element are saved automatically and restored after any restart.">
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm("Reset the positions and sizes of all floating elements?")) {
                resetLayout();
                useStore.getState().toast({ title: "Layout restored", tone: "success" });
              }
            }}
          >
            Restore default layout
          </Button>
          <Button
            onClick={() => {
              for (const c of useStore.getState().persist.categories) useStore.getState().updatePanel(c.id, { open: false });
              useStore.getState().setSettingsOpen(false);
              useStore.getState().toast({ title: "Back to the wallpaper", tone: "info" });
            }}
          >
            Close all panels
          </Button>
        </div>
      </Field>
    </div>
  );
}

function AppearanceSection() {
  const bg = useStore((s) => s.persist.settings.background);
  const settings = useStore((s) => s.persist.settings);
  const updateBg = useStore((s) => s.updateBackground);
  const update = useStore((s) => s.updateSettings);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      useStore.getState().toast({ title: "Image too large", detail: "Choose a file under 8 MB.", tone: "warn" });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      updateBg({ imageDataUrl: dataUrl, mode: "image" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Field label="Background" inline>
        <Segmented
          value={bg.mode}
          options={[
            { value: "ambient", label: "Nebula" },
            { value: "gradient", label: "Gradient" },
            { value: "image", label: "Image" },
          ]}
          onChange={(v) => updateBg({ mode: v })}
        />
      </Field>
      {bg.mode === "ambient" && (
        <Field label="Ambient intensity" hint="Controls nebula drift, glow and star density.">
          <Slider value={bg.ambientIntensity} min={0} max={100} onChange={(v) => updateBg({ ambientIntensity: v })} format={(v) => `${v}%`} />
        </Field>
      )}
      {bg.mode === "gradient" && (
        <>
          <Field label="Gradient">
            <div className="flex items-center gap-2">
              <input type="color" value={bg.gradientFrom} onChange={(e) => updateBg({ gradientFrom: e.target.value })} className="h-7 w-10 rounded border border-white/10 bg-transparent" />
              <input type="color" value={bg.gradientTo} onChange={(e) => updateBg({ gradientTo: e.target.value })} className="h-7 w-10 rounded border border-white/10 bg-transparent" />
              <Slider value={bg.gradientAngle} min={0} max={360} onChange={(v) => updateBg({ gradientAngle: v })} format={(v) => `${v}°`} />
            </div>
          </Field>
          <Field label="Fit" inline>
            <Segmented
              value={bg.imageFit}
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Contain" },
              ]}
              onChange={(v) => updateBg({ imageFit: v })}
            />
          </Field>
        </>
      )}
      {bg.mode === "image" && (
        <Field label="Image" hint="Stored locally in this browser, never uploaded.">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Loading…" : bg.imageDataUrl ? "Replace image" : "Choose image"}</Button>
            {bg.imageDataUrl && <Button size="sm" variant="danger" onClick={() => updateBg({ imageDataUrl: null, mode: "ambient" })}>Remove</Button>}
          </div>
          <div className="mt-2">
            <Segmented
              value={bg.imageFit}
              options={[
                { value: "cover", label: "Fill" },
                { value: "contain", label: "Fit" },
              ]}
              onChange={(v) => updateBg({ imageFit: v })}
            />
          </div>
        </Field>
      )}
      <Field label="Animations" inline hint="Nebula drift, twinkle and panel transitions.">
        <Toggle checked={settings.animationEnabled} onChange={(v) => update({ animationEnabled: v })} label="Animations" />
      </Field>
    </div>
  );
}

function PerformanceSection() {
  const settings = useStore((s) => s.persist.settings);
  const update = useStore((s) => s.updateSettings);
  const status = useStore((s) => s.backendVersion);
  return (
    <div>
      <Field label="Low-resource mode" inline hint="Stops the running-app poll and freezes ambient motion. Recommended on laptops on battery.">
        <Toggle checked={settings.lowResourceMode} onChange={(v) => update({ lowResourceMode: v })} label="Low-resource mode" />
      </Field>
      <Field label="Running-app indicators" inline hint="Periodically checks which dock apps are open (every 8 s).">
        <Toggle checked={settings.showRunningIndicator} onChange={(v) => update({ showRunningIndicator: v })} label="Running indicators" />
      </Field>
      <Field label="Animation" inline>
        <Toggle checked={settings.animationEnabled} onChange={(v) => update({ animationEnabled: v })} label="Animation" />
      </Field>
      <Field label="Ambient effects">
        <Slider value={settings.background.ambientIntensity} min={0} max={100} onChange={(v) => useStore.getState().updateBackground({ ambientIntensity: v })} format={(v) => `${v}%`} />
      </Field>
      <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2 text-[11px] text-mist-500">
        Companion {status ? `v${status}` : "not connected"}. Rendering uses CSS transforms only, and animations pause when the wallpaper is hidden.
      </div>
    </div>
  );
}

function AboutSection() {
  useEffect(() => {
    void mantleApi.status().catch(() => undefined);
  }, []);
  return (
    <div className="space-y-3 py-2">
      <div>
        <div className="font-serif text-[30px] italic leading-none text-mist-100">Mantle</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-mist-600">Interactive wallpaper · Organizer</div>
      </div>
      <p className="max-w-[420px] text-[12px] leading-relaxed text-mist-500">
        A quiet desktop that unfolds into an organizer. Everything lives locally: your layout in this browser, your applications via the companion service at
        127.0.0.1. Nothing leaves your machine.
      </p>
      <div className="flex flex-wrap gap-1.5 text-[10px] text-mist-600">
        {["Ctrl K search", "Right-click apps for options", "Drag anything to move", "Right-click dock to lock"].map((k) => (
          <kbd key={k} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">{k}</kbd>
        ))}
      </div>
      <div className="rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed text-mist-500">
        <span className="font-medium text-mist-300">Scrolling:</span> Lively never forwards mouse-wheel events to
        web wallpapers (upstream bug rocksdanister/lively#3042 — affects every web wallpaper). Press empty space inside a list and drag to
        scroll — a quick flick keeps gliding; middle-button drag pans even from over icons. The mouse wheel works
        normally when the wallpaper is open in a browser.
      </div>
    </div>
  );
}
