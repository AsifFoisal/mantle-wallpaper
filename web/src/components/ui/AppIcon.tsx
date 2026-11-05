import { memo } from "react";
import { ImageOff } from "lucide-react";
import type { AppView } from "../../lib/apps";
import { mantleApi } from "../../api/mantle";

function initials(name: string) {
  const clean = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export const AppIcon = memo(function AppIcon({ view, size, className = "" }: { view: AppView; size: number; className?: string }) {
  if (!view.app.hasIcon && !view.iconDataUrl) {
    const hue = hueFor(view.name);
    return (
      <div
        className={`grid shrink-0 place-items-center rounded-[24%] font-semibold tracking-tight text-white/85 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.33,
          background: `linear-gradient(145deg, hsl(${hue} 30% 34%), hsl(${(hue + 40) % 360} 28% 17%))`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
        aria-hidden
      >
        {initials(view.name)}
      </div>
    );
  }

  const src = view.iconDataUrl ?? mantleApi.iconUrl(view.app.id, view.app.dateDetected);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      className={`shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.failed) return;
        img.dataset.failed = "1";
        img.style.visibility = "hidden";
      }}
    />
  );
});

export function BrokenBadge({ size = 12 }: { size?: number }) {
  return (
    <span
      className="pointer-events-none absolute -right-1 -top-1 grid place-items-center rounded-full bg-amber-400 text-ink-950 ring-2 ring-ink-900/80"
      style={{ width: size + 4, height: size + 4 }}
      title="Target missing — rescan"
    >
      <ImageOff size={size - 4} strokeWidth={2.4} />
    </span>
  );
}
