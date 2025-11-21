/**
 * Figma API Type Definitions
 * Based on Figma REST API v1
 */

// Figma API Response Types
export interface FigmaFile {
  document: FigmaDocument;
  components: Record<string, FigmaComponent>;
  componentSets: Record<string, FigmaComponentSet>;
  schemaVersion: number;
  styles: Record<string, FigmaStyle>;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
}

export interface FigmaDocument {
  id: string;
  name: string;
  type: 'DOCUMENT';
  children: FigmaNode[];
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: string[];
}

export interface FigmaComponentSet {
  key: string;
  name: string;
  description: string;
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description: string;
}

// Figma Node Types
export type FigmaNodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'SECTION'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'STAR'
  | 'LINE'
  | 'ELLIPSE'
  | 'REGULAR_POLYGON'
  | 'RECTANGLE'
  | 'TEXT'
  | 'SLICE'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'STICKY'
  | 'SHAPE_WITH_TEXT'
  | 'CONNECTOR'
  | 'WASHI_TAPE';

export interface FigmaBaseNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  visible?: boolean;
  locked?: boolean;
  pluginData?: unknown;
  sharedPluginData?: unknown;
  componentPropertyReferences?: Record<string, string>;
}

export interface FigmaSceneNode extends FigmaBaseNode {
  children?: FigmaNode[];
  absoluteBoundingBox?: FigmaRectangle;
  absoluteRenderBounds?: FigmaRectangle;
  constraints?: FigmaConstraints;
  relativeTransform?: FigmaTransform;
  size?: FigmaVector;
  clipsContent?: boolean;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  strokeDashes?: number[];
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  effects?: FigmaEffect[];
  blendMode?: FigmaBlendMode;
  opacity?: number;
  isMask?: boolean;
  maskType?: 'ALPHA' | 'VECTOR' | 'LUMINANCE';
  styles?: Record<string, string>;
  layoutAlign?: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX';
  layoutGrow?: number;
  layoutPositioning?: 'AUTO' | 'ABSOLUTE';
}

export interface FigmaFrameNode extends FigmaSceneNode {
  type: 'FRAME' | 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE';
  children: FigmaNode[];
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  counterAxisSpacing?: number;
  itemReverseZIndex?: boolean;
  strokesIncludedInLayout?: boolean;
  overflowDirection?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'BOTH';
}

export interface FigmaTextNode extends FigmaSceneNode {
  type: 'TEXT';
  characters: string;
  style: FigmaTypeStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<number, FigmaTypeStyle>;
  lineTypes?: string[];
  lineIndentations?: number[];
}

export interface FigmaVectorNode extends FigmaSceneNode {
  type: 'VECTOR' | 'BOOLEAN_OPERATION' | 'STAR' | 'LINE' | 'ELLIPSE' | 'REGULAR_POLYGON' | 'RECTANGLE';
  fillGeometry?: FigmaPath[];
  strokeGeometry?: FigmaPath[];
}

export interface FigmaInstanceNode extends FigmaFrameNode {
  type: 'INSTANCE';
  componentId: string;
  componentProperties?: Record<string, FigmaComponentProperty>;
  overrides?: FigmaOverride[];
}

export type FigmaNode =
  | FigmaBaseNode
  | FigmaSceneNode
  | FigmaFrameNode
  | FigmaTextNode
  | FigmaVectorNode
  | FigmaInstanceNode;

// Figma Geometry Types
export interface FigmaRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaVector {
  x: number;
  y: number;
}

export type FigmaTransform = [[number, number, number], [number, number, number]];

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

export interface FigmaPath {
  path: string;
  windingRule: 'EVENODD' | 'NONZERO';
}

// Figma Paint Types
export interface FigmaPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'EMOJI' | 'VIDEO';
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  blendMode?: FigmaBlendMode;
  gradientHandlePositions?: FigmaVector[];
  gradientStops?: FigmaColorStop[];
  scaleMode?: 'FILL' | 'FIT' | 'TILE' | 'STRETCH';
  imageTransform?: FigmaTransform;
  scalingFactor?: number;
  rotation?: number;
  imageRef?: string;
  gifRef?: string;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaColorStop {
  position: number;
  color: FigmaColor;
}

export type FigmaBlendMode =
  | 'PASS_THROUGH'
  | 'NORMAL'
  | 'DARKEN'
  | 'MULTIPLY'
  | 'LINEAR_BURN'
  | 'COLOR_BURN'
  | 'LIGHTEN'
  | 'SCREEN'
  | 'LINEAR_DODGE'
  | 'COLOR_DODGE'
  | 'OVERLAY'
  | 'SOFT_LIGHT'
  | 'HARD_LIGHT'
  | 'DIFFERENCE'
  | 'EXCLUSION'
  | 'HUE'
  | 'SATURATION'
  | 'COLOR'
  | 'LUMINOSITY';

// Figma Effect Types
export interface FigmaEffect {
  type: 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius: number;
  color?: FigmaColor;
  blendMode?: FigmaBlendMode;
  offset?: FigmaVector;
  spread?: number;
  showShadowBehindNode?: boolean;
}

// Figma Typography Types
export interface FigmaTypeStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal?: 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  letterSpacing: number;
  lineHeightPx: number;
  lineHeightPercent?: number;
  lineHeightPercentFontSize?: number;
  lineHeightUnit?: 'PIXELS' | 'FONT_SIZE_%' | 'INTRINSIC_%';
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED';
  textDecoration?: 'NONE' | 'STRIKETHROUGH' | 'UNDERLINE';
  textAutoResize?: 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE';
  paragraphSpacing?: number;
  paragraphIndent?: number;
  hyperlink?: { type: 'URL' | 'NODE'; url?: string; nodeID?: string };
}

// Figma Component Types
export interface FigmaComponentProperty {
  type: 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT' | 'VARIANT';
  value: boolean | string;
  preferredValues?: FigmaComponentPropertyPreferredValue[];
  boundVariables?: Record<string, FigmaVariableAlias>;
}

export interface FigmaComponentPropertyPreferredValue {
  type: 'COMPONENT' | 'COMPONENT_SET';
  key: string;
}

export interface FigmaVariableAlias {
  type: 'VARIABLE_ALIAS';
  id: string;
}

export interface FigmaOverride {
  id: string;
  overriddenFields: string[];
}

// Figma API Request Types
export interface FigmaFileRequest {
  fileKey: string;
  nodeIds?: string[];
  depth?: number;
  geometry?: 'paths';
  version?: string;
  pluginData?: string;
  branchData?: boolean;
}

export interface FigmaImageRequest {
  fileKey: string;
  nodeIds: string[];
  scale?: number;
  format?: 'jpg' | 'png' | 'svg' | 'pdf';
  svgIncludeId?: boolean;
  svgIncludeNodeId?: boolean;
  svgSimplifyStroke?: boolean;
  useAbsoluteBounds?: boolean;
}

export interface FigmaImageResponse {
  err: string | null;
  images: Record<string, string>;
}

// Figma Node Extraction Response
export interface FigmaNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  nodes: Record<string, {
    document: FigmaNode;
    components: Record<string, FigmaComponent>;
    schemaVersion: number;
    styles: Record<string, FigmaStyle>;
  }>;
}
