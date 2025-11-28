/**
 * Figma2Code Plugin - Main Code
 *
 * This code runs in the Figma plugin sandbox and has access to the document API.
 * It extracts design data and sends it to the UI for transmission to the backend.
 */

// Type definitions (inline to avoid ES module imports)
type ComponentType =
  | 'CONTAINER' | 'FRAME' | 'GROUP' | 'SECTION'
  | 'NAVBAR' | 'SIDEBAR' | 'HEADER' | 'FOOTER' | 'CARD' | 'MODAL' | 'DRAWER' | 'TABS' | 'ACCORDION'
  | 'BUTTON' | 'ICON_BUTTON' | 'LINK' | 'INPUT' | 'TEXTAREA' | 'SELECT' | 'CHECKBOX' | 'RADIO' | 'SWITCH' | 'SLIDER' | 'DATE_PICKER'
  | 'TEXT' | 'HEADING' | 'PARAGRAPH' | 'LABEL' | 'IMAGE' | 'ICON' | 'AVATAR' | 'BADGE' | 'TAG' | 'CHIP' | 'DIVIDER' | 'PROGRESS' | 'SPINNER' | 'SKELETON'
  | 'TABLE' | 'LIST' | 'LIST_ITEM' | 'TREE' | 'DATA_GRID'
  | 'ALERT' | 'TOAST' | 'TOOLTIP' | 'POPOVER'
  | 'BREADCRUMB' | 'PAGINATION' | 'STEPPER' | 'MENU' | 'DROPDOWN'
  | 'UNKNOWN';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface AutoLayout {
  mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  primaryAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'SPACE_AROUND' | 'SPACE_EVENLY';
  counterAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE';
  gap: number;
  padding?: { top: number; right: number; bottom: number; left: number; };
  wrap: boolean;
}

interface Constraint {
  horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
}

interface Style {
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  textColor?: string;
  typography?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight?: number | string;
    letterSpacing?: number;
    textDecoration?: string;
    textTransform?: string;
  };
  border?: {
    width: number;
    style: 'solid' | 'dashed' | 'dotted' | 'none';
    color?: string;
    radius?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; };
  };
  shadows?: Array<{
    type: 'drop' | 'inner';
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread?: number;
  }>;
  opacity?: number;
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  cursor?: string;
}

interface IRNode {
  id: string;
  name: string;
  type: 'container' | 'component' | 'text' | 'image' | 'vector';
  componentType: ComponentType;
  figmaNodeId?: string;
  children?: IRNode[];
  boundingBox: BoundingBox;
  autoLayout?: AutoLayout;
  constraints?: Constraint;
  styles: Style;
  textContent?: string;
  imageUrl?: string;
  iconName?: string;
  semanticRole?: string;
  accessibilityLabel?: string;
}

interface IRDocument {
  version: string;
  figmaFileId: string;
  figmaFileName: string;
  figmaNodeId?: string;
  extractedAt: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor?: string;
  };
  root: IRNode;
}

interface ExtractionMetadata {
  nodeCount: number;
  fileId: string;
  fileName: string;
  nodeName: string;
  nodeId: string;
  extractedAt: string;
}

interface ExtractionResult {
  ir: IRDocument;
  screenshot: string;
  metadata: ExtractionMetadata;
}

interface SelectionInfo {
  nodeCount: number;
  nodeName: string;
  nodeType: string;
}

interface ExtractionConfig {
  backendUrl: string;
  skipBuild: boolean;
  skipVisual: boolean;
}

type UIMessage =
  | { type: 'extract'; config: ExtractionConfig }
  | { type: 'cancel' };

type PluginMessage =
  | { type: 'selection-changed'; data: SelectionInfo }
  | { type: 'extraction-progress'; percent: number; status: string }
  | { type: 'extraction-complete'; data: ExtractionResult }
  | { type: 'extraction-error'; error: string };

// Show plugin UI
figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true
});

// Track current selection
figma.on('selectionchange', () => {
  updateSelectionInfo();
});

// Listen for messages from UI
figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === 'extract') {
    await handleExtraction(msg.config);
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Initialize
updateSelectionInfo();

/**
 * Update UI with current selection info
 */
function updateSelectionInfo() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    sendToUI({
      type: 'selection-changed',
      data: {
        nodeCount: 0,
        nodeName: 'No selection',
        nodeType: 'none'
      }
    });
    return;
  }

  const node = selection[0];
  const nodeCount = countNodes(node);

  sendToUI({
    type: 'selection-changed',
    data: {
      nodeCount,
      nodeName: node.name,
      nodeType: node.type
    }
  });
}

/**
 * Count total nodes in tree
 */
function countNodes(node: SceneNode): number {
  let count = 1;
  if ('children' in node) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * Main extraction handler
 */
async function handleExtraction(config: any) {
  try {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      sendToUI({
        type: 'extraction-error',
        error: 'Please select a frame or component to extract'
      });
      return;
    }

    const node = selection[0];

    // Progress: Starting
    sendProgress(10, 'Analyzing selection...');

    // Extract node tree
    sendProgress(30, 'Extracting node tree...');
    const irNode = await extractNode(node);

    // Build IR document
    sendProgress(60, 'Building IR document...');
    const ir: IRDocument = {
      version: '1.0.0',
      figmaFileId: figma.fileKey || 'unknown',
      figmaFileName: figma.root.name,
      figmaNodeId: node.id,
      extractedAt: new Date().toISOString(),
      canvas: {
        width: 'width' in node ? node.width : 0,
        height: 'height' in node ? node.height : 0,
        backgroundColor: '#ffffff'
      },
      root: irNode
    };

    // Capture screenshot
    sendProgress(80, 'Capturing screenshot...');
    const screenshot = await captureScreenshot(node);

    // Prepare result
    sendProgress(95, 'Finalizing...');
    const result: ExtractionResult = {
      ir,
      screenshot,
      metadata: {
        nodeCount: countNodes(node),
        fileId: figma.fileKey || 'unknown',
        fileName: figma.root.name,
        nodeName: node.name,
        nodeId: node.id,
        extractedAt: new Date().toISOString()
      }
    };

    // Send to UI
    sendProgress(100, 'Complete!');

    // Serialize to ensure no Symbols or non-serializable objects
    const serializedResult = JSON.parse(JSON.stringify(result));

    sendToUI({
      type: 'extraction-complete',
      data: serializedResult
    });

  } catch (error) {
    console.error('Extraction error:', error);
    sendToUI({
      type: 'extraction-error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Extract a single node and its children recursively
 */
async function extractNode(node: SceneNode): Promise<IRNode> {
  // Extract basic properties
  const irNode: IRNode = {
    id: node.id,
    name: node.name,
    type: getNodeType(node),
    componentType: detectComponentType(node),
    figmaNodeId: node.id,
    boundingBox: extractBoundingBox(node),
    styles: await extractStyles(node)
  };

  // Extract constraints
  if ('constraints' in node) {
    irNode.constraints = extractConstraints(node.constraints);
  }

  // Extract auto layout
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    irNode.autoLayout = extractAutoLayout(node);
  }

  // Extract text content
  if (node.type === 'TEXT') {
    irNode.textContent = node.characters;
  }

  // Extract children recursively
  if ('children' in node) {
    irNode.children = [];
    for (const child of node.children) {
      irNode.children.push(await extractNode(child));
    }
  }

  return irNode;
}

/**
 * Get node type for IR
 */
function getNodeType(node: SceneNode): IRNode['type'] {
  if (node.type === 'TEXT') return 'text';
  if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'POLYGON') {
    // Check if it has image fill
    if ('fills' in node && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE') {
          return 'image';
        }
      }
    }
    return 'component';
  }
  if (node.type === 'VECTOR' || node.type === 'STAR' || node.type === 'LINE') return 'vector';
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') return 'container';
  return 'container';
}

/**
 * Detect semantic component type
 */
function detectComponentType(node: SceneNode): ComponentType {
  const name = node.name.toLowerCase();

  // Button detection
  if (name.includes('button') || name.includes('btn')) {
    if (name.includes('icon')) return 'ICON_BUTTON';
    return 'BUTTON';
  }

  // Input detection
  if (name.includes('input') || name.includes('textfield')) return 'INPUT';
  if (name.includes('textarea')) return 'TEXTAREA';
  if (name.includes('select') || name.includes('dropdown')) return 'SELECT';
  if (name.includes('checkbox')) return 'CHECKBOX';
  if (name.includes('radio')) return 'RADIO';
  if (name.includes('switch') || name.includes('toggle')) return 'SWITCH';

  // Layout detection
  if (name.includes('nav') && name.includes('bar')) return 'NAVBAR';
  if (name.includes('header')) return 'HEADER';
  if (name.includes('footer')) return 'FOOTER';
  if (name.includes('sidebar')) return 'SIDEBAR';
  if (name.includes('card')) return 'CARD';
  if (name.includes('modal') || name.includes('dialog')) return 'MODAL';
  if (name.includes('drawer')) return 'DRAWER';

  // Icon detection
  if (name.includes('icon') || node.type === 'VECTOR') return 'ICON';

  // Text detection
  if (node.type === 'TEXT') {
    if (name.includes('heading') || name.includes('title') || name.includes('h1') || name.includes('h2')) {
      return 'HEADING';
    }
    if (name.includes('paragraph') || name.includes('body')) {
      return 'PARAGRAPH';
    }
    if (name.includes('label')) {
      return 'LABEL';
    }
    return 'TEXT';
  }

  // Image detection
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE') {
        return 'IMAGE';
      }
    }
  }

  // Default based on type
  if (node.type === 'FRAME') return 'CONTAINER';
  if (node.type === 'GROUP') return 'GROUP';
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') return 'CONTAINER';

  return 'UNKNOWN';
}

/**
 * Extract bounding box
 */
function extractBoundingBox(node: SceneNode): BoundingBox {
  return {
    x: 'x' in node ? node.x : 0,
    y: 'y' in node ? node.y : 0,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0,
    rotation: 'rotation' in node ? node.rotation : 0
  };
}

/**
 * Extract auto layout properties
 */
function extractAutoLayout(node: any): AutoLayout {
  return {
    mode: node.layoutMode || 'NONE',
    primaryAxisAlign: node.primaryAxisAlignItems,
    counterAxisAlign: node.counterAxisAlignItems,
    gap: node.itemSpacing || 0,
    padding: {
      top: node.paddingTop || 0,
      right: node.paddingRight || 0,
      bottom: node.paddingBottom || 0,
      left: node.paddingLeft || 0
    },
    wrap: node.layoutWrap === 'WRAP'
  };
}

/**
 * Extract constraints
 */
function extractConstraints(constraints: any): Constraint {
  return {
    horizontal: constraints.horizontal || 'MIN',
    vertical: constraints.vertical || 'MIN'
  };
}

/**
 * Extract styles (fills, strokes, effects, etc.)
 */
async function extractStyles(node: SceneNode): Promise<Style> {
  const style: Style = {};

  // Extract fills
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      style.backgroundColor = rgbToHex(fill.color, fill.opacity);
    } else if (fill.type === 'GRADIENT_LINEAR') {
      // Simplified gradient - just use first color
      const firstStop = fill.gradientStops[0];
      if (firstStop) {
        style.backgroundColor = rgbToHex(firstStop.color, firstStop.color.a);
      }
    }
  }

  // Extract strokes
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID') {
      style.border = {
        width: 'strokeWeight' in node ? node.strokeWeight as number : 1,
        style: 'solid',
        color: rgbToHex(stroke.color, stroke.opacity),
        radius: extractBorderRadius(node)
      };
    }
  }

  // Extract corner radius
  if ('cornerRadius' in node && !style.border) {
    style.border = {
      width: 0,
      style: 'none',
      radius: extractBorderRadius(node)
    };
  }

  // Extract opacity
  if ('opacity' in node) {
    style.opacity = node.opacity;
  }

  // Extract text styles
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;

    style.typography = {
      fontFamily: typeof textNode.fontName !== 'symbol' ? textNode.fontName.family : 'Inter',
      fontSize: typeof textNode.fontSize !== 'symbol' ? textNode.fontSize : 16,
      fontWeight: typeof textNode.fontName !== 'symbol' && 'style' in textNode.fontName
        ? getFontWeight(textNode.fontName.style)
        : 400,
      lineHeight: typeof textNode.lineHeight !== 'symbol' && textNode.lineHeight.unit === 'PIXELS'
        ? textNode.lineHeight.value
        : 'normal',
      letterSpacing: typeof textNode.letterSpacing !== 'symbol' && textNode.letterSpacing.unit === 'PIXELS'
        ? textNode.letterSpacing.value
        : 0
    };

    // Extract text color
    if (Array.isArray(textNode.fills) && textNode.fills.length > 0) {
      const fill = textNode.fills[0];
      if (fill.type === 'SOLID') {
        style.textColor = rgbToHex(fill.color, fill.opacity);
      }
    }
  }

  // Extract effects (shadows)
  if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
    style.shadows = [];
    for (const effect of node.effects) {
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        style.shadows.push({
          type: effect.type === 'DROP_SHADOW' ? 'drop' : 'inner',
          color: rgbToHex(effect.color, effect.color.a),
          offsetX: effect.offset.x,
          offsetY: effect.offset.y,
          blur: effect.radius,
          spread: effect.spread || 0
        });
      }
    }
  }

  return style;
}

/**
 * Extract border radius
 */
function extractBorderRadius(node: any): { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number } {
  if ('topLeftRadius' in node) {
    return {
      topLeft: node.topLeftRadius || 0,
      topRight: node.topRightRadius || 0,
      bottomRight: node.bottomRightRadius || 0,
      bottomLeft: node.bottomLeftRadius || 0
    };
  }
  if ('cornerRadius' in node) {
    const radius = node.cornerRadius || 0;
    return {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius
    };
  }
  return { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(color: RGB, opacity?: number): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = opacity !== undefined ? opacity : 1;

  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Get font weight from style string
 */
function getFontWeight(style: string): number {
  const weightMap: Record<string, number> = {
    'Thin': 100,
    'Extra Light': 200,
    'Light': 300,
    'Regular': 400,
    'Medium': 500,
    'Semi Bold': 600,
    'Bold': 700,
    'Extra Bold': 800,
    'Black': 900
  };

  return weightMap[style] || 400;
}

/**
 * Capture screenshot of node
 */
async function captureScreenshot(node: SceneNode): Promise<string> {
  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 } // 2x for retina
    });

    // Convert to base64
    const base64 = figma.base64Encode(bytes);
    return base64;

  } catch (error) {
    console.error('Screenshot error:', error);
    return '';
  }
}

/**
 * Send message to UI
 */
function sendToUI(message: PluginMessage) {
  figma.ui.postMessage(message);
}

/**
 * Send progress update to UI
 */
function sendProgress(percent: number, status: string) {
  sendToUI({
    type: 'extraction-progress',
    percent,
    status
  });
}
