/**
 * Component Mapping Engine
 * Maps Figma UI elements to React components
 */

import type { IRNode, ComponentType } from '../types/ir.js';
import type { ComponentMapping, ComponentMappingRule } from '../types/agent.js';

/**
 * Default component mapping rules
 */
const DEFAULT_MAPPING_RULES: ComponentMappingRule[] = [
  // Buttons
  {
    pattern: /button/i,
    componentType: 'BUTTON',
    reactComponent: 'Button',
    defaultProps: { variant: 'primary', size: 'md' },
    variantMapping: {
      primary: { variant: 'primary' },
      secondary: { variant: 'secondary' },
      outline: { variant: 'outline' },
      ghost: { variant: 'ghost' },
      destructive: { variant: 'destructive' },
      small: { size: 'sm' },
      large: { size: 'lg' },
      disabled: { disabled: 'true' },
    },
  },
  {
    pattern: /icon[_-]?button/i,
    componentType: 'ICON_BUTTON',
    reactComponent: 'IconButton',
    defaultProps: { variant: 'ghost' },
  },

  // Inputs
  {
    pattern: /input|text[_-]?field/i,
    componentType: 'INPUT',
    reactComponent: 'Input',
    defaultProps: { type: 'text' },
    variantMapping: {
      password: { type: 'password' },
      email: { type: 'email' },
      number: { type: 'number' },
      search: { type: 'search' },
      disabled: { disabled: 'true' },
      error: { 'aria-invalid': 'true' },
    },
  },
  {
    pattern: /textarea/i,
    componentType: 'TEXTAREA',
    reactComponent: 'Textarea',
    defaultProps: { rows: 3 },
  },
  {
    pattern: /select/i,
    componentType: 'SELECT',
    reactComponent: 'Select',
    defaultProps: {},
  },
  {
    pattern: /checkbox/i,
    componentType: 'CHECKBOX',
    reactComponent: 'Checkbox',
    defaultProps: {},
  },
  {
    pattern: /radio/i,
    componentType: 'RADIO',
    reactComponent: 'Radio',
    defaultProps: {},
  },
  {
    pattern: /switch|toggle/i,
    componentType: 'SWITCH',
    reactComponent: 'Switch',
    defaultProps: {},
  },
  {
    pattern: /slider/i,
    componentType: 'SLIDER',
    reactComponent: 'Slider',
    defaultProps: { min: 0, max: 100 },
  },

  // Layout Components
  {
    pattern: /^nav(bar|igation)?$/i,
    componentType: 'NAVBAR',
    reactComponent: 'Navbar',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^side(bar|nav|menu)$/i,
    componentType: 'SIDEBAR',
    reactComponent: 'Sidebar',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^header$/i,
    componentType: 'HEADER',
    reactComponent: 'Header',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^footer$/i,
    componentType: 'FOOTER',
    reactComponent: 'Footer',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^card$/i,
    componentType: 'CARD',
    reactComponent: 'Card',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^modal|dialog|popup$/i,
    componentType: 'MODAL',
    reactComponent: 'Modal',
    defaultProps: { open: true },
    childrenMapping: 'children',
  },
  {
    pattern: /^drawer$/i,
    componentType: 'DRAWER',
    reactComponent: 'Drawer',
    defaultProps: { open: true },
    childrenMapping: 'children',
  },
  {
    pattern: /^tab(s)?$/i,
    componentType: 'TABS',
    reactComponent: 'Tabs',
    defaultProps: {},
    childrenMapping: 'children',
  },

  // Display Components
  {
    pattern: /^avatar$/i,
    componentType: 'AVATAR',
    reactComponent: 'Avatar',
    defaultProps: { size: 'md' },
    variantMapping: {
      small: { size: 'sm' },
      large: { size: 'lg' },
    },
  },
  {
    pattern: /^badge$/i,
    componentType: 'BADGE',
    reactComponent: 'Badge',
    defaultProps: { variant: 'default' },
    variantMapping: {
      success: { variant: 'success' },
      warning: { variant: 'warning' },
      error: { variant: 'error' },
      info: { variant: 'info' },
    },
  },
  {
    pattern: /^tag|chip$/i,
    componentType: 'TAG',
    reactComponent: 'Tag',
    defaultProps: {},
  },
  {
    pattern: /^divider|separator$/i,
    componentType: 'DIVIDER',
    reactComponent: 'Divider',
    defaultProps: {},
  },
  {
    pattern: /^progress$/i,
    componentType: 'PROGRESS',
    reactComponent: 'Progress',
    defaultProps: { value: 0 },
  },
  {
    pattern: /^spinner|loader$/i,
    componentType: 'SPINNER',
    reactComponent: 'Spinner',
    defaultProps: {},
  },
  {
    pattern: /^skeleton$/i,
    componentType: 'SKELETON',
    reactComponent: 'Skeleton',
    defaultProps: {},
  },

  // Data Display
  {
    pattern: /^table$/i,
    componentType: 'TABLE',
    reactComponent: 'Table',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^list$/i,
    componentType: 'LIST',
    reactComponent: 'List',
    defaultProps: {},
    childrenMapping: 'items',
  },

  // Feedback
  {
    pattern: /^alert|notification$/i,
    componentType: 'ALERT',
    reactComponent: 'Alert',
    defaultProps: { variant: 'info' },
    variantMapping: {
      success: { variant: 'success' },
      warning: { variant: 'warning' },
      error: { variant: 'error' },
    },
  },
  {
    pattern: /^toast$/i,
    componentType: 'TOAST',
    reactComponent: 'Toast',
    defaultProps: {},
  },
  {
    pattern: /^tooltip$/i,
    componentType: 'TOOLTIP',
    reactComponent: 'Tooltip',
    defaultProps: {},
    childrenMapping: 'children',
  },

  // Navigation
  {
    pattern: /^breadcrumb$/i,
    componentType: 'BREADCRUMB',
    reactComponent: 'Breadcrumb',
    defaultProps: {},
  },
  {
    pattern: /^pagination$/i,
    componentType: 'PAGINATION',
    reactComponent: 'Pagination',
    defaultProps: { total: 1, current: 1 },
  },
  {
    pattern: /^menu$/i,
    componentType: 'MENU',
    reactComponent: 'Menu',
    defaultProps: {},
    childrenMapping: 'children',
  },
  {
    pattern: /^dropdown$/i,
    componentType: 'DROPDOWN',
    reactComponent: 'Dropdown',
    defaultProps: {},
    childrenMapping: 'children',
  },
];

export class ComponentMapper {
  private rules: ComponentMappingRule[];

  constructor(customRules?: ComponentMappingRule[]) {
    this.rules = customRules || DEFAULT_MAPPING_RULES;
  }

  /**
   * Map a single IR node to a React component
   */
  mapNode(node: IRNode): ComponentMapping {
    // First, try to match by name
    const nameMapping = this.matchByName(node.name, node.componentType);
    if (nameMapping) {
      return nameMapping;
    }

    // Fall back to component type mapping
    return this.mapByComponentType(node);
  }

  /**
   * Map all nodes in an IR tree
   */
  mapTree(root: IRNode): IRNode {
    const mapping = this.mapNode(root);

    // Apply mapping to node
    root.mappedComponent = mapping.reactComponent;
    root.mappingConfidence = mapping.confidence;
    root.props = { ...root.props, ...mapping.props };

    // Recursively process children
    if (root.children) {
      root.children = root.children.map(child => this.mapTree(child));
    }

    return root;
  }

  /**
   * Match component by name against rules
   */
  private matchByName(name: string, componentType: ComponentType): ComponentMapping | null {
    for (const rule of this.rules) {
      const pattern = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'i')
        : rule.pattern;

      if (pattern.test(name)) {
        // Extract variants from name
        const variants = this.extractVariants(name, rule);

        return {
          figmaName: name,
          figmaType: componentType,
          reactComponent: rule.reactComponent,
          props: { ...rule.defaultProps, ...variants },
          confidence: 0.9,
          variants: this.convertVariantsToArray(variants),
        };
      }
    }
    return null;
  }

  /**
   * Map by IR component type
   */
  private mapByComponentType(node: IRNode): ComponentMapping {
    const typeMap: Partial<Record<ComponentType, { component: string; props: Record<string, unknown> }>> = {
      BUTTON: { component: 'Button', props: { variant: 'primary' } },
      ICON_BUTTON: { component: 'IconButton', props: {} },
      LINK: { component: 'a', props: { href: '#' } },
      INPUT: { component: 'Input', props: { type: 'text' } },
      TEXTAREA: { component: 'Textarea', props: {} },
      SELECT: { component: 'Select', props: {} },
      CHECKBOX: { component: 'Checkbox', props: {} },
      RADIO: { component: 'Radio', props: {} },
      SWITCH: { component: 'Switch', props: {} },
      SLIDER: { component: 'Slider', props: {} },

      NAVBAR: { component: 'nav', props: {} },
      SIDEBAR: { component: 'aside', props: {} },
      HEADER: { component: 'header', props: {} },
      FOOTER: { component: 'footer', props: {} },
      CARD: { component: 'Card', props: {} },
      MODAL: { component: 'Modal', props: { open: true } },

      TEXT: { component: 'span', props: {} },
      HEADING: { component: 'h2', props: {} },
      PARAGRAPH: { component: 'p', props: {} },
      LABEL: { component: 'label', props: {} },
      IMAGE: { component: 'img', props: { alt: '' } },
      ICON: { component: 'Icon', props: {} },
      AVATAR: { component: 'Avatar', props: {} },
      BADGE: { component: 'Badge', props: {} },
      TAG: { component: 'Tag', props: {} },
      DIVIDER: { component: 'hr', props: {} },

      LIST: { component: 'ul', props: {} },
      LIST_ITEM: { component: 'li', props: {} },
      TABLE: { component: 'table', props: {} },

      ALERT: { component: 'Alert', props: {} },
      TOAST: { component: 'Toast', props: {} },
      TOOLTIP: { component: 'Tooltip', props: {} },

      CONTAINER: { component: 'div', props: {} },
      FRAME: { component: 'div', props: {} },
      GROUP: { component: 'div', props: {} },
      SECTION: { component: 'section', props: {} },
    };

    const mapping = typeMap[node.componentType];

    if (mapping) {
      return {
        figmaName: node.name,
        figmaType: node.componentType,
        reactComponent: mapping.component,
        props: mapping.props,
        confidence: 0.7,
      };
    }

    // Default to div for unknown components
    return {
      figmaName: node.name,
      figmaType: node.componentType,
      reactComponent: 'div',
      props: {},
      confidence: 0.5,
    };
  }

  /**
   * Extract variant props from component name
   */
  private extractVariants(name: string, rule: ComponentMappingRule): Record<string, unknown> {
    if (!rule.variantMapping) return {};

    const props: Record<string, unknown> = {};
    const lowerName = name.toLowerCase();

    for (const [variant, variantProps] of Object.entries(rule.variantMapping)) {
      if (lowerName.includes(variant.toLowerCase())) {
        Object.assign(props, variantProps);
      }
    }

    return props;
  }

  /**
   * Convert variant object to array format
   */
  private convertVariantsToArray(variants: Record<string, unknown>): Array<{ name: string; value: string }> {
    return Object.entries(variants).map(([name, value]) => ({
      name,
      value: String(value),
    }));
  }

  /**
   * Get all available component mappings
   */
  getAvailableMappings(): string[] {
    return this.rules.map(r => r.reactComponent);
  }

  /**
   * Add custom mapping rule
   */
  addRule(rule: ComponentMappingRule): void {
    this.rules.unshift(rule); // Add to beginning for priority
  }

  /**
   * Calculate mapping accuracy for a tree
   */
  calculateMappingAccuracy(root: IRNode): { accuracy: number; totalNodes: number; mappedNodes: number } {
    let totalNodes = 0;
    let mappedNodes = 0;
    let confidenceSum = 0;

    const traverse = (node: IRNode) => {
      totalNodes++;
      if (node.mappedComponent && node.mappingConfidence) {
        mappedNodes++;
        confidenceSum += node.mappingConfidence;
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(root);

    const accuracy = mappedNodes > 0 ? confidenceSum / mappedNodes : 0;
    return { accuracy, totalNodes, mappedNodes };
  }
}

export { DEFAULT_MAPPING_RULES };
