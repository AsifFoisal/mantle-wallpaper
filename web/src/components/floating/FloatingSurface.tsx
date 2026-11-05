import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, Minus, X } from "lucide-react";
import { resolvePosition } from "../../hooks/useAppIndex";
import { usePanelDrag } from "../floating/usePanelDrag";
import { DragGrip } from "../floating/DragGrip";
import { GLASS_CLASS } from "../floating/FloatingWindow";

/**
 * Draggable glass surface with a minimal header. Works for the dock, clock and
 * drawer so they share drag, anchoring and z-index behaviour.
 */
export function FloatingSurface({
  id,
  pos,
  viewport,
  size,
  locked,
  resizable = false,
  minWidth = 240,
  minHeight = 160,
  width,
  height,
  onPos,
  onSize,
  onTap,
  className = "",
  style,
  header,
  headerClassName = "",
  footer,
  children,
}: {
  id: string;
  pos: { x: number; y: number };
  viewport: { w: number; h: number };
  size: { w: number; h: number };
  locked?: boolean;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  width?: number;
  height?: number;
  onPos?: (x: number, y: number) => void;
  onSize?: (w: number, h: number) => void;
  onTap?: () => void;
  className?: string;
  style?: React.CSSProperties;
  header?: ReactNode;
  headerClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: width ?? size.w, h: height ?? size.h });

  useEffect(() => {
    setDims(() => ({ w: width ?? size.w, h: height ?? size.h }));
  }, [width, height, size.w, size.h]);

  usePanelDrag(headerRef, {
    getPanel: () => ref.current,
    onEnd: (x, y) => onPos?.(x, y),
    disabled: locked,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !onTap) return;
    const handler = () => onTap();
    el.addEventListener("floating:tap", handler);
    return () => el.removeEventListener("floating:tap", handler);
  }, [onTap]);

  const resolved = resolvePosition(pos, dims.w, dims.h, viewport);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  return (
    <div
      ref={ref}
      data-floating-root={id}
      className={`absolute flex flex-col overflow-hidden rounded-[20px] ${GLASS_CLASS} ${className}`}
      style={{ left: resolved.x, top: resolved.y, width: dims.w, height: dims.h, zIndex: 30, ...style }}
    >
      <div ref={headerRef} className={`shrink-0 ${headerClassName}`} style={{ touchAction: "none", cursor: locked ? "default" : "auto" }}>
        {header}
        {header ? null : <DragGrip locked={locked} className="mx-auto my-2 block text-mist-500" />}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {footer}
      {resizable && !locked && (
        <div
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            resize.current = { x: e.clientX, y: e.clientY, w: ref.current?.offsetWidth ?? dims.w, h: ref.current?.offsetHeight ?? dims.h };
            e.stopPropagation();
          }}
          onPointerMove={(e) => {
            if (!resize.current) return;
            const s = resize.current;
            const w = Math.max(minWidth, Math.round(s.w + e.clientX - s.x));
            const h = Math.max(minHeight, Math.round(s.h + e.clientY - s.y));
            resize.current = { ...s, w, h };
            setDims({ w, h });
          }}
          onPointerUp={(e) => {
            if (!resize.current) return;
            resize.current = null;
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            onSize?.(dims.w, dims.h);
          }}
          className="absolute bottom-0 right-0 z-10 size-4 cursor-nwse-resize"
          style={{ touchAction: "none" }}
        />
      )}
    </div>
  );
}

export function PanelHeader({
  icon,
  title,
  subtitle,
  locked,
  onMinimize,
  onClose,
  extra,
  handleProps,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  locked?: boolean;
  onMinimize?: () => void;
  onClose?: () => void;
  extra?: ReactNode;
  handleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div {...handleProps}>
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
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
          {extra}
          {onMinimize && (
            <button aria-label="Minimize" title="Minimize" onClick={onMinimize} className="grid size-6 place-items-center rounded-md text-mist-600 transition-colors hover:bg-white/[0.07] hover:text-mist-300">
              <Minus size={13} />
            </button>
          )}
          {onClose && (
            <button aria-label="Close" title="Close" onClick={onClose} className="grid size-6 place-items-center rounded-md text-mist-600 transition-colors hover:bg-red-500/15 hover:text-red-300">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="mx-3.5 h-px bg-white/[0.055]" />
    </div>
  );
}

