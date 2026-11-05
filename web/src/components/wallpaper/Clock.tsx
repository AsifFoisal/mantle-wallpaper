import { useEffect, useState } from "react";
import { useStore } from "../../state/store";
import { useViewportSize, resolvePosition } from "../../hooks/useAppIndex";
import { useRef } from "react";
import { usePanelDrag } from "../floating/usePanelDrag";
import { DragGrip } from "../floating/DragGrip";
import { Lock } from "lucide-react";

function greetingFor(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function formatDate(date: Date, mode: "long" | "short" | "numeric") {
  const opts: Intl.DateTimeFormatOptions =
    mode === "long"
      ? { weekday: "long", month: "long", day: "numeric" }
      : mode === "short"
        ? { weekday: "short", month: "short", day: "numeric" }
        : { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Intl.DateTimeFormat(undefined, opts).format(date);
}

export function Clock() {
  const settings = useStore((s) => s.persist.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [now, setNow] = useState(() => new Date());
  const [hover, setHover] = useState(false);
  const viewport = useViewportSize();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  usePanelDrag(ref, {
    getPanel: () => ref.current,
    onEnd: (x, y) => updateSettings({ clockPosition: { x, y } }),
    disabled: settings.clockLocked,
  });

  if (!settings.showClock && !settings.showDate) return null;

  const hours24 = now.getHours();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: settings.clockFormat === "12h",
  }).format(now);
  const [timeMain, meridiem] = settings.clockFormat === "12h" ? time.split(/\s+/) : [time, undefined];
  const greeting = settings.username ? `${greetingFor(hours24)}, ${settings.username}` : greetingFor(hours24);
  const dateStr = formatDate(now, settings.dateFormat);

  const width = Math.min(640, Math.max(300, settings.clockSize * 4.2));
  const height = settings.clockSize * 1.05 + 58;

  const pos = resolvePosition(settings.clockPosition, width, height, viewport);

  return (
    <div
      ref={ref}
      data-floating-root="clock"
      className="group/clock fixed z-10 select-none"
      style={{ left: pos.x, top: pos.y, width, touchAction: "none", cursor: settings.clockLocked ? "default" : "auto" }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div className="mb-2 flex" style={{ paddingLeft: 6 }}>
        <DragGrip locked={settings.clockLocked} className="size-6 text-mist-300" />
      </div>
      {settings.showClock && (
        <div className="flex items-start gap-2">
          <span
            className="font-serif italic leading-[0.86] tracking-[-0.025em] text-mist-100/[0.94]"
            style={{
              fontSize: settings.clockSize,
              textShadow: "0 4px 50px rgba(0,0,0,0.4)",
              fontVariantNumeric: "lining-nums tabular-nums",
            }}
          >
            {timeMain}
          </span>
          {meridiem && (
            <span
              className="mt-[0.3em] font-sans font-medium uppercase tracking-[0.2em] text-mist-500"
              style={{ fontSize: Math.max(11, settings.clockSize * 0.13) }}
            >
              {meridiem}
            </span>
          )}
        </div>
      )}
      {(settings.showDate || (settings.clockGreeting && settings.username)) && (
        <div className="mt-3 flex items-center gap-3" style={{ paddingLeft: 6 }}>
          <span className="h-px w-9 bg-white/25" />
          {settings.showDate && (
            <span className="text-[11px] font-medium uppercase tracking-[0.32em] text-mist-300/90">{dateStr}</span>
          )}
          <span className="text-[10px] uppercase tracking-[0.28em] text-mist-600">
            {settings.clockGreeting ? greeting : ""}
          </span>
        </div>
      )}
      <div
        className="absolute -right-7 top-1 transition-opacity duration-200"
        style={{ opacity: hover && settings.clockLocked ? 1 : 0 }}
      >
        <Lock size={11} className="text-mist-500" />
      </div>
    </div>
  );
}

