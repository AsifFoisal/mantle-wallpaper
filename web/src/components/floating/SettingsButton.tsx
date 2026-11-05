import { useRef, useState } from "react";
import { useStore } from "../../state/store";
import { useViewportSize } from "../../hooks/useAppIndex";
import { resolvePosition } from "../../hooks/useAppIndex";
import { usePanelDrag } from "./usePanelDrag";
import { Settings2, Lock } from "lucide-react";
import { GLASS_CLASS } from "./FloatingWindow";

const MENU_ITEMS: { id: string; label: string }[] = [
  { id: "categories", label: "Categories" },
  { id: "applications", label: "Applications" },
  { id: "dock", label: "Dock" },
  { id: "layout", label: "Layout" },
  { id: "appearance", label: "Appearance" },
  { id: "performance", label: "Performance" },
  { id: "general", label: "General" },
];

/**
 * The wallpaper's only permanent chrome: a soft glass orb that opens settings.
 * Hover unfolds the section rail; click opens the floating settings panel.
 */
export function SettingsButton({ onOpenTo }: { onOpenTo: (section: string) => void }) {
  const fb = useStore((s) => s.persist.settings.floatingButton);
  const update = useStore((s) => s.updateFloatingButton);
  const online = useStore((s) => s.backend === "online");
  const viewport = useViewportSize();
  const orbRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);

  usePanelDrag(orbRef, {
    getPanel: () => orbRef.current,
    onEnd: (x, y) => update({ x, y }),
    disabled: fb.locked || !fb.visible,
    // The orb is the drag section itself — a `;;;` grip inside a 40px circle
    // would be too small to hold.
    handleSelector: "",
  });

  if (!fb.visible) return null;

  // Sits in the top-right corner by default; -1 means "anchored".
  const anchored = { x: fb.x < 0 ? viewport.w - 40 - 28 : fb.x, y: fb.y < 0 ? 28 : fb.y };
  const pos = resolvePosition(anchored, 40, 40, viewport);
  const dim = fb.hoverOnly && !hover ? 0.3 : 1;

  return (
    <div
      className="fixed z-50"
      style={{ left: pos.x, top: pos.y, transition: "opacity 240ms ease" }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div className="relative" style={{ opacity: dim }}>
        <div className="relative">
          <div
            ref={orbRef}
            role="button"
            tabIndex={0}
            aria-label="Open settings · drag to move"
            title="Settings"
            onClick={() => onOpenTo("general")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenTo("general");
              }
            }}
            className={`group grid size-10 place-items-center rounded-full text-mist-300 transition-colors duration-300 hover:text-mist-100 ${GLASS_CLASS} cursor-grab rounded-full hover:bg-white/[0.07]`}
            style={{ touchAction: "none" }}
          >
            <Settings2 size={16} strokeWidth={1.6} className="transition-transform duration-700 group-hover:rotate-90" />
          </div>
          {fb.locked && (
            <span className="pointer-events-none absolute -bottom-0.5 -left-0.5 grid size-4 place-items-center rounded-full bg-ink-900 text-mist-500 ring-1 ring-white/10">
              <Lock size={8} />
            </span>
          )}
          {!online && (
            <span
              className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400/90 ring-2 ring-ink-950"
              title="Desktop bridge offline"
            />
          )}
        </div>

        <div
          className={`absolute right-0 top-full mt-2 flex flex-col items-end gap-0.5 rounded-2xl px-1.5 py-1.5 transition-all duration-300 ${GLASS_CLASS} ${
            hover ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
          }`}
          style={{ width: 168 }}
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenTo(item.id)}
              className="w-full rounded-xl px-2.5 py-1.5 text-right text-[11px] font-medium text-mist-300 transition-colors hover:bg-white/[0.07] hover:text-mist-100"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
