import type { DetectedApp, Category } from "../types";

interface Rule {
  categoryId: string;
  words: string[];
}

/**
 * Heuristic auto-categorization for newly detected apps. Just a suggestion —
 * the user reviews it; manual assignments are never overwritten.
 */
const RULES: Rule[] = [
  {
    categoryId: "games",
    words: ["steam", "epic games", "gog galaxy", "battle.net", "riot", "origin", "ea app", "ubisoft", "xbox", "minecraft", "roblox", "valorant", "league of legends", "cs2", "dota", "unity hub"],
  },
  {
    categoryId: "development",
    words: ["visual studio", "vs code", "code.exe", "cursor", "jetbrains", "intellij", "pycharm", "webstorm", "goland", "rider", "clion", "phpstorm", "android studio", "postman", "insomnia", "git", "github", "sourcetree", "fork", "docker", "xampp", "node", "python", "terminal", "powershell", "windows terminal", "putty", "winscp", "dbeaver", "sql", "unity", "unreal", "godot", "neovim", "sublime", "notepad++", "wireshark", "fiddler"],
  },
  {
    categoryId: "design",
    words: ["photoshop", "illustrator", "indesign", "figma", "affinity", "blender", "aseprite", "krita", "gimp", "inkscape", "clip studio", "lightroom", "premiere", "after effects", "xd", "sketch", "canva", "obs studio", "davinci", "audacity", "fl studio", "ableton"],
  },
  {
    categoryId: "productivity",
    words: ["word", "excel", "powerpoint", "onenote", "outlook", "notion", "obsidian", "todoist", "evernote", "ticktick", "acrobat", "pdf", "slack", "teams", "zoom", "discord", "telegram", "whatsapp", "clickup", "trello", "asana", "monday", "calendar", "mail"],
  },
  {
    categoryId: "browsers",
    words: ["chrome", "firefox", "edge", "brave", "opera", "vivaldi", "thorium", "tor browser", "librewolf", "zen browser", "arc"],
  },
  {
    categoryId: "media",
    words: ["spotify", "vlc", "mpv", "iina", "foobar", "musicbee", "apple music", "netflix", "prime video", "disney", "plex", "kodi", "stremio", "potplayer", "media player", "itunes", "aimp", "tidal", "youtube"],
  },
  {
    categoryId: "utilities",
    words: ["7-zip", "winrar", "everything", "powertoys", "ccleaner", "defraggler", "recuva", "snip", "snipping", "calculator", "paint", "screenshot", "sharex", "greenshot", "rufus", "balenaetcher", "cpu-z", "gpu-z", "hwmonitor", "speccy", "crystaldisk", "task manager", "settings", "control panel", "character map", "disk cleanup"],
  },
];

export function suggestCategory(app: DetectedApp, categories: Category[]): Category | null {
  const haystack = `${app.displayName} ${app.name} ${app.executableName ?? ""} ${app.executablePath ?? ""} ${app.publisher ?? ""}`.toLowerCase();
  const available = new Set(categories.map((c) => c.id));
  let best: { id: string; score: number } | null = null;
  for (const rule of RULES) {
    if (!available.has(rule.categoryId)) continue;
    let score = 0;
    for (const word of rule.words) {
      if (haystack.includes(word)) score += word.length > 6 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: rule.categoryId, score };
  }
  return best ? (categories.find((c) => c.id === best!.id) ?? null) : null;
}

export function suggestCategories(apps: DetectedApp[], categories: Category[]): Map<string, Category> {
  const out = new Map<string, Category>();
  for (const app of apps) {
    const cat = suggestCategory(app, categories);
    if (cat) out.set(app.id, cat);
  }
  return out;
}
