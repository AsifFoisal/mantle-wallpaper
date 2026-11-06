import { useEffect, useState } from "react";
import { useStore } from "../../state/store";
import { useViewportSize } from "../../hooks/useAppIndex";
import { FloatingMenu, MenuLabel, MenuSeparator, MenuItem } from "../ui/FloatingMenu";
import { Check, Square, Group, Ungroup, Plus, X } from "lucide-react";
import { PRESETS, presetPosition, boundingBox, type PresetId } from "../../lib/positioning";

export type PositionTarget =
  | { kind: "panel"; categoryId: string }
  | { kind: "dock" }
  | { kind: "clock" }
  | { kind: "orb" }
  | { kind: "settings" }
  | { kind: "search" };

/** DOM lookup for the element a PositionTarget refers to. */
function targetElement(target: PositionTarget): HTMLElement | null {
  switch (target.kind) {
    case "panel":
      return document.querySelector<HTMLElement>(`[data-floating-slot='panel-${target.categoryId}']`);
    case "dock":
      return document.querySelector<HTMLElement>("[data-floating-root='dock']");
    case "clock":
      return document.querySelector<HTMLElement>("[data-floating-root='clock']");
    case "orb":
      return document.querySelector<HTMLElement>("[data-floating-root='orb']");
    case "settings":
      return document.querySelector<HTMLElement>("[data-floating-root='settings']");
    case "search":
      return document.querySelector<HTMLElement>("[data-search-box]");
  }
}

/**
 * Right-click menu on any `;;;` grip: pixel-perfect preset placements and,
 * for collection panels, rigid group management. When a panel is grouped,
 * a preset aligns the whole group's bounding box.
 */
export function PositionMenu({ target, x, y, onClose }: { target: PositionTarget; x: number; y: number; onClose: () => void }) {
  const viewport = useViewportSize();
  const [mode, setMode] = useState<"main" | "pick" | "add">("main");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const persist = useStore((s) => s.persist);
  const group = target.kind === "panel" ? persist.panelGroups.find((g) => g.members.includes(target.categoryId)) : undefined;
  const others = target.kind === "panel" ? persist.categories.filter((c) => c.id !== target.categoryId && persist.panels[c.id]?.open && !persist.panels[c.id]?.locked && !persist.panelGroups.some((g) => g.members.includes(c.id))) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Resolved viewport rect for a panel id (falls back to stored geometry). */
  const memberRect = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-floating-slot='panel-${id}']`);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    const g = persist.panels[id];
    if (!g) return null;
    return { x: g.x, y: g.y, w: g.w, h: g.h };
  };

  const apply = (preset: PresetId) => {
    const state = useStore.getState();
    const vw = viewport.w;
    const vh = viewport.h;

    if (target.kind === "panel" && group) {
      const rects = group.members.map(memberRect).filter((r): r is { x: number; y: number; w: number; h: number } => Boolean(r));
      if (!rects.length) return;
      const box = boundingBox(rects);
      const dest = presetPosition(preset, box.w, box.h, vw, vh);
      const dx = dest.x - box.x;
      const dy = dest.y - box.y;
      for (const m of group.members) {
        const r = memberRect(m);
        if (!r) continue;
        const g = state.persist.panels[m];
        if (!g || g.locked) continue;
        state.updatePanel(m, { x: Math.round(r.x + dx), y: Math.round(r.y + dy) });
      }
      onClose();
      return;
    }

    const el = targetElement(target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pos = presetPosition(preset, r.width || 320, r.height || 200, vw, vh);
    switch (target.kind) {
      case "panel":
        state.updatePanel(target.categoryId, { x: pos.x, y: pos.y });
        break;
      case "dock":
        state.updateDock({ x: pos.x, y: pos.y, anchored: false });
        break;
      case "clock":
        state.updateSettings({ clockPosition: pos });
        break;
      case "orb":
        state.updateFloatingButton({ x: pos.x, y: pos.y });
        break;
      case "settings":
        state.setSettingsPanelPos(pos.x, pos.y);
        break;
      case "search":
        state.setSearchPanelPos(pos.x, pos.y);
        break;
    }
    onClose();
  };

  const togglePick = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupName = group ? `Group of ${group.members.length}` : "";

  return (
    <FloatingMenu x={x} y={y} onClose={onClose} minWidth={228}>
      {mode === "main" && (
        <>
          <MenuLabel>Position</MenuLabel>
          <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
            {(["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"] as PresetId[]).map((p) => (
              <button
                key={p}
                data-menu-item
                onClick={() => apply(p)}
                title={PRESETS.find((x) => x.id === p)?.label}
                className="flex h-11 items-end justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] pb-1.5 transition-colors hover:bg-white/[0.09]"
              >
                <span
                  className="rounded-[3px] bg-mist-400"
                  style={{
                    width: p.endsWith("left") ? 8 : p.endsWith("right") ? 8 : 14,
                    height: p.startsWith("top") ? 3 : p.startsWith("bottom") ? 3 : 8,
                    alignSelf: p.startsWith("top") ? "flex-start" : p.startsWith("bottom") ? "flex-end" : "center",
                  }}
                />
              </button>
            ))}
          </div>
          <MenuItem label="Center screen" onClick={() => apply("center")} />

          {target.kind === "panel" && (
            <>
              <MenuSeparator />
              <MenuLabel>{group ? groupName : "Grouping"}</MenuLabel>
              {group ? (
                <>
                  <MenuItem icon={<Plus size={13} />} label="Add open panels…" onClick={() => setMode("add")} />
                  <MenuItem
                    icon={<X size={13} />}
                    label="Leave group"
                    onClick={() => {
                      useStore.getState().removeFromPanelGroup(target.categoryId);
                      useStore.getState().toast({ title: "Left the group", tone: "info" });
                      onClose();
                    }}
                  />
                  <MenuItem
                    icon={<Ungroup size={13} />}
                    label="Ungroup all"
                    onClick={() => {
                      useStore.getState().ungroupPanels(group.id);
                      useStore.getState().toast({ title: "Group dissolved", tone: "info" });
                      onClose();
                    }}
                  />
                </>
              ) : (
                <>
                  <MenuItem icon={<Group size={13} />} label="Group with…" disabled={!others.length} onClick={() => setMode("pick")} />
                  <MenuItem
                    icon={<Group size={13} />}
                    label={`Group all open panels (${others.length + 1})`}
                    disabled={others.length === 0}
                    onClick={() => {
                      useStore.getState().createPanelGroup([target.categoryId, ...others.map((o) => o.id)]);
                      useStore.getState().toast({ title: `Grouped ${others.length + 1} panels`, detail: "Dragging one now moves all of them together.", tone: "success" });
                      onClose();
                    }}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {(mode === "pick" || mode === "add") && (
        <>
          <MenuLabel>{mode === "pick" ? "Group with…" : "Add to group"}</MenuLabel>
          {others.length === 0 && <div className="px-3 py-2 text-[11px] text-mist-600">No other open unlocked panels.</div>}
          {others.map((c) => {
            const on = picked.has(c.id);
            return (
              <MenuItem
                key={c.id}
                icon={on ? <Check size={13} /> : <Square size={13} />}
                label={c.name}
                active={on}
                keepOpen
                onClick={() => togglePick(c.id)}
              />
            );
          })}
          <MenuSeparator />
          <MenuItem
            icon={<Group size={13} />}
            label={mode === "pick" ? `Create group (${picked.size + 1})` : `Add ${picked.size} to group`}
            disabled={picked.size === 0}
            onClick={() => {
              if (target.kind !== "panel") return;
              const ids = [target.categoryId, ...picked];
              if (mode === "pick") {
                useStore.getState().createPanelGroup(ids);
                useStore.getState().toast({ title: `Grouped ${ids.length} panels`, tone: "success" });
              } else if (group) {
                useStore.getState().addPanelMembers(group.id, [...picked]);
                useStore.getState().toast({ title: `Added ${picked.size} panels`, tone: "success" });
              }
              onClose();
            }}
          />
          <MenuItem icon={<X size={13} />} label="Cancel" onClick={() => { setPicked(new Set()); setMode("main"); }} />
        </>
      )}
    </FloatingMenu>
  );
}
