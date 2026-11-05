import { useRef, type ReactNode } from "react";

/**
 * Pinch-zoom + native two-finger trackpad scroll magnification for app grids.
 * Applies a CSS scale to the content; click targets are left to the browser.
 */
export function Zoomable({
  children,
  min = 0.7,
  max = 1.6,
  value,
  onChange,
  className,
}: {
  children: ReactNode;
  min?: number;
  max?: number;
  value: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const apply = (delta: number) => {
    const next = Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
    if (next !== value) onChange(next);
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ zoom: value }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        apply(-e.deltaY * 0.0025);
      }}
      onDoubleClick={(e) => {
        if (e.target === ref.current) onChange(1);
      }}
    >
      {children}
    </div>
  );
}
