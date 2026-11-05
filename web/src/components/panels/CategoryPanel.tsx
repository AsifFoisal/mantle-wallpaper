import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../../state/store";
import { useViewportSize, useAppIndex } from "../../hooks/useAppIndex";
import { usePanelDrag } from "../floating/usePanelDrag";
import { GLASS_CLASS } from "../floating/FloatingWindow";
import { AppTile } from "./AppTile";
import { AppContextMenu } from "./AppContextMenu";
import { CategoryGlyph } from "../ui/CategoryGlyph";
import { launchApp, isRunning } from "../../lib/launch";
import { isAppDrag, APP_MIME } from "../../lib/dnd";
import { Lock, Minus, Maximize2, X, Search, FolderPlus, Plus } from "lucide-react";
import { DragGrip } from "../floating/DragGrip";
import { defaultPanelGeometry } from "../../state/defaults";
import { pushFor, useExpandedBounds, useExpandedPanels } from "../../state/layout";
import type { Category, PanelGeometry } from "../../types";
import { resolvePosition } from "../../hooks/useAppIndex";
import { reorderGroup, type AppView } from "../../lib/apps";

interface Props {
  category: Category;
  geometry: PanelGeometry | undefined;
  onAddApps: (categoryId: string) => void;
}

/** One floating category panel. Positions and sizes persist per category. */
export function CategoryPanel({ category, geometry: stored, onAddApps }: Props) {
  // A freshly added collection may not have geometry yet; default to closed.
  const geometry: PanelGeometry = stored ?? defaultPanelGeometry(0, 0);
  const updatePanel = useStore((s) => s.updatePanel);
  const closeCategory = useStore((s) => s.closeCategory);
  const assignCategory = useStore((s) => s.assignCategory);
  const unassignCategory = useStore((s) => s.unassignCategory);
  const toggleDock = useStore((s) => s.toggleDock);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const setCategoryOrder = useStore((s) => s.setCategoryOrder);
  const running = useStore((s) => s.runningNames);
  const appTotal = useStore((s) => s.apps.length);
  const categories = useStore((s) => s.persist.categories);
  const scan = useStore((s) => s.scan);
  const viewport = useViewportSize();
  const { byId, visible } = useAppIndex();
  const ref = useRef<HTMLDivElement | null>(null);
  // The slot is the drag panel: React positions it in viewport coords, so the
  // hook's style writes and re-renders agree (the inner root only fills it).
  const slotRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState<"none" | "ok">("none");
  const [dropHint, setDropHint] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // Multi-select: a Set of app ids inside this collection.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectionMode = selected.size > 0;
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelect = useCallback(() => setSelected(new Set()), []);
  // Hovering a collapsed title bar peeks the collection open without committing.
  const [peek, setPeek] = useState(false);
  const closePeek = useRef<number | null>(null);
  // Peeking is only meaningful while minimized; it never resizes a normal panel.
  // Nudge lives on a wrapper so the collapse/push transitions don't fight.
  const collapsed = geometry.minimized && !peek;
  const open = geometry.open;
  const displayW = collapsed ? Math.min(geometry.w, 300) : geometry.w;
  const displayH = collapsed ? 58 : geometry.h;
  // Clamp against what is actually on screen now; bottom-left keeps the
  // viewport's own margin so a panel near the edge is not nudged on reload.
  const base = resolvePosition({ x: geometry.x, y: geometry.y }, displayW, displayH, viewport);
  useExpandedBounds(category.id, { ...base, w: displayW, h: displayH }, open && !collapsed);

  const expandedPanels = useExpandedPanels();
  const push = pushFor({ x: base.x, y: base.y, w: displayW, h: displayH }, expandedPanels, category.id);


  const bodyHidden = geometry.minimized && !peek;

  const hoverOpen = useCallback(() => {
    if (closePeek.current) window.clearTimeout(closePeek.current);
    if (geometry.minimized) setPeek(true);
  }, [geometry.minimized]);
  // Peeking can briefly move the panel edge under the cursor, so collapsing
  // waits a moment and is cancelled if the pointer comes back.
  const hoverClose = useCallback(() => {
    if (closePeek.current) window.clearTimeout(closePeek.current);
    closePeek.current = window.setTimeout(() => setPeek(false), 260);
  }, []);
  useEffect(() => () => {
    if (closePeek.current) window.clearTimeout(closePeek.current);
  }, []);

  usePanelDrag(slotRef, {
    getPanel: () => slotRef.current,
    onEnd: (x, y) => updatePanel(category.id, { x, y }),
    disabled: geometry.locked,
  });

  const apps = useMemo<AppView[]>(
    () =>
      visible
        .filter((v) => v.categories.includes(category.id))
        .sort((a, b) => {
          // Manual arrangement wins; apps without a rank follow alphabetically.
          const ra = a.orderOf(category.id);
          const rb = b.orderOf(category.id);
          if (ra !== undefined && rb !== undefined) return ra - rb;
          if (ra !== undefined) return -1;
          if (rb !== undefined) return 1;
          return a.name.localeCompare(b.name);
        }),
    [visible, category.id],
  );

  const selectAll = useCallback(() => setSelected(new Set(apps.map((a) => a.app.id))), [apps]);

  /** Reorder within this collection: reorder the selection, or a single dragged app. */
  const applyReorder = useCallback(
    (movingIds: string[], targetId: string, position: "before" | "after") => {
      if (!movingIds.length || movingIds.includes(targetId)) return;
      const order = reorderGroup(
        apps.map((a) => a.app.id),
        movingIds,
        targetId,
        position,
      );
      // Stores explicit ranks so the arrangement survives reloads and rescans.
      setCategoryOrder(category.id, order);
      clearSelect();
    },
    [apps, category.id, setCategoryOrder, clearSelect],
  );

  // Simple masonry-ish column count from panel width.
  const columns = Math.max(1, Math.floor((geometry.w - 24) / 92));

  const bulkRemove = () => {
    for (const id of selected) unassignCategory(id, category.id);
    clearSelect();
  };
  const bulkDock = () => {
    const dockIds = useStore.getState().persist.dock.appIds;
    for (const id of selected) if (!dockIds.includes(id)) toggleDock(id);
    clearSelect();
  };
  const bulkFavorite = () => {
    const overrides = useStore.getState().persist.appOverrides;
    for (const id of selected) if (!overrides[id]?.isFavorite) toggleFavorite(id);
    clearSelect();
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver("none");
      const id = e.dataTransfer.getData(APP_MIME);
      if (id) assignCategory(id, category.id);
    },
    [assignCategory, category.id],
  );


  return (
    // Wrapper owns only the sideways nudge, so its transform never fights the
    // panel's own width/height transitions.
    <div
      ref={slotRef}
      data-floating-slot={`panel-${category.id}`}
      data-floating-locked={geometry.locked ? "true" : "false"}
      data-nudge={push || undefined}
      style={{
        position: "absolute",
        left: base.x,
        top: base.y,
        width: displayW,
        height: displayH,
        transform: push ? `translateX(${push}px)` : undefined,
        transition: "transform 340ms cubic-bezier(0.22, 0.9, 0.28, 1)",
        zIndex: 20,
        display: open ? "block" : "none",
        pointerEvents: "none",
      }}
    >
    <div
      ref={ref}
      data-floating-root={`panel-${category.id}`}
      data-floating-locked={geometry.locked ? "true" : "false"}
      data-panel-open={open ? "true" : "false"}
      aria-hidden={!open}
      inert={!open}
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-[20px] ${GLASS_CLASS} ${
        open ? "pointer-events-auto animate-panel" : "pointer-events-none"
      }`}
      style={{
        width: bodyHidden ? Math.min(geometry.w, 300) : geometry.w,
        height: bodyHidden ? undefined : geometry.h,
        display: open ? "flex" : "none",
        outline: dragOver === "ok" ? `1px solid color-mix(in oklab, ${category.color} 60%, transparent)` : undefined,
        outlineOffset: 2,
      }}
      onPointerEnter={open ? hoverOpen : undefined}
      onPointerMove={open ? hoverOpen : undefined}
      onPointerLeave={open ? hoverClose : undefined}
      onDragOver={(e) => {
        if (!isAppDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropHint(null);
        setDragOver("ok");
      }}
      onDragLeave={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver("none");
      }}
      onDrop={onDrop}
    >
      <div
        ref={headerRef}
        className="flex shrink-0 items-center gap-2.5 px-3.5 pb-2.5 pt-3"
        style={{ touchAction: "none", cursor: geometry.locked ? "default" : "auto" }}
      >
        <DragGrip locked={geometry.locked} className="size-7 text-mist-500" />
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg border"
          style={{
            color: category.color,
            borderColor: `color-mix(in oklab, ${category.color} 26%, transparent)`,
            background: `color-mix(in oklab, ${category.color} 12%, transparent)`,
          }}
        >
          <CategoryGlyph icon={category.icon} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-white">{category.name}</span>
            <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-medium tabular-nums text-mist-300">{apps.length || ""}</span>
          </div>
          {category.accentTagline && (
            <div className="text-[9px] uppercase tracking-[0.26em] text-mist-500">{category.accentTagline}</div>
          )}
        </div>
        {geometry.locked && <Lock size={11} className="shrink-0 text-mist-600" />}
        <div className="flex shrink-0 items-center gap-0.5" style={{ cursor: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
          <HeaderBtn label="Search in collection" onClick={() => onAddApps(category.id)}>
            <Search size={13} />
          </HeaderBtn>
          <HeaderBtn
            label={geometry.minimized ? "Restore" : "Minimize"}
            onClick={() => updatePanel(category.id, { minimized: !geometry.minimized })}
          >
            {geometry.minimized ? <Maximize2 size={13} /> : <Minus size={13} />}
          </HeaderBtn>
          <HeaderBtn label="Close" danger onClick={() => closeCategory(category.id)}>
            <X size={13} />
          </HeaderBtn>
        </div>
      </div>
      <div className="mx-3.5 h-px shrink-0 bg-white/[0.055]" />

      <div
        data-panel-body
        className="flex min-h-0 flex-col overflow-hidden"
        style={{
          // Collapse to the header line with a smooth height + fade.
          flex: bodyHidden ? "0 0 0px" : "1 1 0px",
          opacity: bodyHidden ? 0 : 1,
          transform: bodyHidden ? "translateY(-4px)" : "none",
          pointerEvents: bodyHidden ? "none" : "auto",
          transition: "flex-basis 340ms cubic-bezier(0.22, 0.9, 0.28, 1), opacity 240ms ease 60ms, transform 340ms cubic-bezier(0.22, 0.9, 0.28, 1)",
        }}
        aria-hidden={bodyHidden}
        inert={bodyHidden ? true : undefined}
      >
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" onPointerDown={(e) => e.target === e.currentTarget && clearSelect()}>
            {apps.length === 0 ? (
              <EmptyState
                category={category}
                scan={scan}
                count={appTotal}
                onAdd={() => onAddApps(category.id)}
              />
            ) : (
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {apps.map((v) => (
                  <AppTile
                    key={v.app.id}
                    view={v}
                    size={44}
                    selected={selected.has(v.app.id)}
                    running={isRunning(v, running)}
                    onLaunch={() => void launchApp(v, v.app.id)}
                    onSelect={() => toggleSelect(v.app.id)}
                    onContextMenu={(e) => setMenu({ id: v.app.id, x: e.clientX, y: e.clientY })}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(APP_MIME, v.app.id);
                      e.dataTransfer.effectAllowed = "copyMove";
                    }}
                    onDragOver={(e, position) => {
                      if (!isAppDrag(e)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      setDropHint({ id: v.app.id, position });
                    }}
                    onDragLeave={() => setDropHint((h) => (h?.id === v.app.id ? null : h))}
                    onDrop={(e, position) => {
                      const moving = e.dataTransfer.getData(APP_MIME);
                      if (!moving) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setDropHint(null);
                      setDragOver("none");
                      // A selected app drags the whole selection; drag any other app to move just it.
                      const ids = selected.has(moving)
                        ? apps.filter((a) => selected.has(a.app.id)).map((a) => a.app.id)
                        : [moving];
                      applyReorder(ids, v.app.id, position);
                    }}
                    onDragEnd={() => setDropHint(null)}
                    dropIndicator={dropHint?.id === v.app.id ? dropHint.position : null}
                  />
                ))}
                <button
                  onClick={() => onAddApps(category.id)}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-1.5 pb-1.5 pt-2 text-mist-600 transition-colors hover:bg-white/[0.04] hover:text-mist-300"
                  title="Add applications to this collection"
                >
                  <span className="grid size-11 place-items-center rounded-xl border border-dashed border-white/12">
                    <FolderPlus size={16} strokeWidth={1.6} />
                  </span>
                  <span className="text-[11px] font-medium">Add</span>
                </button>
              </div>
            )}
          </div>

          {selectionMode && (
            <div className="flex shrink-0 items-center gap-1.5 border-t border-white/[0.05] px-2 py-1.5 text-[10px] uppercase tracking-[0.14em]">
              <span className="mr-0.5 rounded-full bg-champagne-400/90 px-1.5 py-0.5 font-semibold tabular-nums text-ink-950">
                {selected.size}
              </span>
              <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-mist-300 hover:bg-white/[0.07] hover:text-white" onClick={bulkRemove}>
                <X size={10} /> remove
              </button>
              <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-mist-300 hover:bg-white/[0.07] hover:text-white" onClick={bulkDock}>
                <Plus size={10} /> dock
              </button>
              <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-mist-300 hover:bg-white/[0.07] hover:text-white" onClick={bulkFavorite}>
                <Plus size={10} /> favorite
              </button>
              <span className="ml-auto flex items-center gap-1.5">
                <button className="rounded-md px-1.5 py-1 text-mist-500 hover:bg-white/[0.07] hover:text-mist-200" onClick={selected.size === apps.length ? clearSelect : selectAll}>
                  {selected.size === apps.length ? "none" : "all"}
                </button>
                <button className="rounded-md px-1.5 py-1 text-mist-500 hover:bg-white/[0.07] hover:text-mist-200" onClick={clearSelect} title="Clear selection">
                  <X size={11} />
                </button>
              </span>
            </div>
          )}

          <div
            role="separator"
            aria-label="Resize panel"
            className="absolute bottom-0 right-0 z-10 size-4 cursor-nwse-resize"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              if (geometry.locked) return;
              e.stopPropagation();
              const start = { x: e.clientX, y: e.clientY, w: geometry.w, h: geometry.h };
              const el = e.currentTarget as HTMLElement;
              el.setPointerCapture(e.pointerId);
              el.onpointermove = (ev) => {
                const w = Math.max(300, Math.round(start.w + ev.clientX - start.x));
                const h = Math.max(200, Math.round(start.h + ev.clientY - start.y));
                updatePanel(category.id, { w, h });
              };
              el.onpointerup = () => {
                el.onpointermove = null;
                el.onpointerup = null;
              };
            }}
          />
      </div>

    </div>
    {menu && byId.get(menu.id) && createPortal(
      <AppContextMenu x={menu.x} y={menu.y} view={byId.get(menu.id)!} categories={categories} onClose={() => setMenu(null)} />,
      document.body,
    )}
    </div>
  );
}

function HeaderBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`grid size-6 place-items-center rounded-md text-mist-600 transition-colors ${
        danger ? "hover:bg-red-500/15 hover:text-red-300" : "hover:bg-white/[0.07] hover:text-mist-300"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  category,
  scan,
  count,
  onAdd,
}: {
  category: Category;
  scan: { scanning: boolean; phase: string | null };
  count: number;
  onAdd: () => void;
}) {
  const offline = useStore((s) => s.backend === "offline");
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2.5 px-6 text-center">
      <span className="grid size-11 place-items-center rounded-2xl" style={{ color: category.color, background: `color-mix(in oklab, ${category.color} 12%, transparent)` }}>
        <CategoryGlyph icon={category.icon} size={20} />
      </span>
      <div className="text-[12.5px] text-mist-300">Nothing in {category.name} yet</div>
      <div className="max-w-[240px] text-[11px] leading-relaxed text-mist-600">
        {offline
          ? "The desktop bridge is offline, so applications can't be listed. Start the Mantle companion service to scan."
          : scan.scanning
            ? `Scanning your Start menu… ${scan.phase ?? ""}`
            : count === 0
              ? "No applications detected yet. Run a scan from settings → Applications."
              : "Drag any app here, or add them from the organizer."}
      </div>
      <button
        onClick={onAdd}
        className="mt-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] text-mist-300 transition-colors hover:bg-white/[0.09]"
      >
        <Plus size={11} /> Add applications
      </button>
    </div>
  );
}
