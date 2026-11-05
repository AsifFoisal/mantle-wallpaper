import { useMemo, useRef, useState } from "react";
import { Search, X, Folder, CornerDownLeft, LayoutGrid, Star, GripVertical } from "lucide-react";
import { useStore } from "../../state/store";
import { useViewportSize } from "../../hooks/useAppIndex";
import { usePanelDrag } from "../floating/usePanelDrag";
import { DragGrip } from "../floating/DragGrip";
import { GLASS_CLASS } from "../floating/FloatingWindow";
import { AppIcon } from "../ui/AppIcon";
import { CategoryGlyph } from "../ui/CategoryGlyph";
import { useAppIndex, resolvePosition } from "../../hooks/useAppIndex";
import { launchApp } from "../../lib/launch";
import { useKey } from "../../hooks/useKey";

type Row =
  | { kind: "app"; id: string; score: number }
  | { kind: "category"; id: string; score: number }
  | { kind: "action"; id: "favorites" | "organizer" };

function score(text: string, q: string) {
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const idx = t.indexOf(q);
  if (idx >= 0) return 60 - Math.min(30, idx);
  // token prefix match: "vs co" -> "Visual Studio Code"
  const words = t.split(/\s+/);
  if (q.split(/\s+/).every((part) => words.some((w) => w.startsWith(part)))) return 40;
  return 0;
}

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const categories = useStore((s) => s.persist.categories);
  const openCategory = useStore((s) => s.openCategory);
  const setSearchPanelPos = useStore((s) => s.setSearchPanelPos);
  const viewport = useViewportSize();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const assignTarget = useStore((s) => s.persist.categories.find((c) => c.id === s.assignTargetId));
  const endAssign = useStore((s) => s.endAssign);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const { visible } = useAppIndex();

  usePanelDrag(headerRef, {
    getPanel: () => boxRef.current,
    onEnd: (x, y) => setSearchPanelPos(x, y),
  });

  const q = query.trim().toLowerCase();

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    for (const view of visible) {
      const s = q
        ? Math.max(score(view.name, q), score(view.app.name, q), score(view.app.displayName, q), ...view.categories.map((c) => score(categories.find((x) => x.id === c)?.name ?? "", q) * 0.6))
        : 0;
      if (!q || s > 0) list.push({ kind: "app", id: view.app.id, score: s + (view.isFavorite ? 4 : 0) });
    }
    for (const cat of categories) {
      const s = q ? score(cat.name, q) : 0;
      if (q && s > 0) list.push({ kind: "category", id: cat.id, score: s + 2 });
    }
    if (!q) {
      list.unshift({ kind: "action", id: "organizer" });
      list.unshift({ kind: "action", id: "favorites" });
    }
    list.sort((a, b) => (a.kind === "action" && b.kind === "action" ? 0 : (b.kind === "action" ? -1 : a.kind === "action" ? 1 : b.score - a.score)));
    return list.slice(0, 40);
  }, [visible, categories, q]);

  const byId = useMemo(() => new Map(visible.map((v) => [v.app.id, v])), [visible]);
  const idx = Math.min(selected, Math.max(0, rows.length - 1));

  const w = Math.min(600, viewport.w - 48);
  const h = Math.min(540, viewport.h - 80);
  const pos = resolvePosition({ x: Math.round((viewport.w - w) / 2), y: Math.max(64, viewport.h * 0.2) }, w, h, viewport);

  const run = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === "app") {
      const v = byId.get(row.id);
      // Assigning mode: clicking a row adds it to the collection instead of launching.
      if (assignTarget) {
        const state = useStore.getState();
        state.assignCategory(row.id, assignTarget.id);
        state.toast({ title: `Added ${v?.name ?? "app"} to ${assignTarget.name}`, tone: "success" });
        setPicked((p) => [...new Set([...p, row.id])]);
        setQuery("");
        setSelected(0);
        inputRef.current?.focus();
        return;
      }
      if (v) void launchApp(v, v.app.id);
    } else if (row.kind === "category") {
      openCategory(row.id);
    } else {
      const store = useStore.getState();
      store.setSettingsOpen(true);
      window.dispatchEvent(new CustomEvent("mantle:settings-section", { detail: "applications" }));
    }
    onClose();
  };

  useKey("arrowdown", () => setSelected((s) => Math.min(rows.length - 1, s + 1)), { allowInInput: true });
  useKey("arrowup", () => setSelected((s) => Math.max(0, s - 1)), { allowInInput: true });
  useKey("enter", () => run(rows[idx]), { allowInInput: true });
  useKey("escape", onClose, { allowInInput: true });

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] animate-fade"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-search-box]")) return;
        onClose();
      }}
    >
      <div
        ref={boxRef}
        data-search-box
        className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-[22px] ${GLASS_CLASS}`}
        style={{ left: pos.x, top: pos.y, width: w, height: h }}
      >
        <div ref={headerRef} className="flex items-center gap-3 px-4 pb-3 pt-3.5" style={{ cursor: "auto" }}>
          <DragGrip className="size-7 text-mist-500" />
          <Search size={15} className="shrink-0 text-mist-500" strokeWidth={1.8} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            spellCheck={false}
            placeholder={assignTarget ? `Add apps to ${assignTarget.name}…` : "Search applications, categories…"}
            className="w-full bg-transparent text-[14px] text-mist-100 outline-none placeholder:text-mist-600"
            style={{ userSelect: "text" }}
          />
          {query ? (
            <button onClick={() => setQuery("")} className="text-mist-600 hover:text-mist-300" aria-label="Clear">
              <X size={14} />
            </button>
          ) : (
            <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-mist-600">Esc</kbd>
          )}
        </div>
        <div className="h-px bg-white/[0.06]" />
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <div className="grid place-items-center py-16 text-[12px] text-mist-600">Nothing matches “{query}”</div>
          )}
          {rows.map((row, i) => {
            const active = i === idx || hovered === `${row.kind}:${row.id}`;
            if (row.kind === "action") {
              const isFav = row.id === "favorites";
              return (
                <button
                  key={row.id}
                  onMouseEnter={() => setHovered(`${row.kind}:${row.id}`)}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => run(row)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? "bg-white/[0.075]" : ""}`}
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-white/[0.05] text-mist-400">
                    {isFav ? <Star size={13} /> : <LayoutGrid size={13} />}
                  </span>
                  <span className="flex-1 text-[12.5px] text-mist-200">{isFav ? "Open favorites" : "Open organizer"}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-mist-600">Settings</span>
                </button>
              );
            }
            if (row.kind === "category") {
              const cat = categories.find((c) => c.id === row.id)!;
              return (
                <button
                  key={`cat-${row.id}`}
                  onMouseEnter={() => setHovered(`${row.kind}:${row.id}`)}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => run(row)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? "bg-white/[0.075]" : ""}`}
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-white/[0.05]" style={{ color: cat.color }}>
                    <CategoryGlyph icon={cat.icon} size={13} />
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-mist-100">{cat.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-mist-600">Collection</span>
                </button>
              );
            }
            const view = byId.get(row.id)!;
            return (
              <button
                key={row.id}
                onMouseEnter={() => setHovered(`${row.kind}:${row.id}`)}
                onMouseMove={() => setSelected(i)}
                onClick={() => run(row)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors ${active ? "bg-white/[0.075]" : ""}`}
              >
                <AppIcon view={view} size={24} />
                <span className="flex-1 truncate text-[13px] font-medium text-mist-100">{view.name}</span>
                {view.isFavorite && <Star size={10} className="text-champagne-400/80" fill="currentColor" />}
                {active && <CornerDownLeft size={12} className="text-mist-500" />}
              </button>
            );
          })}
        </div>
        {assignTarget && (
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2">
            <span className="min-w-0 truncate text-[11px] text-mist-500">
              <span className="font-medium text-mist-300">{assignTarget.name}</span>
              {" · "}
              {picked.length ? `${picked.length} selected` : "click apps to add them"}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  endAssign();
                  onClose();
                }}
                className="rounded-lg px-2 py-1 text-[11px] text-mist-500 hover:text-mist-300"
              >
                Done
              </button>
            </span>
          </div>
        )}
        {!assignTarget && (
        <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-mist-600">
          <span className="flex items-center gap-1"><GripVertical size={10} /> drag to move</span>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="flex items-center gap-1"><Folder size={10} /> categories included</span>
        </div>
        )}
      </div>
    </div>
  );
}
