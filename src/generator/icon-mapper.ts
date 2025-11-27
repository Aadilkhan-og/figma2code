/**
 * Icon Mapper - Maps Figma icon nodes to lucide-react icons
 *
 * This mapper analyzes icon node names and properties to find
 * the best matching icon from the lucide-react library.
 */

import type { IRNode } from '../types/ir.js';

/**
 * Common icon name mappings from Figma naming conventions to lucide-react
 */
const ICON_NAME_MAPPINGS: Record<string, string> = {
  // Navigation
  'home': 'Home',
  'menu': 'Menu',
  'hamburger': 'Menu',
  'close': 'X',
  'x': 'X',
  'back': 'ArrowLeft',
  'forward': 'ArrowRight',
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'arrow-up': 'ArrowUp',
  'arrow-down': 'ArrowDown',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  'chevron-up': 'ChevronUp',
  'chevron-down': 'ChevronDown',

  // Actions
  'search': 'Search',
  'filter': 'Filter',
  'settings': 'Settings',
  'edit': 'Edit',
  'delete': 'Trash2',
  'trash': 'Trash2',
  'add': 'Plus',
  'plus': 'Plus',
  'minus': 'Minus',
  'check': 'Check',
  'checkmark': 'Check',
  'download': 'Download',
  'upload': 'Upload',
  'share': 'Share2',
  'copy': 'Copy',
  'save': 'Save',
  'refresh': 'RefreshCw',
  'reload': 'RefreshCw',

  // User & Social
  'user': 'User',
  'profile': 'User',
  'avatar': 'User',
  'users': 'Users',
  'team': 'Users',
  'heart': 'Heart',
  'like': 'Heart',
  'star': 'Star',
  'favorite': 'Star',
  'bell': 'Bell',
  'notification': 'Bell',
  'message': 'MessageSquare',
  'chat': 'MessageSquare',
  'mail': 'Mail',
  'email': 'Mail',

  // Media & Files
  'image': 'Image',
  'photo': 'Image',
  'camera': 'Camera',
  'video': 'Video',
  'play': 'Play',
  'pause': 'Pause',
  'stop': 'Square',
  'file': 'File',
  'document': 'FileText',
  'folder': 'Folder',
  'attachment': 'Paperclip',

  // UI Elements
  'eye': 'Eye',
  'eye-off': 'EyeOff',
  'visible': 'Eye',
  'hidden': 'EyeOff',
  'lock': 'Lock',
  'unlock': 'Unlock',
  'info': 'Info',
  'help': 'HelpCircle',
  'question': 'HelpCircle',
  'warning': 'AlertTriangle',
  'alert': 'AlertCircle',
  'error': 'XCircle',
  'success': 'CheckCircle',

  // Shopping & Business
  'cart': 'ShoppingCart',
  'shopping-cart': 'ShoppingCart',
  'bag': 'ShoppingBag',
  'shopping-bag': 'ShoppingBag',
  'credit-card': 'CreditCard',
  'payment': 'CreditCard',
  'dollar': 'DollarSign',
  'currency': 'DollarSign',

  // Time & Calendar
  'calendar': 'Calendar',
  'clock': 'Clock',
  'time': 'Clock',
  'timer': 'Timer',

  // Location & Map
  'location': 'MapPin',
  'pin': 'MapPin',
  'map': 'Map',
  'navigation': 'Navigation',
  'compass': 'Compass',

  // Tech & Development
  'code': 'Code',
  'terminal': 'Terminal',
  'command': 'Terminal',
  'database': 'Database',
  'server': 'Server',
  'cloud': 'Cloud',
  'link': 'Link',
  'external-link': 'ExternalLink',
  'github': 'Github',

  // Status & Indicators
  'loading': 'Loader',
  'spinner': 'Loader',
  'more': 'MoreVertical',
  'more-vertical': 'MoreVertical',
  'more-horizontal': 'MoreHorizontal',
  'ellipsis': 'MoreHorizontal',

  // Layout & Design
  'layout': 'Layout',
  'grid': 'Grid',
  'list': 'List',
  'columns': 'Columns',
  'maximize': 'Maximize2',
  'minimize': 'Minimize2',
  'fullscreen': 'Maximize2',
};

/**
 * Category-based icon suggestions
 */
const ICON_CATEGORIES: Record<string, string[]> = {
  navigation: ['Home', 'Menu', 'ArrowLeft', 'ArrowRight', 'ChevronLeft', 'ChevronRight'],
  action: ['Plus', 'Edit', 'Trash2', 'Save', 'Download', 'Upload'],
  user: ['User', 'Users', 'Heart', 'Star', 'Bell'],
  media: ['Image', 'Camera', 'Video', 'Play', 'Pause'],
  communication: ['Mail', 'MessageSquare', 'Phone'],
  file: ['File', 'FileText', 'Folder', 'Paperclip'],
  ui: ['Eye', 'Lock', 'Info', 'AlertCircle', 'CheckCircle'],
};

export class IconMapper {
  /**
   * Map an icon node to a lucide-react icon
   */
  mapIcon(node: IRNode): string | null {
    if (node.componentType !== 'ICON') {
      return null;
    }

    // If iconName is already set, use it
    if (node.iconName) {
      return this.normalizeLucideIconName(node.iconName);
    }

    // Try to extract icon name from node name
    const iconName = this.extractIconNameFromNodeName(node.name);
    if (iconName) {
      return iconName;
    }

    // Fall back to a generic icon
    return 'Circle';
  }

  /**
   * Extract icon name from Figma node name
   * Examples:
   *   "icon/home" -> "Home"
   *   "home-icon" -> "Home"
   *   "icon-search" -> "Search"
   *   "UserProfile" -> "User"
   */
  private extractIconNameFromNodeName(nodeName: string): string | null {
    // Normalize the name: lowercase, remove prefixes/suffixes
    const normalized = nodeName
      .toLowerCase()
      .replace(/^(icon|ico|ic)[_-]?/gi, '') // Remove icon prefix
      .replace(/[_-]?(icon|ico|ic)$/gi, '') // Remove icon suffix
      .replace(/[_-]/g, '-') // Normalize separators
      .trim();

    // Direct mapping lookup
    if (ICON_NAME_MAPPINGS[normalized]) {
      return ICON_NAME_MAPPINGS[normalized];
    }

    // Try partial matches
    for (const [key, value] of Object.entries(ICON_NAME_MAPPINGS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Try to match by category keywords
    for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
      if (normalized.includes(category) && icons.length > 0) {
        return icons[0]; // Return first icon from category
      }
    }

    // If we still haven't found a match, capitalize the name and hope lucide-react has it
    return this.normalizeLucideIconName(normalized) || null;
  }

  /**
   * Normalize a name to match lucide-react naming convention
   * Examples:
   *   "home" -> "Home"
   *   "arrow-left" -> "ArrowLeft"
   *   "user_profile" -> "UserProfile"
   */
  private normalizeLucideIconName(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Get all available icon mappings (for debugging/testing)
   */
  getAvailableMappings(): Record<string, string> {
    return { ...ICON_NAME_MAPPINGS };
  }

  /**
   * Add custom icon mapping
   */
  addCustomMapping(figmaName: string, lucideIcon: string): void {
    ICON_NAME_MAPPINGS[figmaName.toLowerCase()] = lucideIcon;
  }

  /**
   * Traverse IR tree and map all icons
   */
  mapIconsInTree(node: IRNode): void {
    // Map this node if it's an icon
    if (node.componentType === 'ICON') {
      const mappedIcon = this.mapIcon(node);
      if (mappedIcon) {
        node.iconName = mappedIcon;
      }
    }

    // Recursively map children
    if (node.children) {
      for (const child of node.children) {
        this.mapIconsInTree(child);
      }
    }
  }
}
