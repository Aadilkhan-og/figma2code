/**
 * Tailwind CSS Utility Generator
 * Converts IR styles to TailwindCSS classes
 */

import type { IRNode, Style, AutoLayout, BoundingBox, TypographyToken } from '../types/ir';

/**
 * Tailwind class generator for IR nodes
 */
export class TailwindGenerator {
  private customColors: Map<string, string> = new Map();

  /**
   * Generate all Tailwind classes for a node
   */
  generateClasses(node: IRNode): string[] {
    const classes: string[] = [];

    // Layout classes
    if (node.autoLayout) {
      classes.push(...this.generateLayoutClasses(node.autoLayout));
    }

    // Style classes
    classes.push(...this.generateStyleClasses(node.styles));

    // Typography classes
    if (node.styles.typography) {
      classes.push(...this.generateTypographyClasses(node.styles.typography));
    }

    // Size classes based on bounding box
    classes.push(...this.generateSizeClasses(node.boundingBox, node.autoLayout));

    return classes.filter(Boolean);
  }

  /**
   * Generate layout classes from AutoLayout
   */
  generateLayoutClasses(layout: AutoLayout): string[] {
    const classes: string[] = [];

    // Display mode
    if (layout.mode === 'HORIZONTAL') {
      classes.push('flex', 'flex-row');
    } else if (layout.mode === 'VERTICAL') {
      classes.push('flex', 'flex-col');
    } else if (layout.mode === 'GRID') {
      classes.push('grid');
    }

    // Wrap
    if (layout.wrap) {
      classes.push('flex-wrap');
    }

    // Gap
    if (layout.gap > 0) {
      classes.push(this.mapGap(layout.gap));
    }

    // Primary axis alignment (justify)
    if (layout.primaryAxisAlign) {
      const justifyMap: Record<string, string> = {
        MIN: 'justify-start',
        CENTER: 'justify-center',
        MAX: 'justify-end',
        SPACE_BETWEEN: 'justify-between',
        SPACE_AROUND: 'justify-around',
        SPACE_EVENLY: 'justify-evenly',
      };
      if (justifyMap[layout.primaryAxisAlign]) {
        classes.push(justifyMap[layout.primaryAxisAlign]!);
      }
    }

    // Counter axis alignment (items)
    if (layout.counterAxisAlign) {
      const itemsMap: Record<string, string> = {
        MIN: 'items-start',
        CENTER: 'items-center',
        MAX: 'items-end',
        STRETCH: 'items-stretch',
        BASELINE: 'items-baseline',
      };
      if (itemsMap[layout.counterAxisAlign]) {
        classes.push(itemsMap[layout.counterAxisAlign]!);
      }
    }

    // Padding
    if (layout.padding) {
      classes.push(...this.generatePaddingClasses(layout.padding));
    }

    return classes;
  }

  /**
   * Generate style classes
   */
  generateStyleClasses(styles: Style): string[] {
    const classes: string[] = [];

    // Background color
    if (styles.backgroundColor) {
      classes.push(this.mapBackgroundColor(styles.backgroundColor));
    }

    // Background gradient
    if (styles.backgroundGradient) {
      classes.push(this.mapGradient(styles.backgroundGradient));
    }

    // Border
    if (styles.border) {
      if (styles.border.width > 0) {
        classes.push(this.mapBorderWidth(styles.border.width));
        if (styles.border.color) {
          classes.push(this.mapBorderColor(styles.border.color));
        }
        if (styles.border.style && styles.border.style !== 'solid') {
          classes.push(`border-${styles.border.style}`);
        }
      }
      if (styles.border.radius) {
        classes.push(this.mapBorderRadius(styles.border.radius));
      }
    }

    // Shadows
    if (styles.shadows && styles.shadows.length > 0) {
      classes.push(this.mapShadow(styles.shadows[0]!));
    }

    // Opacity
    if (styles.opacity !== undefined && styles.opacity < 1) {
      classes.push(this.mapOpacity(styles.opacity));
    }

    // Overflow
    if (styles.overflow) {
      classes.push(`overflow-${styles.overflow}`);
    }

    // Cursor
    if (styles.cursor) {
      classes.push(`cursor-${styles.cursor}`);
    }

    return classes;
  }

  /**
   * Generate typography classes
   */
  generateTypographyClasses(typography: TypographyToken): string[] {
    const classes: string[] = [];

    // Font size
    if (typography.fontSize) {
      classes.push(this.mapFontSize(typography.fontSize));
    }

    // Font weight
    if (typography.fontWeight) {
      classes.push(this.mapFontWeight(typography.fontWeight));
    }

    // Line height
    if (typography.lineHeight) {
      classes.push(this.mapLineHeight(typography.lineHeight, typography.fontSize));
    }

    // Letter spacing
    if (typography.letterSpacing) {
      classes.push(this.mapLetterSpacing(typography.letterSpacing));
    }

    // Text decoration
    if (typography.textDecoration) {
      classes.push(this.mapTextDecoration(typography.textDecoration));
    }

    // Text transform
    if (typography.textTransform) {
      classes.push(this.mapTextTransform(typography.textTransform));
    }

    return classes;
  }

  /**
   * Generate size classes
   */
  generateSizeClasses(box: BoundingBox, layout?: AutoLayout): string[] {
    const classes: string[] = [];

    // Only add explicit size if not using auto layout sizing
    if (!layout || layout.mode === 'NONE') {
      if (box.width > 0) {
        classes.push(this.mapWidth(box.width));
      }
      if (box.height > 0) {
        classes.push(this.mapHeight(box.height));
      }
    }

    return classes;
  }

  /**
   * Generate padding classes
   */
  private generatePaddingClasses(padding: { top: number; right: number; bottom: number; left: number }): string[] {
    const classes: string[] = [];

    // Check for uniform padding
    if (padding.top === padding.bottom && padding.left === padding.right) {
      if (padding.top === padding.left && padding.top > 0) {
        classes.push(this.mapPadding(padding.top, 'p'));
      } else {
        if (padding.top > 0) classes.push(this.mapPadding(padding.top, 'py'));
        if (padding.left > 0) classes.push(this.mapPadding(padding.left, 'px'));
      }
    } else {
      if (padding.top > 0) classes.push(this.mapPadding(padding.top, 'pt'));
      if (padding.right > 0) classes.push(this.mapPadding(padding.right, 'pr'));
      if (padding.bottom > 0) classes.push(this.mapPadding(padding.bottom, 'pb'));
      if (padding.left > 0) classes.push(this.mapPadding(padding.left, 'pl'));
    }

    return classes;
  }

  // Mapping helper functions
  private mapGap(gap: number): string {
    const gapMap: Record<number, string> = {
      0: 'gap-0', 1: 'gap-px', 2: 'gap-0.5', 4: 'gap-1', 6: 'gap-1.5',
      8: 'gap-2', 10: 'gap-2.5', 12: 'gap-3', 14: 'gap-3.5', 16: 'gap-4',
      20: 'gap-5', 24: 'gap-6', 28: 'gap-7', 32: 'gap-8', 36: 'gap-9',
      40: 'gap-10', 44: 'gap-11', 48: 'gap-12', 56: 'gap-14', 64: 'gap-16',
      80: 'gap-20', 96: 'gap-24', 112: 'gap-28', 128: 'gap-32',
    };
    return gapMap[gap] || `gap-[${gap}px]`;
  }

  private mapPadding(value: number, prefix: string): string {
    const paddingMap: Record<number, number> = {
      0: 0, 1: 0, 2: 0.5, 4: 1, 6: 1.5, 8: 2, 10: 2.5, 12: 3, 14: 3.5,
      16: 4, 20: 5, 24: 6, 28: 7, 32: 8, 36: 9, 40: 10, 44: 11, 48: 12,
      56: 14, 64: 16, 80: 20, 96: 24, 112: 28, 128: 32,
    };
    const mappedValue = paddingMap[value];
    if (mappedValue !== undefined) {
      return `${prefix}-${mappedValue}`;
    }
    return `${prefix}-[${value}px]`;
  }

  private mapBackgroundColor(color: string): string {
    // Handle rgba
    if (color.startsWith('rgba')) {
      return `bg-[${color}]`;
    }
    // Handle hex colors - map to Tailwind if possible
    const colorMap = this.getColorMap();
    const mapped = colorMap.get(color.toLowerCase());
    if (mapped) {
      return `bg-${mapped}`;
    }
    return `bg-[${color}]`;
  }

  private mapBorderColor(color: string): string {
    if (color.startsWith('rgba')) {
      return `border-[${color}]`;
    }
    const colorMap = this.getColorMap();
    const mapped = colorMap.get(color.toLowerCase());
    if (mapped) {
      return `border-${mapped}`;
    }
    return `border-[${color}]`;
  }

  private mapBorderWidth(width: number): string {
    if (width === 0) return 'border-0';
    if (width === 1) return 'border';
    if (width === 2) return 'border-2';
    if (width === 4) return 'border-4';
    if (width === 8) return 'border-8';
    return `border-[${width}px]`;
  }

  private mapBorderRadius(radius: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number }): string {
    // Check if all corners are the same
    if (radius.topLeft === radius.topRight && radius.topRight === radius.bottomRight && radius.bottomRight === radius.bottomLeft) {
      const r = radius.topLeft;
      if (r === 0) return 'rounded-none';
      if (r <= 2) return 'rounded-sm';
      if (r <= 4) return 'rounded';
      if (r <= 6) return 'rounded-md';
      if (r <= 8) return 'rounded-lg';
      if (r <= 12) return 'rounded-xl';
      if (r <= 16) return 'rounded-2xl';
      if (r <= 24) return 'rounded-3xl';
      if (r >= 9999) return 'rounded-full';
      return `rounded-[${r}px]`;
    }
    // Individual corners
    return `rounded-[${radius.topLeft}px_${radius.topRight}px_${radius.bottomRight}px_${radius.bottomLeft}px]`;
  }

  private mapShadow(shadow: { type: string; offsetX: number; offsetY: number; blur: number; color: string }): string {
    const blur = shadow.blur;
    if (blur <= 1) return 'shadow-sm';
    if (blur <= 3) return 'shadow';
    if (blur <= 6) return 'shadow-md';
    if (blur <= 10) return 'shadow-lg';
    if (blur <= 15) return 'shadow-xl';
    return 'shadow-2xl';
  }

  private mapOpacity(opacity: number): string {
    const percent = Math.round(opacity * 100);
    const opacityMap: Record<number, number> = {
      0: 0, 5: 5, 10: 10, 20: 20, 25: 25, 30: 30, 40: 40, 50: 50,
      60: 60, 70: 70, 75: 75, 80: 80, 90: 90, 95: 95, 100: 100,
    };
    // Find closest
    const closest = Object.keys(opacityMap).reduce((prev, curr) =>
      Math.abs(Number(curr) - percent) < Math.abs(Number(prev) - percent) ? curr : prev
    );
    return `opacity-${closest}`;
  }

  private mapGradient(gradient: string): string {
    // Simplified - returns arbitrary gradient
    return `bg-gradient-to-b`;
  }

  private mapFontSize(size: number): string {
    const sizeMap: Record<number, string> = {
      12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg',
      20: 'text-xl', 24: 'text-2xl', 30: 'text-3xl', 36: 'text-4xl',
      48: 'text-5xl', 60: 'text-6xl', 72: 'text-7xl', 96: 'text-8xl', 128: 'text-9xl',
    };
    return sizeMap[size] || `text-[${size}px]`;
  }

  private mapFontWeight(weight: number): string {
    const weightMap: Record<number, string> = {
      100: 'font-thin', 200: 'font-extralight', 300: 'font-light',
      400: 'font-normal', 500: 'font-medium', 600: 'font-semibold',
      700: 'font-bold', 800: 'font-extrabold', 900: 'font-black',
    };
    return weightMap[weight] || 'font-normal';
  }

  private mapLineHeight(lineHeight: number | string, fontSize?: number): string {
    if (typeof lineHeight === 'number' && fontSize) {
      const ratio = lineHeight / fontSize;
      if (ratio <= 1) return 'leading-none';
      if (ratio <= 1.25) return 'leading-tight';
      if (ratio <= 1.375) return 'leading-snug';
      if (ratio <= 1.5) return 'leading-normal';
      if (ratio <= 1.625) return 'leading-relaxed';
      return 'leading-loose';
    }
    return 'leading-normal';
  }

  private mapLetterSpacing(spacing: number): string {
    if (spacing <= -0.05) return 'tracking-tighter';
    if (spacing <= -0.025) return 'tracking-tight';
    if (spacing === 0) return 'tracking-normal';
    if (spacing <= 0.025) return 'tracking-wide';
    if (spacing <= 0.05) return 'tracking-wider';
    return 'tracking-widest';
  }

  private mapTextDecoration(decoration: string): string {
    const decoMap: Record<string, string> = {
      underline: 'underline',
      strikethrough: 'line-through',
      none: 'no-underline',
    };
    return decoMap[decoration] || '';
  }

  private mapTextTransform(transform: string): string {
    const transformMap: Record<string, string> = {
      upper: 'uppercase',
      lower: 'lowercase',
      title: 'capitalize',
      original: 'normal-case',
    };
    return transformMap[transform] || '';
  }

  private mapWidth(width: number): string {
    const widthMap: Record<number, string> = {
      0: 'w-0', 1: 'w-px', 8: 'w-2', 16: 'w-4', 24: 'w-6', 32: 'w-8',
      40: 'w-10', 48: 'w-12', 64: 'w-16', 80: 'w-20', 96: 'w-24',
      128: 'w-32', 160: 'w-40', 192: 'w-48', 256: 'w-64', 320: 'w-80', 384: 'w-96',
    };
    return widthMap[width] || `w-[${width}px]`;
  }

  private mapHeight(height: number): string {
    const heightMap: Record<number, string> = {
      0: 'h-0', 1: 'h-px', 8: 'h-2', 16: 'h-4', 24: 'h-6', 32: 'h-8',
      40: 'h-10', 48: 'h-12', 64: 'h-16', 80: 'h-20', 96: 'h-24',
      128: 'h-32', 160: 'h-40', 192: 'h-48', 256: 'h-64', 320: 'h-80', 384: 'h-96',
    };
    return heightMap[height] || `h-[${height}px]`;
  }

  private getColorMap(): Map<string, string> {
    // Common color mappings
    const colors = new Map<string, string>();
    colors.set('#ffffff', 'white');
    colors.set('#000000', 'black');
    colors.set('#f8fafc', 'slate-50');
    colors.set('#f1f5f9', 'slate-100');
    colors.set('#e2e8f0', 'slate-200');
    colors.set('#cbd5e1', 'slate-300');
    colors.set('#94a3b8', 'slate-400');
    colors.set('#64748b', 'slate-500');
    colors.set('#475569', 'slate-600');
    colors.set('#334155', 'slate-700');
    colors.set('#1e293b', 'slate-800');
    colors.set('#0f172a', 'slate-900');
    colors.set('#ef4444', 'red-500');
    colors.set('#22c55e', 'green-500');
    colors.set('#3b82f6', 'blue-500');
    colors.set('#eab308', 'yellow-500');
    colors.set('#a855f7', 'purple-500');
    colors.set('#ec4899', 'pink-500');
    return colors;
  }
}
