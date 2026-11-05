import { useState } from "react";
import type { AppView } from "../../lib/apps";
import type { Category } from "../../types";
import { useStore } from "../../state/store";
import { launchApp } from "../../lib/launch";
import { FloatingMenu, MenuItem, MenuLabel, MenuSeparator } from "../ui/FloatingMenu";
import type { ContextMenuState } from "../../hooks/useContextMenu";
import { AppIcon } from "../ui/AppIcon";
import {
  Play,
  Star,
  StarOff,
  PanelTop,
  PanelTopClose,
  FolderInput,
  FolderMinus,
  EyeOff,
  FolderOpen,
  Copy,
  Pencil,
  RefreshCw,
} from "lucide-react";

export function AppContextMenu({
  x,
  y,
  view,
  categories,
  onClose,
}: {
  x: number;
  y: number;
  view: AppView;
  categories: Category[];
  onClose: () => void;
}) {
  const store = useStore.getState();
  const [revealLoc, setRevealLoc] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      store.toast({ title: "Copied to clipboard", detail: text, tone: "info" });
    } catch {
      store.toast({ title: "Clipboard unavailable", tone: "warn" });
    }
  };

  const path = view.app.shortcutPath ?? view.app.executablePath ?? view.app.appsFolderId ?? null;

  return (
    <FloatingMenu x={x} y={y} onClose={onClose}>
      <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
        <AppIcon view={view} size={28} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-mist-100">{view.name}</div>
          <div className="truncate text-[10.5px] text-mist-600">{view.app.source === "uwp" ? "Microsoft Store app" : view.app.executableName ?? "Shortcut"}</div>
        </div>
      </div>
      <MenuSeparator />
      <MenuItem icon={<Play size={13} />} label="Open" hint="Enter" onClick={() => void launchApp(view, view.app.id)} />
      <MenuItem icon={<RefreshCw size={13} />} label="Reveal in bridge" disabled={!path} onClick={() => setRevealLoc(true)} />
      {revealLoc && path && (
        <div className="mx-2 mb-1 rounded-lg bg-black/25 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-mist-500 break-all">
          {path}
          <button onClick={() => void copy(path)} className="mt-1 flex items-center gap-1 text-[10px] text-champagne-300 hover:text-champagne-200">
            <Copy size={10} /> Copy path
          </button>
        </div>
      )}
      <MenuSeparator />
      <MenuItem
        icon={view.isFavorite ? <StarOff size={13} /> : <Star size={13} />}
        label={view.isFavorite ? "Remove from favorites" : "Add to favorites"}
        active={view.isFavorite}
        onClick={() => store.toggleFavorite(view.app.id)}
      />
      <MenuItem
        icon={view.inDock ? <PanelTopClose size={13} /> : <PanelTop size={13} />}
        label={view.inDock ? "Remove from dock" : "Add to dock"}
        onClick={() => store.toggleDock(view.app.id)}
      />
      <MenuSeparator />
      <MenuLabel>Categories</MenuLabel>
      <div className="max-h-[184px] overflow-y-auto">
        {categories.map((cat) => {
          const inCat = view.categories.includes(cat.id);
          return (
            <MenuItem
              key={cat.id}
              icon={<span className="size-2 rounded-full" style={{ background: cat.color }} />}
              label={cat.name}
              active={inCat}
              hint={inCat ? "✓" : undefined}
              onClick={() => (inCat ? store.unassignCategory(view.app.id, cat.id) : store.assignCategory(view.app.id, cat.id))}
            />
          );
        })}
      </div>
      <MenuSeparator />
      <MenuItem icon={<Pencil size={13} />} label="Rename display name" onClick={() => promptRename(view, store)} />
      <MenuItem icon={<EyeOff size={13} />} label="Hide from organizer" onClick={() => store.setOverride(view.app.id, { displayName: "\u0000hidden" })} />
      <MenuItem icon={<FolderOpen size={13} />} label="Open containing folder" disabled={!view.app.executablePath && !view.app.shortcutPath} onClick={() => openFolder(view)} />
      {(view.categories.length > 0 || !manual(view)) && (
        <>
          <MenuSeparator />
          <MenuItem icon={<FolderInput size={13} />} label="Auto-group into category" onClick={() => void autoAssign(view.app.id)} />
          {view.categories.length > 0 && (
            <MenuItem icon={<FolderMinus size={13} />} label="Remove from all categories" onClick={() => removeFromAll(view)} />
          )}
        </>
      )}
    </FloatingMenu>
  );
}

function manual(view: AppView) {
  const o = useStore.getState().persist.appOverrides[view.app.id];
  return Boolean(o?.categoriesManual);
}

function promptRename(view: AppView, store: ReturnType<typeof useStore.getState>) {
  const next = window.prompt("Display name", view.name);
  if (next === null) return;
  store.renameApp(view.app.id, next.trim());
}

async function autoAssign(appId: string) {
  const { suggestCategory } = await import("../../lib/categorize");
  const state = useStore.getState();
  const app = state.apps.find((a) => a.id === appId);
  if (!app) return;
  const cat = suggestCategory(app, state.persist.categories);
  if (cat) {
    state.assignCategory(appId, cat.id);
    state.toast({ title: `Moved to ${cat.name}`, tone: "success" });
  } else {
    state.toast({ title: "No suggestion available", detail: "Assign it manually from this menu.", tone: "info" });
  }
}

function removeFromAll(view: AppView) {
  const store = useStore.getState();
  store.setOverride(view.app.id, { categories: [], categoriesManual: true });
}

function openFolder(view: AppView) {
  const store = useStore.getState();
  const path = view.app.executablePath ?? view.app.shortcutPath ?? "";
  void store; // path is displayed; folder opening happens in the companion via launch of explorer not exposed by design
  if (!path) return;
  void navigator.clipboard.writeText(path).then(() => store.toast({ title: "Path copied", detail: path, tone: "info" }));
}

/** Renders whichever menu ids the overlay holds. */
export function ContextMenuLayer({ menu, close, byId, categories }: { menu: ContextMenuState | null; close: () => void; byId: Map<string, AppView>; categories: Category[] }) {
  if (!menu) return null;
  const view = byId.get(menu.id);
  if (!view) return null;
  return <AppContextMenu x={menu.x} y={menu.y} view={view} categories={categories} onClose={close} />;
}
