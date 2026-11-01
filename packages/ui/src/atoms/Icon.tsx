/**
 * Icon atom (component-library.md §Icon).
 * Lucide icons, 1.5px stroke, currentColor, paired with aria-label or
 * marked decorative.
 *
 * Icons come from a curated static map instead of lucide's full `icons`
 * index: the index defeats tree-shaking and ships every icon (~120 KB
 * gzipped), which alone blows the app-chunk budget (CONTRIBUTING.md
 * §Performance). Add icons here as screens need them — each costs only
 * its own module.
 */
import {
  AlertCircle,
  Archive,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Combine,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  File,
  FileImage,
  FileOutput,
  FileSpreadsheet,
  FileText,
  FileType,
  Filter,
  Shrink,
  Split,
  StickyNote,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  HardDrive,
  Hash,
  Heart,
  Home,
  Images,
  Info,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  Menu,
  Mic,
  Move,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  RotateCw,
  Rows3,
  Scan,
  Scissors,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  SquareCheck,
  Stamp,
  Star,
  Tag,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

/** Curated Lucide subset (add icons as features need them). */
const ICONS = {
  AlertCircle,
  Archive,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Combine,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  File,
  FileImage,
  FileOutput,
  FileSpreadsheet,
  FileText,
  FileType,
  Filter,
  Shrink,
  Split,
  StickyNote,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  HardDrive,
  Hash,
  Heart,
  Home,
  Images,
  Info,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  Menu,
  Mic,
  Move,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  RotateCw,
  Rows3,
  Scan,
  Scissors,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  SquareCheck,
  Stamp,
  Star,
  Tag,
  Trash2,
  Unlock,
  Upload,
  X,
} as const;

/** Name of a curated Lucide icon (PascalCase, e.g. "FileText"). */
export type IconName = keyof typeof ICONS;

/** Props for {@link Icon}. */
export interface IconProps {
  /** Icon identifier from the curated Lucide set. */
  name: IconName;
  /** Icon size in pixels (token sizes: 16/20/24/32/48). */
  size?: 16 | 20 | 24 | 32 | 48;
  /** Icon color — defaults to the surrounding text color. */
  color?: string;
  /** Stroke width (Lucide default per design system). */
  strokeWidth?: number;
  /** Accessible name — required when the icon stands alone. */
  'aria-label'?: string;
}

/** Lucide icon wrapper enforcing the design-system defaults. */
export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.5,
  'aria-label': ariaLabel,
}: IconProps): ReactNode {
  const LucideIcon = ICONS[name];
  return (
    <LucideIcon
      className="kg-icon"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
    />
  );
}
