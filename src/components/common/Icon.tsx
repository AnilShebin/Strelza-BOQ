import React from 'react';
import {
  Save,
  PanelLeft,
  PanelRight,
  ChevronsUpDown,
  LayoutDashboard,
  Home,
  DollarSign,
  Scale,
  BarChart2,
  Bookmark,
  LayoutGrid,
  StickyNote,
  Paperclip,
  Layers,
  Moon,
  Sun,
  Settings,
  Upload,
  Download,
  Pencil,
  MousePointer,
  Hand,
  RotateCw,
  Type,
  Highlighter,
  Underline,
  Strikethrough,
  Square,
  Circle,
  Cloud,
  ArrowUpRight,
  Minus,
  Stamp,
  Folder,
  Clipboard,
  Radio,
  Antenna,
  Warehouse,
  Activity,
  Construction,
  Network,
  Car,
  MoreVertical,
  MoreHorizontal,
  Undo2,
  Redo2,
  Share,
  ChevronDown,
  ChevronUp,
  Search,
  HelpCircle,
  Bell,
  ArrowLeft,
  ArrowRight,
  Layout,
  MessageSquare,
  Maximize2,
  Plus,
  Sparkles,
  X,
  Trash2,
  Grid,
  File,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Check,
  FileText,
  List,
  ListTodo,
  Info,
  Send,
  Menu,
  Filter,
  Maximize,
  Scaling,
  Tag,
  Sliders,
  RefreshCw,
  Cpu,
  Box,
  Edit2,
} from 'lucide-react';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** SVG icon tag key. */
  name: string;
  /** Width/Height dimension in pixels. */
  size?: number | string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  'save': Save,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  'chevrons-up-down': ChevronsUpDown,
  'dashboard': LayoutDashboard,
  'home': Home,
  'price-list': DollarSign,
  'comparisons': Scale,
  'reports': BarChart2,
  'bookmarks': Bookmark,
  'thumbnails': LayoutGrid,
  'notes': StickyNote,
  'attachments': Paperclip,
  'layers': Layers,
  'moon': Moon,
  'sun': Sun,
  'settings': Settings,
  'upload': Upload,
  'download': Download,
  'edit': Pencil,
  'select': MousePointer,
  'hand': Hand,
  'rotate-cw': RotateCw,
  'text': Type,
  'highlight': Highlighter,
  'underline': Underline,
  'strikethrough': Strikethrough,
  'rectangle': Square,
  'circle': Circle,
  'cloud-drawing': Cloud,
  'arrow': ArrowUpRight,
  'line': Minus,
  'stamp': Stamp,
  'folder': Folder,
  'clipboard': Clipboard,
  'tower': Radio,
  'antenna-dish': Antenna,
  'shelter': Warehouse,
  'wave': Activity,
  'crane': Construction,
  'misc-nodes': Network,
  'car': Car,
  'more': MoreVertical,
  'more-horizontal': MoreHorizontal,
  'cloud': Cloud,
  'undo': Undo2,
  'redo': Redo2,
  'share': Share,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'search': Search,
  'help': HelpCircle,
  'bell': Bell,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'layout-single': Layout,
  'comment-bubble': MessageSquare,
  'fullscreen': Maximize2,
  'plus': Plus,
  'minus': Minus,
  'sparkles': Sparkles,
  'close': X,
  'trash': Trash2,
  'grid': Grid,
  'document': File,
  'headphones': Headphones,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'check': Check,
  'file-text': FileText,
  'bullet-list': List,
  'action-list': ListTodo,
  'explain': Info,
  'send': Send,
  'menu': Menu,
  'filter': Filter,
  'collapse': ChevronLeft,
  'fit-page': Maximize,
  'fit-width': Scaling,
  'tag': Tag,
  'sliders': Sliders,
  'refresh': RefreshCw,
  'refresh-cw': RefreshCw,
  'cpu': Cpu,
  'box': Box,
  'edit-2': Edit2,
  'trash-2': Trash2,
  'x': X,
};

/**
 * Large Registry of standard interface SVG Icons powered by Lucide React.
 */
export const Icon: React.FC<IconProps> = ({ name, size = 18, className = '', ...props }) => {
  if (name === 'logo') {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{
          width: size,
          height: size,
          color: 'inherit',
        }}
        {...props}
      >
        <svg viewBox="0 0 261.1 261.1" fill="none" xmlns="http://www.w3.org/2000/svg">
          <style>{`
            .cls-2 { fill: #f27e20; }
            .cls-3 { fill: #1f376a; }
            .dark .cls-3 { fill: #fff3ea; }
          `}</style>
          <rect className="cls-1" width="261.1" height="261.1"/>
          <g>
            <g>
              <path className="cls-2" d="M119.99,114.86s-3.31-8.81,2.54-22.93c5.85-14.12,22.1-36.57,22.1-36.57,0,0-4.38,27.36-10.23,41.49-5.85,14.12-14.42,18.01-14.42,18.01Z"/>
              <path className="cls-2" d="M107.73,114.86s-8.57-3.89-14.42-18.01c-5.85-14.12-10.23-41.49-10.23-41.49,0,0,16.25,22.45,22.1,36.57,5.85,14.12,2.54,22.93,2.54,22.93Z"/>
              <path className="cls-2" d="M99.06,123.53s-8.81,3.31-22.93-2.54c-14.12-5.85-36.57-22.1-36.57-22.1,0,0,27.36,4.38,41.49,10.23,14.12,5.85,18.01,14.42,18.01,14.42Z"/>
              <path className="cls-2" d="M99.06,135.79s-3.89,8.57-18.01,14.42c-14.12,5.85-41.49,10.23-41.49,10.23,0,0,22.45-16.25,36.57-22.1,14.12-5.85,22.93-2.54,22.93-2.54Z"/>
            </g>
            <path className="cls-3" d="M115.89,162.44h0s.12-.02.16-.04t.01,0c8.51-2.27,17.88-3.37,26.95-2.89-14.36,16.91-40.07,20.38-58.64,30.97-4.54,2.59-8.97,9.16-12.45,15.27h-1.85c27.01-66.13,83.39-118.81,151.46-140.87-.64.71-41.85,46.14-71.14,84.46-12.36,2.45-23.92,7.05-34.5,13.11Z"/>
          </g>
        </svg>
      </span>
    );
  }

  const LucideIcon = iconMap[name];
  if (!LucideIcon) {
    console.warn(`[Icon] Icon name "${name}" not found in mapping.`);
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        color: 'inherit',
      }}
      {...props}
    >
      <LucideIcon size={size} strokeWidth={2} />
    </span>
  );
};
