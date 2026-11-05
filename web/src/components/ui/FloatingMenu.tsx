import { useEffect, useRef, useState } from "react";
import { animate } from "motion";
import { GLASS_CLASS } from "../floating/FloatingWindow";

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
}

/**
 * Floating menu anchored at viewport px, flipping when it would overflow.
 * Close is driven by the owner (useContextMenu attaches the outside listener).
 */
export function FloatingMenu({ x, y, onClose, children, minWidth = 216 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x, y });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Measure once, then place. Reading the rect happens while the element is
    // still offscreen (top: -9999), so an animation frame is used to get real size.
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > vw - 8) nx = Math.max(8, x - rect.width);
    if (y + rect.height > vh - 8) ny = Math.max(8, vh - rect.height - 8);
    setPos({ x: nx, y: ny });
    setReady(true);
    const controls = animate(el, { opacity: [0, 1], scale: [0.97, 1], y: [4, 0] }, { duration: 0.14, ease: [0.2, 0.9, 0.3, 1] });
    return () => controls.stop();
  }, [x, y]);

  return (
    <div
      ref={ref}
      role="menu"
      data-mantle-keep-open
      className={`fixed z-[90] rounded-2xl p-1.5 ${GLASS_CLASS}`}
      style={{ left: pos.x, top: ready ? pos.y : -9999, minWidth, opacity: 0 }}
      onPointerDown={(e) => {
        // Keep the press away from the wallpaper and from the outside-close
        // listener that useContextMenu installs on window.
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-menu-item]")) onClose();
      }}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  icon,
  label,
  hint,
  onClick,
  danger,
  disabled,
  active,
  keepOpen,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  keepOpen?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item
      disabled={disabled}
      onClick={(e) => {
        if (keepOpen) e.stopPropagation();
        onClick?.();
      }}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-left text-[12.5px] transition-colors disabled:opacity-35 ${
        danger ? "text-red-300/90 hover:bg-red-500/12" : "text-mist-300 hover:bg-white/[0.07] hover:text-mist-100"
      } ${active ? "text-champagne-300" : ""}`}
    >
      {icon && <span className="grid size-4 shrink-0 place-items-center opacity-80">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-[10.5px] tracking-wide text-mist-600">{hint}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-2 my-1 h-px bg-white/[0.06]" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-mist-600">{children}</div>;
}
