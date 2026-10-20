import {
  Anchor,
  Bot,
  Box,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Camera,
  ChartColumn,
  Cloud,
  Code,
  Coffee,
  Compass,
  Cpu,
  Database,
  Dumbbell,
  Flag,
  Flame,
  FlaskConical,
  Folder,
  FolderGit2,
  Gamepad2,
  Gem,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  House,
  Key,
  Layers,
  Leaf,
  Lightbulb,
  type LucideIcon,
  Map as MapIcon,
  Megaphone,
  MessagesSquare,
  Moon,
  Mountain,
  Music,
  Newspaper,
  Package,
  Palette,
  Plane,
  Puzzle,
  Rocket,
  Server,
  Shapes,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Target,
  Terminal,
  Trophy,
  Users,
  Utensils,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-solid'

/**
 * The icons a workspace or a project may choose for itself.
 *
 * A curated set rather than the whole Lucide catalogue, for two reasons the
 * picker depends on: the keys are persisted, so each one is a promise that the
 * glyph keeps existing, and every icon here is imported by name so a consumer's
 * bundle pays for these few dozen glyphs and not for the library.
 *
 * `home`, `box` and `folder` lead the list because they are the defaults the
 * apps already use: Home workspaces carry `home`, other workspaces `box` and
 * projects `folder`. Keys are lowercase kebab-case so they are valid project
 * `iconKey`s as well as workspace logo values.
 */
export const shellIconEntries = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'box', label: 'Box', icon: Box },
  { key: 'folder', label: 'Folder', icon: Folder },
  { key: 'git-folder', label: 'Repository', icon: FolderGit2 },
  { key: 'briefcase', label: 'Briefcase', icon: Briefcase },
  { key: 'building', label: 'Building', icon: Building2 },
  { key: 'users', label: 'Team', icon: Users },
  { key: 'rocket', label: 'Rocket', icon: Rocket },
  { key: 'star', label: 'Star', icon: Star },
  { key: 'heart', label: 'Heart', icon: Heart },
  { key: 'code', label: 'Code', icon: Code },
  { key: 'terminal', label: 'Terminal', icon: Terminal },
  { key: 'cpu', label: 'Chip', icon: Cpu },
  { key: 'server', label: 'Server', icon: Server },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'cloud', label: 'Cloud', icon: Cloud },
  { key: 'globe', label: 'Globe', icon: Globe },
  { key: 'bot', label: 'Agent', icon: Bot },
  { key: 'brain', label: 'Brain', icon: Brain },
  { key: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { key: 'lightbulb', label: 'Idea', icon: Lightbulb },
  { key: 'flask', label: 'Lab', icon: FlaskConical },
  { key: 'book', label: 'Book', icon: BookOpen },
  { key: 'graduation', label: 'Study', icon: GraduationCap },
  { key: 'newspaper', label: 'News', icon: Newspaper },
  { key: 'megaphone', label: 'Marketing', icon: Megaphone },
  { key: 'chart', label: 'Chart', icon: ChartColumn },
  { key: 'wallet', label: 'Finance', icon: Wallet },
  { key: 'cart', label: 'Shop', icon: ShoppingCart },
  { key: 'package', label: 'Package', icon: Package },
  { key: 'layers', label: 'Layers', icon: Layers },
  { key: 'puzzle', label: 'Puzzle', icon: Puzzle },
  { key: 'shield', label: 'Security', icon: Shield },
  { key: 'key', label: 'Key', icon: Key },
  { key: 'wrench', label: 'Tools', icon: Wrench },
  { key: 'hammer', label: 'Build', icon: Hammer },
  { key: 'zap', label: 'Bolt', icon: Zap },
  { key: 'flame', label: 'Flame', icon: Flame },
  { key: 'target', label: 'Target', icon: Target },
  { key: 'trophy', label: 'Trophy', icon: Trophy },
  { key: 'flag', label: 'Flag', icon: Flag },
  { key: 'compass', label: 'Compass', icon: Compass },
  { key: 'map', label: 'Map', icon: MapIcon },
  { key: 'plane', label: 'Travel', icon: Plane },
  { key: 'anchor', label: 'Anchor', icon: Anchor },
  { key: 'mountain', label: 'Mountain', icon: Mountain },
  { key: 'leaf', label: 'Garden', icon: Leaf },
  { key: 'sun', label: 'Sun', icon: Sun },
  { key: 'moon', label: 'Moon', icon: Moon },
  { key: 'palette', label: 'Design', icon: Palette },
  { key: 'camera', label: 'Camera', icon: Camera },
  { key: 'music', label: 'Music', icon: Music },
  { key: 'gamepad', label: 'Games', icon: Gamepad2 },
  { key: 'coffee', label: 'Coffee', icon: Coffee },
  { key: 'utensils', label: 'Kitchen', icon: Utensils },
  { key: 'dumbbell', label: 'Gym', icon: Dumbbell },
  { key: 'gem', label: 'Gem', icon: Gem },
  { key: 'messages', label: 'Chat', icon: MessagesSquare },
  { key: 'shapes', label: 'Shapes', icon: Shapes },
] as const satisfies readonly Readonly<{ key: string; label: string; icon: LucideIcon }>[]

export type ShellIconKey = (typeof shellIconEntries)[number]['key']

const shellIconByKey: ReadonlyMap<string, LucideIcon> = new Map(
  shellIconEntries.map((entry) => [entry.key, entry.icon])
)

/** Whether a stored string names an icon in the curated set. */
export function isShellIconKey(value: string): value is ShellIconKey {
  return shellIconByKey.has(value)
}

/**
 * The glyph for a stored key, or `fallback` when the key is not in the set.
 * Callers pass the fallback their surface wants (a workspace falls back to
 * `box`, a project to `folder`), so an unknown key degrades to the default
 * rather than to an empty tile.
 */
export function resolveShellIcon(
  key: string | null | undefined,
  fallback: ShellIconKey = 'folder'
): LucideIcon {
  return (key ? shellIconByKey.get(key) : undefined) ?? shellIconByKey.get(fallback)!
}

/** The picker's accessible name for a key. */
export function shellIconLabel(key: string): string {
  return shellIconEntries.find((entry) => entry.key === key)?.label ?? key
}
