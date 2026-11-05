import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

interface BackgroundProps {
  mode: "ambient" | "gradient" | "image";
  imageDataUrl: string | null;
  imageFit: "cover" | "contain";
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  intensity: number;
  animate: boolean;
}

/** Deterministic PRNG so stars don't reshuffle on every reload. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  size: number;
  cls: string;
  delay: number;
  dur: number;
}

function buildStars(vw: number, vh: number, count: number): Star[] {
  const rand = mulberry32(1337);
  const stars: Star[] = [];
  const classes = ["twinkle-a", "twinkle-b", "twinkle-c"];
  for (let i = 0; i < count; i++) {
    const r = rand();
    stars.push({
      x: rand() * vw,
      y: rand() * vh,
      size: r > 0.94 ? 1.6 : r > 0.7 ? 1.1 : 0.8,
      cls: classes[Math.floor(rand() * classes.length)],
      delay: rand() * -30,
      dur: 6 + rand() * 14,
    });
  }
  return stars;
}

export function Background({
  mode,
  imageDataUrl,
  imageFit,
  gradientFrom,
  gradientTo,
  gradientAngle,
  intensity,
  animate,
}: BackgroundProps) {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSize({ w: window.innerWidth, h: window.innerHeight }));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const starCount = Math.round(Math.min(170, Math.max(0, (size.w * size.h) / 16000)) * (intensity / 100));
  const stars = useMemo(() => buildStars(size.w, size.h, starCount), [size.w, size.h, starCount]);
  const k = intensity / 100;

  if (mode === "image" && imageDataUrl) {
    return (
      <div className="fixed inset-0 z-0 overflow-hidden bg-ink-950">
        <img
          src={imageDataUrl}
          alt=""
          draggable={false}
          className={`h-full w-full ${imageFit === "cover" ? "object-cover" : "object-contain"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20" />
      </div>
    );
  }

  if (mode === "gradient") {
    return (
      <div
        className="fixed inset-0 z-0"
        style={{ background: `linear-gradient(${gradientAngle}deg, ${gradientFrom}, ${gradientTo})` }}
      >
        <div className="wallpaper-grain absolute inset-0" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-ink-950">
      {/* Deep base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 18% 18%, #232c55 0%, transparent 62%), radial-gradient(90% 80% at 88% 82%, #2c2149 0%, transparent 66%), #0a0b10",
        }}
      />

      {/* Nebula blobs */}
      <motion.div
        aria-hidden
        className="absolute -left-[18%] -top-[22%] h-[110vmax] w-[110vmax] rounded-full"
        style={{
          background: "radial-gradient(closest-side, rgba(92,110,220,0.95), rgba(26,31,58,0.26) 55%, transparent 78%)",
          filter: "blur(50px)",
          opacity: 0.85 * k + 0.3,
          willChange: "transform",
        }}
        animate={animate ? { x: ["-3%", "5%", "-3%"], y: ["-2%", "4%", "-2%"], scale: [1, 1.1, 1] } : undefined}
        transition={{ duration: 72, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-[35%] left-[10%] h-[100vmax] w-[100vmax] rounded-full"
        style={{
          background: "radial-gradient(closest-side, rgba(140,92,205,0.8), rgba(42,29,64,0.2) 55%, transparent 78%)",
          filter: "blur(60px)",
          opacity: 0.85 * k + 0.26,
          willChange: "transform",
        }}
        animate={animate ? { x: ["2%", "-4%", "2%"], y: ["1%", "-3%", "1%"], scale: [1.04, 0.96, 1.04] } : undefined}
        transition={{ duration: 94, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -right-[22%] top-[2%] h-[85vmax] w-[85vmax] rounded-full"
        style={{
          background: "radial-gradient(closest-side, rgba(34,110,104,0.8), rgba(14,34,38,0.18) 55%, transparent 78%)",
          filter: "blur(65px)",
          opacity: 0.8 * k + 0.22,
          willChange: "transform",
        }}
        animate={animate ? { x: ["1%", "-3%", "1%"], y: ["-2%", "3%", "-2%"], scale: [1, 1.08, 1] } : undefined}
        transition={{ duration: 86, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Colour bloom: soft glows that guarantee the nebula reads on any panel */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(40vmax 36vmax at 24% 28%, rgba(112,130,240,0.42), transparent 70%), radial-gradient(38vmax 34vmax at 76% 66%, rgba(158,102,214,0.32), transparent 70%), radial-gradient(30vmax 26vmax at 58% 100%, rgba(40,140,130,0.24), transparent 70%)",
          opacity: 0.5 + 0.5 * k,
          filter: "blur(30px)",
        }}
      />

      {/* Stars */}
      <div className="absolute inset-0" aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            className={`absolute rounded-full bg-white ${animate ? s.cls : ""}`}
            style={{
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              opacity: animate ? undefined : 0.35,
              animationDelay: animate ? `${s.delay}s` : undefined,
              animationDuration: animate ? `${s.dur}s` : undefined,
              boxShadow: s.size > 1.5 ? "0 0 4px rgba(255,255,255,0.6)" : undefined,
            }}
          />
        ))}
      </div>

      {/* Vignette + grain so the dark never bands */}
      <div
        className="absolute inset-0"
        
      />
      <div className="wallpaper-grain absolute inset-0" />
    </div>
  );
}
