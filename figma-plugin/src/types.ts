/**
 * Shared types between plugin code and UI
 */

// Message types sent from plugin to UI
export type PluginMessage =
  | { type: 'selection-changed'; data: SelectionInfo }
  | { type: 'extraction-progress'; percent: number; status: string }
  | { type: 'extraction-complete'; data: ExtractionResult }
  | { type: 'extraction-error'; error: string };

// Message types sent from UI to plugin
export type UIMessage =
  | { type: 'extract'; config: ExtractionConfig }
  | { type: 'cancel' };

export interface SelectionInfo {
  nodeCount: number;
  nodeName: string;
  nodeType: string;
}

export interface ExtractionConfig {
  backendUrl: string;
  skipBuild: boolean;
  skipVisual: boolean;
}

export interface ExtractionResult {
  ir: IRDocument;
  screenshot: string; // Base64 encoded PNG
  metadata: ExtractionMetadata;
}

export interface ExtractionMetadata {
  nodeCount: number;
  fileId: string;
  fileName: string;
  nodeName: string;
  nodeId: string;
  extractedAt: string;
}

// IR types (simplified - matches main project)
export interface IRDocument {
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

export interface IRNode {
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

export type ComponentType =
  | 'CONTAINER'
  | 'FRAME'
  | 'GROUP'
  | 'SECTION'
  | 'NAVBAR'
  | 'SIDEBAR'
  | 'HEADER'
  | 'FOOTER'
  | 'CARD'
  | 'MODAL'
  | 'DRAWER'
  | 'TABS'
  | 'ACCORDION'
  | 'BUTTON'
  | 'ICON_BUTTON'
  | 'LINK'
  | 'INPUT'
  | 'TEXTAREA'
  | 'SELECT'
  | 'CHECKBOX'
  | 'RADIO'
  | 'SWITCH'
  | 'SLIDER'
  | 'DATE_PICKER'
  | 'TEXT'
  | 'HEADING'
  | 'PARAGRAPH'
  | 'LABEL'
  | 'IMAGE'
  | 'ICON'
  | 'AVATAR'
  | 'BADGE'
  | 'TAG'
  | 'CHIP'
  | 'DIVIDER'
  | 'PROGRESS'
  | 'SPINNER'
  | 'SKELETON'
  | 'TABLE'
  | 'LIST'
  | 'LIST_ITEM'
  | 'TREE'
  | 'DATA_GRID'
  | 'ALERT'
  | 'TOAST'
  | 'TOOLTIP'
  | 'POPOVER'
  | 'BREADCRUMB'
  | 'PAGINATION'
  | 'STEPPER'
  | 'MENU'
  | 'DROPDOWN'
  | 'UNKNOWN';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface AutoLayout {
  mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  primaryAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'SPACE_AROUND' | 'SPACE_EVENLY';
  counterAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE';
  gap: number;
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  wrap: boolean;
}

export interface Constraint {
  horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
}

export interface Style {
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
    radius?: {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    };
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
