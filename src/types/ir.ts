/**
 * Intermediate Representation (IR) Schema
 * JSON-based UI layout representation for Figma to React conversion
 */

import { z } from 'zod';

// Design Token Schemas
export const ColorTokenSchema = z.object({
  name: z.string(),
  value: z.string(),
  opacity: z.number().min(0).max(1).optional(),
});

export const TypographyTokenSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
  fontWeight: z.number(),
  lineHeight: z.union([z.number(), z.string()]).optional(),
  letterSpacing: z.number().optional(),
  textDecoration: z.string().optional(),
  textTransform: z.string().optional(),
});

export const SpacingTokenSchema = z.object({
  top: z.number().default(0),
  right: z.number().default(0),
  bottom: z.number().default(0),
  left: z.number().default(0),
});

export const BorderTokenSchema = z.object({
  width: z.number().default(0),
  style: z.enum(['solid', 'dashed', 'dotted', 'none']).default('solid'),
  color: z.string().optional(),
  radius: z.object({
    topLeft: z.number().default(0),
    topRight: z.number().default(0),
    bottomRight: z.number().default(0),
    bottomLeft: z.number().default(0),
  }).optional(),
});

export const ShadowTokenSchema = z.object({
  type: z.enum(['drop', 'inner']),
  color: z.string(),
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number(),
  spread: z.number().optional(),
});

// Layout Schemas
export const LayoutModeSchema = z.enum([
  'NONE',
  'HORIZONTAL',
  'VERTICAL',
  'GRID',
]);

export const AlignmentSchema = z.enum([
  'MIN',
  'CENTER',
  'MAX',
  'STRETCH',
  'BASELINE',
]);

export const JustifySchema = z.enum([
  'MIN',
  'CENTER',
  'MAX',
  'SPACE_BETWEEN',
  'SPACE_AROUND',
  'SPACE_EVENLY',
]);

export const AutoLayoutSchema = z.object({
  mode: LayoutModeSchema,
  primaryAxisAlign: JustifySchema.optional(),
  counterAxisAlign: AlignmentSchema.optional(),
  gap: z.number().default(0),
  padding: SpacingTokenSchema.optional(),
  wrap: z.boolean().default(false),
});

// Constraint Schemas
export const ConstraintSchema = z.object({
  horizontal: z.enum(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']).default('MIN'),
  vertical: z.enum(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']).default('MIN'),
});

// Responsive Breakpoint Schema
export const BreakpointSchema = z.object({
  name: z.enum(['mobile', 'tablet', 'desktop', 'wide']),
  minWidth: z.number(),
  maxWidth: z.number().optional(),
});

export const ResponsiveOverrideSchema = z.object({
  breakpoint: BreakpointSchema.shape.name,
  layout: AutoLayoutSchema.optional(),
  visibility: z.boolean().optional(),
  styles: z.record(z.string(), z.unknown()).optional(),
});

// Component Semantic Types
export const ComponentTypeSchema = z.enum([
  // Containers
  'CONTAINER',
  'FRAME',
  'GROUP',
  'SECTION',

  // Layout Components
  'NAVBAR',
  'SIDEBAR',
  'HEADER',
  'FOOTER',
  'CARD',
  'MODAL',
  'DRAWER',
  'TABS',
  'ACCORDION',

  // Interactive Elements
  'BUTTON',
  'ICON_BUTTON',
  'LINK',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'CHECKBOX',
  'RADIO',
  'SWITCH',
  'SLIDER',
  'DATE_PICKER',

  // Display Elements
  'TEXT',
  'HEADING',
  'PARAGRAPH',
  'LABEL',
  'IMAGE',
  'ICON',
  'AVATAR',
  'BADGE',
  'TAG',
  'CHIP',
  'DIVIDER',
  'PROGRESS',
  'SPINNER',
  'SKELETON',

  // Data Display
  'TABLE',
  'LIST',
  'LIST_ITEM',
  'TREE',
  'DATA_GRID',

  // Feedback
  'ALERT',
  'TOAST',
  'TOOLTIP',
  'POPOVER',

  // Navigation
  'BREADCRUMB',
  'PAGINATION',
  'STEPPER',
  'MENU',
  'DROPDOWN',

  // Unknown/Custom
  'UNKNOWN',
]);

// Component Variant Schema
export const VariantSchema = z.object({
  name: z.string(),
  value: z.string(),
});

// Bounding Box Schema
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
});

// Base Style Schema
export const StyleSchema = z.object({
  backgroundColor: z.string().optional(),
  backgroundGradient: z.string().optional(),
  backgroundImage: z.string().optional(),
  textColor: z.string().optional(),
  typography: TypographyTokenSchema.optional(),
  border: BorderTokenSchema.optional(),
  shadows: z.array(ShadowTokenSchema).optional(),
  opacity: z.number().min(0).max(1).optional(),
  overflow: z.enum(['visible', 'hidden', 'scroll', 'auto']).optional(),
  cursor: z.string().optional(),
});

// IR Node Schema (recursive)
export const IRNodeSchema: z.ZodType<IRNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['container', 'component', 'text', 'image', 'vector']),
    componentType: ComponentTypeSchema,
    figmaNodeId: z.string().optional(),

    // Hierarchy
    children: z.array(IRNodeSchema).optional(),

    // Layout & Position
    boundingBox: BoundingBoxSchema,
    autoLayout: AutoLayoutSchema.optional(),
    constraints: ConstraintSchema.optional(),

    // Styling
    styles: StyleSchema,

    // Responsive
    responsiveOverrides: z.array(ResponsiveOverrideSchema).optional(),

    // Component Props
    props: z.record(z.string(), z.unknown()).optional(),
    variants: z.array(VariantSchema).optional(),

    // Content
    textContent: z.string().optional(),
    imageUrl: z.string().optional(),
    iconName: z.string().optional(),

    // Semantic hints
    semanticRole: z.string().optional(),
    accessibilityLabel: z.string().optional(),

    // State variants
    states: z.object({
      hover: StyleSchema.optional(),
      active: StyleSchema.optional(),
      focus: StyleSchema.optional(),
      disabled: StyleSchema.optional(),
    }).optional(),

    // Mapping hints
    mappedComponent: z.string().optional(),
    mappingConfidence: z.number().min(0).max(1).optional(),
  })
);

// Root IR Document Schema
export const IRDocumentSchema = z.object({
  version: z.string().default('1.0.0'),
  figmaFileId: z.string(),
  figmaFileName: z.string(),
  figmaNodeId: z.string().optional(),
  extractedAt: z.string(),

  // Canvas info
  canvas: z.object({
    width: z.number(),
    height: z.number(),
    backgroundColor: z.string().optional(),
  }),

  // Design tokens
  designTokens: z.object({
    colors: z.record(z.string(), ColorTokenSchema).optional(),
    typography: z.record(z.string(), TypographyTokenSchema).optional(),
    spacing: z.record(z.string(), z.number()).optional(),
    borderRadius: z.record(z.string(), z.number()).optional(),
    shadows: z.record(z.string(), ShadowTokenSchema).optional(),
  }).optional(),

  // Breakpoints configuration
  breakpoints: z.array(BreakpointSchema).default([
    { name: 'mobile', minWidth: 0, maxWidth: 639 },
    { name: 'tablet', minWidth: 640, maxWidth: 1023 },
    { name: 'desktop', minWidth: 1024, maxWidth: 1279 },
    { name: 'wide', minWidth: 1280 },
  ]),

  // Component tree
  root: IRNodeSchema,

  // Detected component instances
  componentInstances: z.array(z.object({
    nodeId: z.string(),
    componentName: z.string(),
    componentSetId: z.string().optional(),
    variants: z.array(VariantSchema).optional(),
  })).optional(),

  // Assets
  assets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['image', 'icon', 'vector']),
    url: z.string().optional(),
    svgContent: z.string().optional(),
  })).optional(),
});

// TypeScript Types derived from schemas
export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type TypographyToken = z.infer<typeof TypographyTokenSchema>;
export type SpacingToken = z.infer<typeof SpacingTokenSchema>;
export type BorderToken = z.infer<typeof BorderTokenSchema>;
export type ShadowToken = z.infer<typeof ShadowTokenSchema>;
export type LayoutMode = z.infer<typeof LayoutModeSchema>;
export type Alignment = z.infer<typeof AlignmentSchema>;
export type Justify = z.infer<typeof JustifySchema>;
export type AutoLayout = z.infer<typeof AutoLayoutSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type Breakpoint = z.infer<typeof BreakpointSchema>;
export type ResponsiveOverride = z.infer<typeof ResponsiveOverrideSchema>;
export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type Style = z.infer<typeof StyleSchema>;
export type IRDocument = z.infer<typeof IRDocumentSchema>;

// Recursive type for IR Node
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
  responsiveOverrides?: ResponsiveOverride[];
  props?: Record<string, unknown>;
  variants?: Variant[];
  textContent?: string;
  imageUrl?: string;
  iconName?: string;
  semanticRole?: string;
  accessibilityLabel?: string;
  states?: {
    hover?: Style;
    active?: Style;
    focus?: Style;
    disabled?: Style;
  };
  mappedComponent?: string;
  mappingConfidence?: number;
}
