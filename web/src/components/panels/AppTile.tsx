import { memo, useCallback } from "react";
import type { AppView } from "../../lib/apps";
import { AppIcon, BrokenBadge } from "../ui/AppIcon";

export interface AppTileProps {
  view: AppView;
  size?: number;
  selected?: boolean;
  running?: boolean;
  onLaunch: () => void;
  onSelect?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent, position: "before" | "after") => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, position: "before" | "after") => void;
  onDragEnd?: () => void;
  dropIndicator?: "before" | "after" | null;
  showSource?: boolean;
  compact?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  "start-menu": "Start menu",
  desktop: "Desktop",
  uwp: "Store app",
  registry: "Installed",
};

export const AppTile = memo(function AppTile({
  view,
  size = 40,
  selected,
  running,
  onLaunch,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dropIndicator,
  showSource,
  compact,
}: AppTileProps) {
  // Pointer position decides whether the drop lands before or after this tile.
  const side = (e: React.DragEvent): "before" | "after" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const horizontal = rect.width > rect.height * 1.15 ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
    return horizontal ? "after" : "before";
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        onSelect?.();
        return;
      }
      onLaunch();
    },
    [onLaunch, onSelect],
  );

  return (
    <button
      type="button"
      draggable
      data-app-tile={view.app.id}
      onClick={handleClick}
      onDoubleClick={onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!onDragOver) return;
        onDragOver(e, side(e));
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        onDrop(e, side(e));
      }}
      data-drop={dropIndicator ?? undefined}
      title={`${view.name}${view.app.executablePath ? `\n${view.app.executablePath}` : ""}`}
      className={`group relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1.5 pb-1.5 pt-2 transition-colors duration-150 ${
        selected ? "bg-white/[0.085]" : "hover:bg-white/[0.055]"
      } ${
        dropIndicator === "before"
          ? "before:absolute before:-left-0.5 before:inset-y-1 before:w-[2px] before:rounded-full before:bg-champagne-400"
          : dropIndicator === "after"
            ? "after:absolute after:-right-0.5 after:inset-y-1 after:w-[2px] after:rounded-full after:bg-champagne-400"
            : ""
      }`}
      style={{ opacity: view.broken ? 0.55 : 1 }}
    >
      <span className="relative grid place-items-center" style={{ width: size, height: size }}>
        <AppIcon view={view} size={size} className="transition-transform duration-200 group-hover:-translate-y-px group-hover:scale-[1.04]" />
        {view.broken && <BrokenBadge />}
        {running && <RunningDot compact={compact} />}
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-mist-100/85 transition-colors group-hover:text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}>
        {view.name}
      </span>
      {showSource && (
        <span className="w-full truncate text-center text-[9px] uppercase tracking-[0.14em] text-mist-500">
          {SOURCE_LABEL[view.app.source] ?? view.app.source}
          {view.categories.length > 0 && ` · ${view.categories.length}`}
        </span>
      )}
      {view.isFavorite && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 text-champagne-400/85">
          <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor">
            <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
          </svg>
        </span>
      )}
    </button>
  );
});

function RunningDot({ compact }: { compact?: boolean }) {
  return (
    <span
      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-champagne-400 ${
        compact ? "size-[3px]" : "size-[4px]"
      }`}
      style={{ boxShadow: "0 0 6px rgba(217,199,163,0.8)" }}
      aria-label="Running"
    />
  );
}
