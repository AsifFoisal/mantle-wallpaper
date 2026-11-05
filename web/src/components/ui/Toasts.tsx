import { AnimatePresence, motion } from "motion/react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { useStore } from "../../state/store";

const TONE = {
  info: { icon: Info, color: "text-mist-300" },
  success: { icon: Check, color: "text-emerald-300" },
  warn: { icon: TriangleAlert, color: "text-amber-300" },
};

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[320px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const tone = TONE[t.tone];
          const Icon = tone.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="glass pointer-events-auto flex items-start gap-2.5 rounded-2xl px-3.5 py-3"
            >
              <Icon size={14} className={`mt-px shrink-0 ${tone.color}`} strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-mist-100">{t.title}</div>
                {t.detail && <div className="mt-0.5 text-[11px] leading-snug text-mist-500">{t.detail}</div>}
                {t.actionLabel && (
                  <button
                    onClick={() => {
                      t.action?.();
                      dismiss(t.id);
                    }}
                    className="mt-2 rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-mist-200 hover:bg-white/[0.1]"
                  >
                    {t.actionLabel}
                  </button>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 text-mist-600 hover:text-mist-300">
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** A whisper-thin line at the top edge when the desktop bridge is unreachable. */
export function OfflineChip() {
  const backend = useStore((s) => s.backend);
  return (
    <AnimatePresence>
      {backend === "offline" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="pointer-events-none fixed left-1/2 top-3 z-[85] -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-950/25 px-3 py-1 text-[10.5px] tracking-[0.04em] text-amber-100/70 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-amber-400/80" />
            Desktop bridge offline — organizer works, launching paused
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

