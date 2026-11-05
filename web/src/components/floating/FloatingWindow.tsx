import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Lock, Minus, X } from "lucide-react";
import { resolvePosition } from "../../hooks/useAppIndex";
import { usePanelDrag } from "./usePanelDrag";
import { DragGrip } from "./DragGrip";

export interface FloatingWindowProps {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  pos: { x: number; y: number; w?: number; h?: number };
  viewport: { w: number; h: number };
  open?: boolean;
  locked?: boolean;
  minimized?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  closable?: boolean;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  bodyClassName?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  onPosChange?: (x: number, y: number) => void;
  onSizeChange?: (w: number, h: number) => void;
  onClose?: () => void;
  onMinimize?: () => void;
  dismissOnOutside?: boolean;
  onOutside?: () => void;
  /** Header content that should keep receiving clicks (done via cursor auto). */
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Permanent glass texture. Inner layers fade in so the page-fade CSS animation
 * never leaves panels invisible.
 */
export const GLASS_CLASS =
  "border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012)),rgba(9,10,15,0.82)] backdrop-blur-[26px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_70px_-26px_rgba(0,0,0,0.9),0_8px_22px_-10px_rgba(0,0,0,0.65)]";

/**
 * Floating glass panel: draggable by header, resizable from the bottom-right,
 * positioned from persisted px (negative = anchored right/bottom).
 */
export function FloatingWindow({
  id,
  title,
  subtitle,
  icon,
  pos,
  viewport,
  open = true,
  locked = false,
  minimized = false,
  resizable = true,
  minimizable = true,
  closable = true,
  minWidth = 300,
  minHeight = 180,
  className = "",
  bodyClassName = "",
  headerExtra,
  footer,
  onPosChange,
  onSizeChange,
  onClose,
  onMinimize,
  dismissOnOutside,
  onOutside,
  style,
  children,
}: FloatingWindowProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState(() => ({ w: pos.w ?? 0, h: pos.h ?? 0 }));
  const callbacks = useRef({ onPosChange, onSizeChange });
  callbacks.current = { onPosChange, onSizeChange };

  // Keep CSS dims in sync with persisted size (which can change from settings).
  const wantedW = pos.w ?? dims.w;
  const wantedH = pos.h ?? dims.h;
  const resolved = resolvePosition(pos, wantedW, wantedH, viewport);

  usePanelDrag(headerRef, {
    getPanel: () => rootRef.current,
    onEnd: (x, y) => callbacks.current.onPosChange?.(x, y),
  });

  // Resize from bottom-right grip.
  const resizeState = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    if (locked || !resizable) return;
    e.stopPropagation();
    resizeState.current = { x: e.clientX, y: e.clientY, w: wantedW, h: wantedH };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.dataset.resizing = "true";
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const s = resizeState.current;
    const w = Math.max(minWidth, Math.round(s.w + (e.clientX - s.x)));
    const h = Math.max(minHeight, Math.round(s.h + (e.clientY - s.y)));
    setDims({ w, h });
  };
  const onResizeUp = (e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const s = resizeState.current;
    resizeState.current = null;
    delete document.body.dataset.resizing;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const w = Math.max(minWidth, Math.round(s.w + (e.clientX - s.x)));
    const h = Math.max(minHeight, Math.round(s.h + (e.clientY - s.y)));
    setDims({ w, h });
    callbacks.current.onSizeChange?.(w, h);
  };

  // Outside-click dismissal.
  const outsideRef = useRef({ dismissOnOutside, onOutside });
  outsideRef.current = { dismissOnOutside, onOutside };
  if (!open) return null;

  const sizeStyle: CSSProperties = dims.w && dims.h && !minimized ? { width: dims.w, height: dims.h } : dims.w ? { width: dims.w } : {};

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-30"
      style={{ pointerEvents: "none" }}
      onPointerDownCapture={(e) => {
        if (!outsideRef.current.dismissOnOutside) return;
        const inside = rootRef.current?.firstElementChild?.contains(e.target as Node) ?? false;
        if (!inside && !(e.target as Element).closest?.("[data-mantle-keep-open]")) {
          outsideRef.current.onOutside?.();
        }
      }}
    >
      <div
        data-floating-root={id}
        data-floating-locked={locked ? "true" : "false"}
        className={`${GLASS_CLASS} absolute flex animate-panel flex-col overflow-hidden rounded-[20px] ${className}`}
        style={{
          left: resolved.x,
          top: resolved.y,
          pointerEvents: "auto",
          ...(minimized ? { width: dims.w || minWidth } : sizeStyle),
          ...style,
        }}
      >
        <div
          ref={headerRef}
          className="group/header flex shrink-0 select-none items-center gap-2.5 px-3.5 pb-2.5 pt-3"
          style={{ cursor: locked ? "default" : "auto", touchAction: "none" }}
        >
          <DragGrip locked={locked} className="size-7 text-mist-500" />
          {icon && (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-mist-300">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-mist-100">{title}</span>
              {subtitle && <span className="truncate text-[11px] text-mist-600">{subtitle}</span>}
            </div>
          </div>
          {locked && <Lock size={11} className="shrink-0 text-mist-600" aria-label="Position locked" />}
          <div className="flex shrink-0 items-center gap-0.5" style={{ cursor: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
            {headerExtra}
            {minimizable && (
              <HeaderButton label={minimized ? "Restore" : "Minimize"} onClick={onMinimize}>
                <Minus size={13} />
              </HeaderButton>
            )}
            {closable && (
              <HeaderButton label="Close" onClick={onClose} danger>
                <X size={13} />
              </HeaderButton>
            )}
          </div>
        </div>
        <div className="mx-3.5 h-px shrink-0 bg-white/[0.055]" />
        {!minimized && (
          <>
            <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
            {footer}
            {resizable && !locked && (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize panel"
                onPointerDown={onResizeDown}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
                onPointerCancel={onResizeUp}
                className="absolute bottom-0 right-0 z-10 size-4 cursor-nwse-resize"
                style={{ touchAction: "none" }}
              >
                <svg viewBox="0 0 16 16" className="absolute bottom-1 right-1 size-2.5 text-white/20">
                  <path d="M14 6 L6 14 M14 10 L10 14" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HeaderButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-6 place-items-center rounded-md text-mist-600 transition-colors ${
        danger ? "hover:bg-red-500/15 hover:text-red-300" : "hover:bg-white/[0.07] hover:text-mist-300"
      }`}
    >
      {children}
    </button>
  );
}

