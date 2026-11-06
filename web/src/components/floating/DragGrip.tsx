import type { ReactNode } from "react";

/**
 * The `;;;` drag section: a dedicated, grab-sized zone every draggable
 * component exposes so the mouse always has something obvious to hold.
 * `usePanelDrag` only starts a panel drag from inside `[data-drag-handle]`,
 * so content elsewhere — text, buttons, icons — never moves the panel by
 * accident. Locked panels keep the dots visible but dimmed.
 */
export function DragGrip({
  locked = false,
  hint = "Drag to move",
  children,
  className = "",
  onContextMenu,
}: {
  locked?: boolean;
  hint?: string;
  children?: ReactNode;
  className?: string;
  /** Right-click opens the position / group menu (see PositionMenu). */
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      data-drag-handle
      data-drag-handle-locked={locked ? "true" : "false"}
      role="separator"
      aria-orientation="horizontal"
      aria-label={locked ? "Position locked" : hint}
      title={locked ? "Position locked · right-click for positions" : hint}
      aria-disabled={locked}
      onContextMenu={onContextMenu}
      // React's synthetic system delegates to root — stopping propagation here
      // would also swallow the window-level pointerdown gate in usePanelDrag.
      // No stopPropagation: the hook itself ignores presses off the grip.
      className={`inline-grid shrink-0 cursor-grab place-items-center select-none ${
        locked ? "cursor-default opacity-40" : "opacity-60 hover:opacity-100 active:cursor-grabbing"
      } ${className}`}
      style={{ touchAction: "none" }}
    >
      <span className="flex items-center gap-[3px]" aria-hidden="true">
        <span className="flex flex-col gap-[3px]">
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </span>
        <span className="flex flex-col gap-[3px]">
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </span>
        {children}
      </span>
    </span>
  );
}
