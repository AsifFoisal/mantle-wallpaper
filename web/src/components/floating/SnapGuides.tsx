import { useEffect, useState } from "react";

/**
 * Full-viewport alignment guides shown while a drag is snapping (champagne
 * hairlines, like a design tool). Fed by `mantle:snap` events from
 * usePanelDrag; an empty detail clears the lines.
 */
export function SnapGuides() {
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});

  useEffect(() => {
    const onSnap = (e: Event) => setGuides((e as CustomEvent<{ v?: number; h?: number }>).detail ?? {});
    window.addEventListener("mantle:snap", onSnap);
    return () => window.removeEventListener("mantle:snap", onSnap);
  }, []);

  return (
    <>
      {guides.v !== undefined && (
        <div
          className="pointer-events-none fixed inset-y-0 z-[80] w-px"
          style={{ left: guides.v, background: "rgba(217,199,163,0.55)", boxShadow: "0 0 6px rgba(217,199,163,0.4)" }}
        />
      )}
      {guides.h !== undefined && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[80] h-px"
          style={{ top: guides.h, background: "rgba(217,199,163,0.55)", boxShadow: "0 0 6px rgba(217,199,163,0.4)" }}
        />
      )}
    </>
  );
}
