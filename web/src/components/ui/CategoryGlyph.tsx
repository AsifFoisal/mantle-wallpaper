import type { Category, CategoryIcon } from "../../types";
import {
  Gamepad2,
  Code2,
  Palette,
  Briefcase,
  Globe,
  Music,
  Wrench,
  Folder,
  Star,
  Sparkles,
  Camera,
  Terminal,
} from "lucide-react";

const ICONS: Record<CategoryIcon, React.ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>> = {
  "gamepad-2": Gamepad2,
  "code-2": Code2,
  palette: Palette,
  briefcase: Briefcase,
  globe: Globe,
  music: Music,
  wrench: Wrench,
  folder: Folder,
  star: Star,
  sparkles: Sparkles,
  camera: Camera,
  terminal: Terminal,
};

export function CategoryGlyph({
  icon,
  size = 14,
  strokeWidth = 1.7,
  className,
}: {
  icon: CategoryIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? Folder;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}

export function categoryGlyph(icon: Category["icon"]) {
  return ICONS[icon] ?? Folder;
}
