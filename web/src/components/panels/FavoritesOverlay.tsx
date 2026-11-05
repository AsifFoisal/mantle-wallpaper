import { useMemo, useState } from "react";
import { AppWindow } from "lucide-react";
import { useStore } from "../../state/store";
import { useAppIndex } from "../../hooks/useAppIndex";
import { launchApp, isRunning } from "../../lib/launch";
import { AppTile } from "../panels/AppTile";
import { ContextMenuLayer } from "../panels/AppContextMenu";
import { useContextMenu } from "../../hooks/useContextMenu";
import { Plus } from "lucide-react";

/**
 * Favorites, shown on demand — never as permanent wallpaper chrome.
 * Opens from search (Ctrl+K → Tab), settings, and the category rail.
 */
export function FavoritesOverlay({ onClose }: { onClose: () => void }) {
  const favorites = useStore((s) => {
    const ids = Object.entries(s.persist.appOverrides)
      .filter(([, o]) => o.isFavorite && o.displayName !== "\u0000hidden")
      .map(([id]) => id);
    const recent = s.recentIds.filter((id) => !ids.includes(id) && s.persist.appOverrides[id]?.isFavorite);
    // Memoised store selectors need a stable reference when nothing changed.
    return JSON.stringify([...ids, ...recent]);
  });
  const favoriteIds = useMemo<string[]>(() => JSON.parse(favorites) as string[], [favorites]);
  const running = useStore((s) => s.runningNames);
  const categories = useStore((s) => s.persist.categories);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const { byId } = useAppIndex();
  const ctx = useContextMenu();
  const [selected, setSelected] = useState<string | null>(null);

  const views = favoriteIds.map((id) => byId.get(id)).filter((v) => v !== undefined);

  return (
    <div className="fixed inset-0 z-50" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full flex-col bg-black/25 backdrop-blur-[2px] pt-24">
        <div className="mx-auto w-[min(860px,86vw)]">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.34em] text-mist-600">Pinned</div>
              <h1 className="mt-1 font-serif text-[40px] italic leading-none text-mist-100/95">Favorites</h1>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-[11px] uppercase tracking-[0.18em] text-mist-600 transition-colors hover:text-mist-300"
            >
              Manage
            </button>
          </div>

          {views.length === 0 ? (
            <div className="glass mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-3xl px-8 py-10 text-center">
              <AppWindow size={22} className="text-mist-500" strokeWidth={1.4} />
              <div className="text-[13px] text-mist-300">Nothing pinned yet</div>
              <div className="text-[11.5px] leading-relaxed text-mist-600">
                Right-click any application and choose <span className="text-mist-300">Add to favorites</span>, or star it from settings.
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                className="mt-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11.5px] text-mist-300 hover:bg-white/[0.09]"
              >
                <Plus size={12} /> Pin applications
              </button>
            </div>
          ) : (
            <div
              className="grid gap-1 rounded-3xl p-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
              onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}
            >
              {views.map((v) => (
                <AppTile
                  key={v.app.id}
                  view={v}
                  size={44}
                  selected={selected === v.app.id}
                  running={isRunning(v, running)}
                  onLaunch={() => void launchApp(v, v.app.id)}
                  onSelect={() => setSelected(v.app.id)}
                  onContextMenu={(e) => ctx.open(v.app.id, e)}
                  showSource
                />
              ))}
            </div>
          )}

          <div className="mt-6 text-center text-[10.5px] uppercase tracking-[0.24em] text-mist-600">
            Click outside to return to the wallpaper
          </div>
        </div>
      </div>
      <ContextMenuLayer menu={ctx.menu} close={ctx.close} byId={byId} categories={categories} />
    </div>
  );
}
