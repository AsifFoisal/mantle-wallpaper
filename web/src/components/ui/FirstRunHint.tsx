import { AnimatePresence, motion } from "motion/react";
import { X, Layers } from "lucide-react";
import { useStore } from "../../state/store";

/**
 * One-time, dismissible nudge that teaches the wallpaper's interaction model
 * without adding permanent chrome. Never blocks the wallpaper.
 */
export function FirstRunHint({ visible, onOpen }: { visible: boolean; onOpen: () => void }) {
  const dismiss = useStore((s) => s.updateSettings);
  const searchOpen = useStore((s) => s.searchOpen);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const show = visible && !searchOpen && !settingsOpen;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1], delay: 0.6 }}
          className="fixed left-[260px] top-[30%] z-20 max-w-[330px]"
        >
          <div className="glass relative rounded-2xl px-4 pb-3.5 pt-3.5">
            <button
              aria-label="Dismiss"
              onClick={() => {
                useStore.setState((s) => ({ persist: { ...s.persist, onboardingDismissed: true } }));
                dismiss({});
              }}
              className="absolute right-2.5 top-2.5 text-mist-600 hover:text-mist-300"
            >
              <X size={12} />
            </button>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.26em] text-champagne-300/80">
              <Layers size={11} /> Your desktop
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-mist-300">
              Your applications were organized into floating collections. Open them from the dock, or
              <kbd className="mx-1 rounded border border-white/10 px-1 py-px text-[10px] text-mist-300">Ctrl K</kbd>
              to search everything. Drag any panel where you like — it stays there.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={onOpen}
                className="rounded-lg border border-champagne-400/30 bg-champagne-400/90 px-2.5 py-1 text-[11px] font-medium text-ink-950 hover:bg-champagne-300"
              >
                Show me
              </button>
              <button
                onClick={() => useStore.setState((s) => ({ persist: { ...s.persist, onboardingDismissed: true } }))}
                className="rounded-lg px-2 py-1 text-[11px] text-mist-500 hover:text-mist-300"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
