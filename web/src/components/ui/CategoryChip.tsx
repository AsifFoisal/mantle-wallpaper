import { useStore } from "../../state/store";
import type { Category, CategoryIcon } from "../../types";
import { CategoryGlyph } from "../ui/CategoryGlyph";

export function glyphFor(icon: CategoryIcon, size = 14) {
  return <CategoryGlyph icon={icon} size={size} strokeWidth={1.7} />;
}

/** Emits a compact, rounded 44px tile (a "chip") for a category. */
export function CategoryChip({
  category,
  onOpen,
  onContextMenu,
  active,
  size = 40,
  showLabel = false,
}: {
  category: Category;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
  size?: number;
  showLabel?: boolean;
}) {
  const count = useStore((s) =>
    Object.values(s.persist.appOverrides).filter((o) => o.categories?.includes(category.id)).length,
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      title={`${category.name}${count ? ` · ${count}` : ""}`}
      className="group relative grid place-items-center rounded-2xl transition-colors duration-200"
      style={{ width: size, height: size }}
    >
      <span
        className="grid place-items-center rounded-[30%] transition-all duration-200 group-hover:scale-105"
        style={{
          width: size * 0.84,
          height: size * 0.84,
          color: category.color,
          background: `color-mix(in oklab, ${category.color} 16%, transparent)`,
          border: `1px solid color-mix(in oklab, ${category.color} 28%, transparent)`,
          boxShadow: active ? `0 0 0 2px color-mix(in oklab, ${category.color} 50%, transparent)` : undefined,
        }}
      >
        {glyphFor(category.icon, Math.round(size * 0.4))}
      </span>
      {showLabel && (
        <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.14em] text-mist-300">
          {category.name}
        </span>
      )}
      {count === 0 && (
        <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-white/25" aria-label="Empty" />
      )}
    </button>
  );
}
