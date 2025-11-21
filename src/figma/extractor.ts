/**
 * Figma Metadata Extractor
 * Extracts and normalizes design data from Figma API responses
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  FigmaNode,
  FigmaFrameNode,
  FigmaTextNode,
  FigmaSceneNode,
  FigmaInstanceNode,
  FigmaColor,
  FigmaPaint,
  FigmaEffect,
  FigmaTypeStyle,
  FigmaFile,
} from '../types/figma.js';
import type {
  IRDocument,
  IRNode,
  ComponentType,
  AutoLayout,
  Style,
  BoundingBox,
  TypographyToken,
  ShadowToken,
  BorderToken,
  SpacingToken,
} from '../types/ir.js';
import { FigmaClient } from './client.js';

export interface ExtractionOptions {
  includeHidden?: boolean;
  maxDepth?: number;
  extractAssets?: boolean;
}

export class FigmaExtractor {
  private client: FigmaClient;
  private fileKey: string;
  private file: FigmaFile | null = null;
  private assets: Map<string, { type: 'image' | 'icon' | 'vector'; url?: string; svgContent?: string }> = new Map();

  constructor(client: FigmaClient, fileKey: string) {
    this.client = client;
    this.fileKey = fileKey;
  }

  /**
   * Extract full IR document from Figma file or specific node
   */
  async extract(nodeId?: string, options?: ExtractionOptions): Promise<IRDocument> {
    // Fetch the file
    this.file = await this.client.getFile(this.fileKey);

    let rootNode: FigmaNode;
    if (nodeId) {
      const node = await this.client.getNode(this.fileKey, nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in file ${this.fileKey}`);
      }
      rootNode = node;
    } else {
      // Use first canvas/page
      const document = this.file.document;
      if (document.children.length === 0) {
        throw new Error('File has no pages');
      }
      const firstPage = document.children[0];
      if (!firstPage) {
        throw new Error('Could not access first page');
      }
      if (!('children' in firstPage) || !firstPage.children?.length) {
        throw new Error('First page has no frames');
      }
      const firstFrame = firstPage.children[0];
      if (!firstFrame) {
        throw new Error('Could not access first frame');
      }
      rootNode = firstFrame;
    }

    // Extract design tokens
    const designTokens = this.extractDesignTokens();

    // Convert to IR
    const irRoot = this.convertNode(rootNode, options);

    // Get canvas dimensions from root node
    const boundingBox = this.extractBoundingBox(rootNode as FigmaSceneNode);

    // Build asset list if requested
    const assetsList = options?.extractAssets
      ? Array.from(this.assets.entries()).map(([id, asset]) => ({
          id,
          name: id,
          type: asset.type,
          url: asset.url,
          svgContent: asset.svgContent,
        }))
      : undefined;

    return {
      version: '1.0.0',
      figmaFileId: this.fileKey,
      figmaFileName: this.file.name,
      figmaNodeId: nodeId,
      extractedAt: new Date().toISOString(),
      canvas: {
        width: boundingBox.width,
        height: boundingBox.height,
        backgroundColor: this.extractBackgroundColor(rootNode as FigmaSceneNode),
      },
      designTokens,
      breakpoints: [
        { name: 'mobile', minWidth: 0, maxWidth: 639 },
        { name: 'tablet', minWidth: 640, maxWidth: 1023 },
        { name: 'desktop', minWidth: 1024, maxWidth: 1279 },
        { name: 'wide', minWidth: 1280 },
      ],
      root: irRoot,
      assets: assetsList,
    };
  }

  /**
   * Convert a Figma node to IR node
   */
  private convertNode(node: FigmaNode, options?: ExtractionOptions, depth = 0): IRNode {
    const sceneNode = node as FigmaSceneNode;
    const frameNode = node as FigmaFrameNode;
    const textNode = node as FigmaTextNode;
    const instanceNode = node as FigmaInstanceNode;

    // Skip hidden nodes unless explicitly included
    if (!options?.includeHidden && sceneNode.visible === false) {
      return this.createEmptyNode(node);
    }

    // Check max depth
    if (options?.maxDepth !== undefined && depth > options.maxDepth) {
      return this.createEmptyNode(node);
    }

    // Determine node type and component type
    const { nodeType, componentType } = this.classifyNode(node);

    // Build base IR node
    const irNode: IRNode = {
      id: uuidv4(),
      name: node.name,
      type: nodeType,
      componentType,
      figmaNodeId: node.id,
      boundingBox: this.extractBoundingBox(sceneNode),
      styles: this.extractStyles(sceneNode),
    };

    // Add auto layout info if present
    if (frameNode.layoutMode && frameNode.layoutMode !== 'NONE') {
      irNode.autoLayout = this.extractAutoLayout(frameNode);
    }

    // Add constraints
    if (sceneNode.constraints) {
      irNode.constraints = {
        horizontal: this.mapConstraint(sceneNode.constraints.horizontal),
        vertical: this.mapConstraint(sceneNode.constraints.vertical),
      };
    }

    // Handle text nodes
    if (node.type === 'TEXT') {
      irNode.textContent = textNode.characters;
      if (textNode.style) {
        irNode.styles.typography = this.extractTypography(textNode.style);
      }
    }

    // Handle instance nodes - extract component reference
    if (node.type === 'INSTANCE') {
      irNode.mappedComponent = this.resolveComponentName(instanceNode.componentId);
      if (instanceNode.componentProperties) {
        irNode.props = this.extractComponentProps(instanceNode.componentProperties);
      }
    }

    // Process children
    if ('children' in frameNode && Array.isArray(frameNode.children)) {
      irNode.children = frameNode.children
        .map((child: FigmaNode) => this.convertNode(child, options, depth + 1))
        .filter((child: IRNode) => child.componentType !== 'UNKNOWN' || child.children?.length);
    }

    // Set semantic hints based on detection
    this.addSemanticHints(irNode);

    return irNode;
  }

  /**
   * Classify a Figma node into IR types
   */
  private classifyNode(node: FigmaNode): { nodeType: IRNode['type']; componentType: ComponentType } {
    const name = node.name.toLowerCase();
    const type = node.type;

    // Default classification
    let nodeType: IRNode['type'] = 'container';
    let componentType: ComponentType = 'CONTAINER';

    // Classify by Figma node type
    switch (type) {
      case 'TEXT':
        nodeType = 'text';
        componentType = this.classifyTextNode(node as FigmaTextNode);
        break;

      case 'VECTOR':
      case 'BOOLEAN_OPERATION':
      case 'STAR':
      case 'LINE':
      case 'ELLIPSE':
      case 'REGULAR_POLYGON':
        nodeType = 'vector';
        componentType = 'ICON';
        break;

      case 'RECTANGLE':
        nodeType = 'container';
        componentType = this.classifyRectangle(name);
        break;

      case 'FRAME':
      case 'GROUP':
      case 'SECTION':
        nodeType = 'container';
        componentType = this.classifyContainer(name, node as FigmaFrameNode);
        break;

      case 'COMPONENT':
      case 'INSTANCE':
        nodeType = 'component';
        componentType = this.classifyComponent(name, node as FigmaFrameNode);
        break;

      case 'COMPONENT_SET':
        nodeType = 'container';
        componentType = 'CONTAINER';
        break;
    }

    return { nodeType, componentType };
  }

  /**
   * Classify text nodes by content and style
   */
  private classifyTextNode(node: FigmaTextNode): ComponentType {
    const style = node.style;
    const fontSize = style?.fontSize || 16;
    const fontWeight = style?.fontWeight || 400;

    // Large bold text is likely a heading
    if (fontSize >= 24 || fontWeight >= 600) {
      return 'HEADING';
    }

    // Small text might be a label
    if (fontSize <= 12) {
      return 'LABEL';
    }

    return 'TEXT';
  }

  /**
   * Classify rectangle nodes
   */
  private classifyRectangle(name: string): ComponentType {
    if (name.includes('divider') || name.includes('separator') || name.includes('line')) {
      return 'DIVIDER';
    }
    if (name.includes('image') || name.includes('photo') || name.includes('picture')) {
      return 'IMAGE';
    }
    return 'CONTAINER';
  }

  /**
   * Classify container nodes
   */
  private classifyContainer(name: string, node: FigmaFrameNode): ComponentType {
    // Check for common UI patterns by name
    const patterns: [RegExp, ComponentType][] = [
      [/^nav(bar|igation)?$/i, 'NAVBAR'],
      [/^side(bar|nav|menu)$/i, 'SIDEBAR'],
      [/^header$/i, 'HEADER'],
      [/^footer$/i, 'FOOTER'],
      [/^card$/i, 'CARD'],
      [/^modal|dialog|popup$/i, 'MODAL'],
      [/^drawer$/i, 'DRAWER'],
      [/^tab(s|bar|list)?$/i, 'TABS'],
      [/^accordion$/i, 'ACCORDION'],
      [/^table$/i, 'TABLE'],
      [/^list$/i, 'LIST'],
      [/^(list[_-]?)?item$/i, 'LIST_ITEM'],
      [/^menu$/i, 'MENU'],
      [/^dropdown$/i, 'DROPDOWN'],
      [/^alert|notification$/i, 'ALERT'],
      [/^toast$/i, 'TOAST'],
      [/^tooltip$/i, 'TOOLTIP'],
      [/^popover$/i, 'POPOVER'],
      [/^breadcrumb$/i, 'BREADCRUMB'],
      [/^pagination$/i, 'PAGINATION'],
      [/^stepper$/i, 'STEPPER'],
      [/^section$/i, 'SECTION'],
      [/^frame$/i, 'FRAME'],
      [/^group$/i, 'GROUP'],
    ];

    for (const [pattern, type] of patterns) {
      if (pattern.test(name)) {
        return type;
      }
    }

    // Check for structural hints
    if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
      return 'CONTAINER';
    }

    return 'FRAME';
  }

  /**
   * Classify component nodes
   */
  private classifyComponent(name: string, node: FigmaFrameNode): ComponentType {
    const patterns: [RegExp, ComponentType][] = [
      [/^button$/i, 'BUTTON'],
      [/^icon[_-]?button$/i, 'ICON_BUTTON'],
      [/^link$/i, 'LINK'],
      [/^input|text[_-]?field$/i, 'INPUT'],
      [/^textarea$/i, 'TEXTAREA'],
      [/^select|dropdown$/i, 'SELECT'],
      [/^checkbox$/i, 'CHECKBOX'],
      [/^radio$/i, 'RADIO'],
      [/^switch|toggle$/i, 'SWITCH'],
      [/^slider$/i, 'SLIDER'],
      [/^date[_-]?picker$/i, 'DATE_PICKER'],
      [/^avatar$/i, 'AVATAR'],
      [/^badge$/i, 'BADGE'],
      [/^tag|chip$/i, 'TAG'],
      [/^progress$/i, 'PROGRESS'],
      [/^spinner|loader$/i, 'SPINNER'],
      [/^skeleton$/i, 'SKELETON'],
      [/^icon$/i, 'ICON'],
      [/^image|img$/i, 'IMAGE'],
    ];

    for (const [pattern, type] of patterns) {
      if (pattern.test(name)) {
        return type;
      }
    }

    // Check children to infer type
    if ('children' in node && node.children) {
      const hasTextChild = node.children.some((c: FigmaNode) => c.type === 'TEXT');
      const hasIconChild = node.children.some((c: FigmaNode) =>
        c.type === 'VECTOR' || c.name.toLowerCase().includes('icon')
      );

      if (hasTextChild && !hasIconChild && node.children.length <= 2) {
        return 'BUTTON';
      }
    }

    return 'CONTAINER';
  }

  /**
   * Extract bounding box from node
   */
  private extractBoundingBox(node: FigmaSceneNode): BoundingBox {
    const box = node.absoluteBoundingBox || { x: 0, y: 0, width: 100, height: 100 };
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: 0, // Figma doesn't directly expose rotation in absoluteBoundingBox
    };
  }

  /**
   * Extract auto layout properties
   */
  private extractAutoLayout(node: FigmaFrameNode): AutoLayout {
    return {
      mode: node.layoutMode || 'NONE',
      primaryAxisAlign: this.mapAxisAlign(node.primaryAxisAlignItems),
      counterAxisAlign: this.mapCounterAxisAlign(node.counterAxisAlignItems),
      gap: node.itemSpacing || 0,
      padding: {
        top: node.paddingTop || 0,
        right: node.paddingRight || 0,
        bottom: node.paddingBottom || 0,
        left: node.paddingLeft || 0,
      },
      wrap: node.layoutWrap === 'WRAP',
    };
  }

  /**
   * Extract styles from node
   */
  private extractStyles(node: FigmaSceneNode): Style {
    const styles: Style = {};

    // Extract background
    if (node.fills && Array.isArray(node.fills)) {
      const visibleFills = node.fills.filter((f: FigmaPaint) => f.visible !== false);
      if (visibleFills.length > 0) {
        const fill = visibleFills[0];
        if (fill) {
          if (fill.type === 'SOLID' && fill.color) {
            styles.backgroundColor = this.colorToHex(fill.color, fill.opacity);
          } else if (fill.type?.startsWith('GRADIENT_') && fill.gradientStops) {
            styles.backgroundGradient = this.extractGradient(fill);
          } else if (fill.type === 'IMAGE' && fill.imageRef) {
            styles.backgroundImage = fill.imageRef;
            this.assets.set(fill.imageRef, { type: 'image' });
          }
        }
      }
    }

    // Extract border
    if (node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke) {
        const border: BorderToken = {
          width: node.strokeWeight || 1,
          style: 'solid',
        };
        if (stroke.color) {
          border.color = this.colorToHex(stroke.color);
        }
        styles.border = border;
      }
    }

    // Extract border radius
    const frameNode = node as FigmaFrameNode;
    if (frameNode.cornerRadius !== undefined || frameNode.rectangleCornerRadii) {
      if (!styles.border) {
        styles.border = { width: 0, style: 'none' };
      }
      if (frameNode.rectangleCornerRadii) {
        styles.border.radius = {
          topLeft: frameNode.rectangleCornerRadii[0] ?? 0,
          topRight: frameNode.rectangleCornerRadii[1] ?? 0,
          bottomRight: frameNode.rectangleCornerRadii[2] ?? 0,
          bottomLeft: frameNode.rectangleCornerRadii[3] ?? 0,
        };
      } else if (frameNode.cornerRadius) {
        const r = frameNode.cornerRadius;
        styles.border.radius = {
          topLeft: r,
          topRight: r,
          bottomRight: r,
          bottomLeft: r,
        };
      }
    }

    // Extract shadows
    if (node.effects && Array.isArray(node.effects)) {
      const shadows = node.effects
        .filter((e: FigmaEffect) => e.visible !== false && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'))
        .map((e: FigmaEffect) => this.extractShadow(e));
      if (shadows.length > 0) {
        styles.shadows = shadows;
      }
    }

    // Extract opacity
    if (node.opacity !== undefined && node.opacity < 1) {
      styles.opacity = node.opacity;
    }

    // Extract overflow
    if (frameNode.clipsContent) {
      styles.overflow = 'hidden';
    }

    return styles;
  }

  /**
   * Extract typography from text style
   */
  private extractTypography(style: FigmaTypeStyle): TypographyToken {
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeightPx,
      letterSpacing: style.letterSpacing,
      textDecoration: style.textDecoration?.toLowerCase(),
      textTransform: style.textCase?.toLowerCase(),
    };
  }

  /**
   * Extract shadow from effect
   */
  private extractShadow(effect: FigmaEffect): ShadowToken {
    return {
      type: effect.type === 'INNER_SHADOW' ? 'inner' : 'drop',
      color: effect.color ? this.colorToHex(effect.color) : '#000000',
      offsetX: effect.offset?.x || 0,
      offsetY: effect.offset?.y || 0,
      blur: effect.radius,
      spread: effect.spread,
    };
  }

  /**
   * Extract gradient string
   */
  private extractGradient(paint: FigmaPaint): string {
    if (!paint.gradientStops || !paint.gradientHandlePositions) {
      return '';
    }

    const stops = paint.gradientStops
      .map((s) => `${this.colorToHex(s.color)} ${Math.round(s.position * 100)}%`)
      .join(', ');

    // Simplified - assumes linear gradient from top to bottom
    return `linear-gradient(to bottom, ${stops})`;
  }

  /**
   * Extract background color
   */
  private extractBackgroundColor(node: FigmaSceneNode): string | undefined {
    if (node.fills && Array.isArray(node.fills)) {
      const solidFill = node.fills.find((f: FigmaPaint) => f.type === 'SOLID' && f.visible !== false);
      if (solidFill?.color) {
        return this.colorToHex(solidFill.color, solidFill.opacity);
      }
    }
    return undefined;
  }

  /**
   * Extract design tokens from file styles
   */
  private extractDesignTokens() {
    if (!this.file?.styles) {
      return {};
    }

    // This is a simplified extraction - full implementation would
    // need to resolve style references to actual values
    const tokens: IRDocument['designTokens'] = {
      colors: {},
      typography: {},
      spacing: {},
      borderRadius: {},
      shadows: {},
    };

    return tokens;
  }

  /**
   * Extract component props from instance properties
   */
  private extractComponentProps(properties: FigmaInstanceNode['componentProperties']): Record<string, unknown> {
    if (!properties) return {};

    const props: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(properties)) {
      props[key] = prop.value;
    }
    return props;
  }

  /**
   * Resolve component name from ID
   */
  private resolveComponentName(componentId: string): string {
    if (!this.file?.components) return componentId;
    return this.file.components[componentId]?.name || componentId;
  }

  /**
   * Add semantic hints to node
   */
  private addSemanticHints(node: IRNode): void {
    // Set accessibility label based on text content or name
    if (node.textContent) {
      node.accessibilityLabel = node.textContent;
    } else if (!['CONTAINER', 'FRAME', 'GROUP'].includes(node.componentType)) {
      node.accessibilityLabel = node.name;
    }

    // Set semantic role based on component type
    const roleMap: Partial<Record<ComponentType, string>> = {
      BUTTON: 'button',
      LINK: 'link',
      INPUT: 'textbox',
      CHECKBOX: 'checkbox',
      RADIO: 'radio',
      SWITCH: 'switch',
      SLIDER: 'slider',
      NAVBAR: 'navigation',
      SIDEBAR: 'complementary',
      HEADER: 'banner',
      FOOTER: 'contentinfo',
      MODAL: 'dialog',
      ALERT: 'alert',
      TAB: 'tab',
      TABS: 'tablist',
      LIST: 'list',
      LIST_ITEM: 'listitem',
      IMAGE: 'img',
      HEADING: 'heading',
    };

    const role = roleMap[node.componentType as ComponentType];
    if (role) {
      node.semanticRole = role;
    }
  }

  /**
   * Create empty placeholder node
   */
  private createEmptyNode(node: FigmaNode): IRNode {
    return {
      id: uuidv4(),
      name: node.name,
      type: 'container',
      componentType: 'UNKNOWN',
      figmaNodeId: node.id,
      boundingBox: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
      styles: {},
    };
  }

  /**
   * Convert Figma color to hex string
   */
  private colorToHex(color: FigmaColor, opacity?: number): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = opacity !== undefined ? opacity : color.a;

    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Map Figma constraint to IR constraint
   */
  private mapConstraint(constraint: string): 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE' {
    const map: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'> = {
      TOP: 'MIN',
      LEFT: 'MIN',
      BOTTOM: 'MAX',
      RIGHT: 'MAX',
      CENTER: 'CENTER',
      TOP_BOTTOM: 'STRETCH',
      LEFT_RIGHT: 'STRETCH',
      SCALE: 'SCALE',
    };
    return map[constraint] || 'MIN';
  }

  /**
   * Map primary axis alignment
   */
  private mapAxisAlign(align?: string): 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'SPACE_AROUND' | 'SPACE_EVENLY' | undefined {
    if (!align) return undefined;
    const map: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'> = {
      MIN: 'MIN',
      CENTER: 'CENTER',
      MAX: 'MAX',
      SPACE_BETWEEN: 'SPACE_BETWEEN',
    };
    return map[align];
  }

  /**
   * Map counter axis alignment
   */
  private mapCounterAxisAlign(align?: string): 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE' | undefined {
    if (!align) return undefined;
    const map: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'> = {
      MIN: 'MIN',
      CENTER: 'CENTER',
      MAX: 'MAX',
      BASELINE: 'BASELINE',
    };
    return map[align];
  }
}
