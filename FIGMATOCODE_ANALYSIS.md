# FIGMATOCODE DEEP-DIVE ANALYSIS

**Repository**: https://github.com/bernaferrari/FigmaToCode
**License**: GPL-3.0 (Study only - cannot copy code for commercial use)
**Stars**: 16.5k
**Analysis Date**: 2025-11-25

---

## Executive Summary

FigmaToCode is a sophisticated Figma plugin that converts design nodes into code across **7+ frameworks** (HTML, React/JSX, Tailwind, Svelte, styled-components, Flutter, SwiftUI, Jetpack Compose). The system uses a **4-stage pipeline architecture** with an intermediate representation (AltNode) to optimize output quality across diverse target frameworks.

### Key Architectural Insights

1. **Intermediate Representation Layer**: Creates AltNode (annotated Figma node) before code generation
2. **Builder Pattern**: Framework-specific builders with method chaining for composable property generation
3. **Framework-Agnostic Core**: Shared utilities in `/common` work for all target frameworks
4. **Plugin Architecture**: Runs natively in Figma for real-time updates and zero-latency conversion

### Most Critical Learning Points

1. **Layout Engine**: Sophisticated AutoLayout → Flexbox/Grid conversion with rotation handling
2. **FILL/HUG/FIXED Sizing**: Context-aware sizing logic based on parent layout mode
3. **Color Variable Resolution**: Figma design tokens mapped to CSS custom properties
4. **Multi-Segment Text**: Rich text handling with inline styling
5. **Real-Time Feedback**: Plugin responds immediately to selection changes

---

## 1. Architecture Overview

### 4-Stage Pipeline

```
┌─────────────────────────────────────────┐
│  STAGE 1: Node JSON Conversion         │
│  • figma.getNodeById()                  │
│  • Extract all properties               │
│  • Process color variables              │
│  • Handle text segments                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  STAGE 2: AltNode Creation              │
│  • Intermediate representation          │
│  • Icon detection                       │
│  • Unique naming                        │
│  • Parent references                    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  STAGE 3: Layout Optimization           │
│  • AutoLayout analysis                  │
│  • Position calculation (abs/rel)       │
│  • Rotation handling                    │
│  • Color variable mapping               │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  STAGE 4: Framework Code Generation     │
│  • HTML/JSX Builder                     │
│  • Tailwind Builder                     │
│  • Flutter/SwiftUI/Compose Builder      │
│  • Format output                        │
└──────────────┬──────────────────────────┘
               │
         ┌─────▼──────┐
         │   OUTPUT   │
         └────────────┘
```

### Directory Structure

```
packages/backend/src/
├── altNodes/              # Intermediate representation
├── common/                # Framework-agnostic utilities (20+ files)
├── html/                  # HTML/React/JSX/Svelte
├── tailwind/              # Tailwind CSS
├── flutter/               # Flutter/Dart
├── swiftui/               # SwiftUI/Swift
├── compose/               # Jetpack Compose/Kotlin
├── code.ts               # Main orchestrator
└── messaging.ts          # Plugin ↔ UI communication
```

---

## 2. Layout Engine (Most Critical)

### 2.1 AutoLayout → Flexbox Conversion

**Key Algorithm**: Map Figma's AutoLayout properties to CSS Flexbox

```typescript
// Figma AutoLayout Properties
interface AutoLayout {
  layoutMode: "HORIZONTAL" | "VERTICAL" | "NONE";
  primaryAxisAlignItems: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems: "MIN" | "CENTER" | "MAX" | "BASELINE";
  itemSpacing: number;
  layoutWrap: "WRAP" | "NO_WRAP";
  paddingLeft/Right/Top/Bottom: number;
}

// CSS Flexbox Mapping
HORIZONTAL → flex-direction: row
VERTICAL   → flex-direction: column

// Alignment Mappings
primaryAxisAlignItems (justify-content):
  MIN            → flex-start
  CENTER         → center
  MAX            → flex-end
  SPACE_BETWEEN  → space-between

counterAxisAlignItems (align-items):
  MIN      → flex-start
  CENTER   → center
  MAX      → flex-end
  BASELINE → baseline

// Gap Handling
itemSpacing > 0 && primaryAxis !== SPACE_BETWEEN
  → gap: {itemSpacing}px
```

**Implementation Files**:
- `htmlAutoLayout.ts` - HTML/CSS flex generation
- `tailwindAutoLayout.ts` - Tailwind utility classes (flex, flex-col, gap-4)
- `flutterAutoLayout.ts` - Row/Column widgets
- `swiftuiAutoLayout.ts` - HStack/VStack
- `composeAutoLayout.ts` - Row/Column composables

### 2.2 FILL/HUG/FIXED Sizing (Context-Aware)

**Critical Algorithm**: Sizing depends on parent's layout mode

```typescript
// Figma Sizing Modes
layoutSizingHorizontal: "FILL" | "HUG" | {fixed_number}

// Conversion Logic
FILL (takes remaining space):
  ├─ Parent has HORIZONTAL layout
  │  └─ CSS: flex: 1 1 0 (or width: 100%)
  │     Tailwind: w-full
  │     Flutter: Expanded()
  │     SwiftUI: .frame(maxWidth: .infinity)
  │     Compose: Modifier.fillMaxWidth()
  │
  └─ Parent has VERTICAL layout
     └─ CSS: width: 100%
        Tailwind: w-full

HUG (fit to content):
  └─ All frameworks: implicit/auto sizing

FIXED (explicit size):
  └─ All frameworks: width: {value}px|dp|sp
```

**Why This Matters**: Incorrect sizing breaks responsive layouts. FigmaToCode's context-aware logic ensures fidelity.

### 2.3 Rotation Handling (Most Complex Algorithm)

**File**: `commonPosition.ts`

**Problem**: CSS rotates around element center. We need to find original dimensions and position such that when rotated, the bounding box matches Figma's.

```typescript
// Mathematical Algorithm
function calculateRectangleFromBoundingBox(
  boundingBox: { width, height, x, y },
  figmaRotationDegrees: number
): RectangleStyle {
  // STEP 1: Convert Figma rotation to CSS rotation
  const cssRotation = -figmaRotationDegrees;
  const theta = (cssRotation * Math.PI) / 180;

  // STEP 2: Calculate rotated rectangle dimensions
  // Given rotated bounding box (w_b, h_b)
  // Find original dimensions (w, h) such that:
  //   w_rotated = w * cos(θ) + h * sin(θ)
  //   h_rotated = -w * sin(θ) + h * cos(θ)

  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const denominator = cosTheta * cosTheta - sinTheta * sinTheta;

  // Solve the system of equations
  const h = (w_b * sinTheta - h_b * cosTheta) / -denominator;
  const w = (w_b - h * sinTheta) / cosTheta;

  // STEP 3: Find top-left corner after rotation
  // Rotate all 4 corners and find minimum x,y
  const corners = [
    {x: 0, y: 0},
    {x: w, y: 0},
    {x: w, y: h},
    {x: 0, y: h}
  ];

  const rotatedCorners = corners.map(c => ({
    x: c.x * cosTheta + c.y * sinTheta,
    y: -c.x * sinTheta + c.y * cosTheta
  }));

  const minX = Math.min(...rotatedCorners.map(c => c.x));
  const minY = Math.min(...rotatedCorners.map(c => c.y));

  return {
    width: w,
    height: h,
    left: boundingBox.x - minX,
    top: boundingBox.y - minY,
    rotation: cssRotation
  };
}
```

**Why This Matters**: Without this algorithm, rotated elements appear in wrong positions. This is the most mathematically sophisticated part of FigmaToCode.

### 2.4 Absolute vs Relative Positioning

```typescript
function commonIsAbsolutePosition(node: SceneNode): boolean {
  // ABSOLUTE if explicitly marked
  if (node.layoutPositioning === "ABSOLUTE") return true;

  // ABSOLUTE if parent has no layout mode
  if (node.parent && "layoutMode" in node.parent) {
    return node.parent.layoutMode === "NONE";
  }

  return false;
}

// Decision Tree:
// 1. Check node.layoutPositioning
// 2. Check parent.layoutMode
// 3. Determine: absolute positioning or flex child
```

---

## 3. Multi-Framework Support

### 3.1 Builder Pattern

Each framework implements a builder class with method chaining:

```typescript
class HtmlDefaultBuilder {
  styles: Array<string>;      // Accumulated CSS properties
  data: Array<string>;        // Data attributes
  node: SceneNode;
  settings: HTMLSettings;

  // Method chaining for composition
  commonPositionStyles(): this {
    this.size();
    this.autoLayoutPadding();
    this.position();
    this.blend();
    return this;
  }

  commonShapeStyles(): this {
    this.applyFillsToStyle(this.node.fills, "background");
    this.shadow();
    this.border();
    this.blur();
    return this;
  }

  // Framework-specific methods
  border(): this { /* implementation */ }
  shadow(): this { /* implementation */ }

  // Final output
  build(): string {
    return this.styles.join(";") + this.data.join("");
  }
}

// USAGE
const builder = new HtmlDefaultBuilder(node, settings)
  .commonPositionStyles()
  .commonShapeStyles();

const html = `<div style="${builder.build()}">${children}</div>`;
```

### 3.2 Framework Comparison

| Framework | Layout Model | Sizing | Strengths |
|-----------|-------------|--------|-----------|
| **HTML/JSX** | Flexbox, inline-flex | px, % | Full control, semantic |
| **Tailwind** | Utility classes | Tailwind scale | Rapid styling, no CSS files |
| **Flutter** | Row, Column, Stack | dp, logical pixels | Mobile-optimized, widget tree |
| **SwiftUI** | HStack, VStack, ZStack | points | iOS-native, declarative |
| **Compose** | Row, Column, Box | dp, Modifier chain | Android-native, Jetpack |

### 3.3 Framework-Specific Files

Each framework has three layers:

```
Framework Directory
├── {framework}Main.ts              # Orchestrator
├── {framework}DefaultBuilder.ts    # Shape/layout builder
├── {framework}TextBuilder.ts       # Text builder
└── builderImpl/
    ├── {framework}AutoLayout.ts    # Layout conversion
    ├── {framework}Color.ts         # Color mapping
    ├── {framework}Size.ts          # Width/height
    ├── {framework}Padding.ts       # Padding/margin
    ├── {framework}Border.ts        # Border/radius
    └── {framework}Shadow.ts        # Shadow/blur
```

---

## 4. Color Variable System

### 4.1 Color Variable Extraction

**File**: `jsonNodeConversion.ts`

```typescript
// ALGORITHM: Map Figma color variables to framework variables

// STEP 1: Traverse node tree, collect all fills/strokes
for (const node of nodes) {
  if (node.fills) {
    await Promise.all(
      node.fills.map(fill => processColorVariables(fill))
    );
  }
}

// STEP 2: For each fill with boundVariables.color
async function processColorVariables(paint: Paint) {
  if (paint.boundVariables?.color) {
    const variableId = paint.boundVariables.color.id;
    const variableName = await variableToColorName(variableId);

    // Store mapping: hex_color → variable_name
    colorMappings.set(rgbToHex(paint.color), {
      variableId,
      variableName: sanitize(variableName) // "primary-red"
    });
  }
}

// STEP 3: During code generation
function getColorValue(color: RGB): string {
  const hex = rgbToHex(color);
  const mapping = colorMappings.get(hex);

  if (mapping) {
    // Use CSS variable
    return `var(--${mapping.variableName})`;
  } else {
    // Use literal color
    return hex;
  }
}
```

**Output Example**:
```css
/* Without variables */
background-color: #3B82F6;

/* With variables */
background-color: var(--primary-blue);
```

### 4.2 Color Conversion Utilities

**File**: `common/color.ts`

```typescript
// RGB (0-1) → Hex
function rgbToCssColor(color: RGB | RGBA, alpha: number = 1): string {
  // White/black optimization
  if (r === 1 && g === 1 && b === 1 && alpha === 1) return "white";
  if (r === 0 && g === 0 && b === 0 && alpha === 1) return "black";

  // Hex for opaque
  if (alpha === 1) {
    return `#${toHex(r * 255)}${toHex(g * 255)}${toHex(b * 255)}`;
  }

  // RGBA for transparent
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

// Gradient angle calculation
function calculateGradientAngle(transform: Transform): number {
  // Extract rotation from 2D transformation matrix
  const [[m00, m01], [m10, m11]] = transform;
  const angle = Math.atan2(m10, m00) * (180 / Math.PI);
  return Math.round(angle + 90); // Adjust for CSS gradient angle
}
```

---

## 5. Text Handling

### 5.1 Multi-Segment Text

**Challenge**: A single Figma text node can have multiple styled segments

```typescript
// Figma allows rich text
TextNode: "Hello World"
  ├─ "Hello" → fontSize: 16, fontWeight: 400, color: black
  └─ "World" → fontSize: 18, fontWeight: 700, color: red

// Generation Strategy
Single segment (simple):
  <p class="text-16 font-normal">Hello World</p>

Multiple segments (complex):
  <p>
    <span class="text-16 font-normal">Hello</span>
    <span class="text-18 font-bold text-red-600">World</span>
  </p>

// Special formatting
OpenType features:
  SUPS → <sup>superscript</sup>
  SUBS → <sub>subscript</sub>
```

### 5.2 Styled Text Segments

**File**: `jsonNodeConversion.ts` (getStyledTextSegments)

```typescript
interface StyledTextSegment {
  characters: string;
  start: number;
  end: number;

  // Typography
  fontSize: number;
  fontFamily: string;
  fontWeight: string;  // "100" to "900"
  lineHeight: { value: number, unit: "PIXELS" | "PERCENT" };
  letterSpacing: { value: number, unit: "PIXELS" | "PERCENT" };

  // Text effects
  textDecoration?: "UNDERLINE" | "STRIKETHROUGH";
  textCase?: "UPPER" | "LOWER" | "TITLE";

  // Advanced
  fills: Paint[];
  openTypeFeatures?: Record<string, boolean>;
}

// Extraction
async function getStyledTextSegments(node: TextNode): StyledTextSegment[] {
  const segments: StyledTextSegment[] = [];

  for (let i = 0; i < node.characters.length; i++) {
    const segment = {
      characters: node.characters[i],
      start: i,
      end: i + 1,
      fontSize: await node.getRangeFontSize(i, i + 1),
      fontWeight: await node.getRangeFontWeight(i, i + 1),
      // ... other properties
    };

    segments.push(segment);
  }

  // Merge consecutive segments with identical styling
  return mergeIdenticalSegments(segments);
}
```

---

## 6. Performance & Optimization

### 6.1 Performance Tracking

**File**: `jsonNodeConversion.ts`

```typescript
// Built-in benchmarking
interface PerformanceMetrics {
  getNodeByIdAsyncTime: number;       // Accumulated milliseconds
  getNodeByIdAsyncCalls: number;      // Call count
  getStyledTextSegmentsTime: number;
  getStyledTextSegmentsCalls: number;
  processColorVariablesTime: number;
  processColorVariablesCalls: number;
}

// Usage
const start = Date.now();
const result = await getNodeByIdAsync(id);
getNodeByIdAsyncTime += Date.now() - start;
getNodeByIdAsyncCalls++;
```

### 6.2 Memoization & Caching

```typescript
// Color variable name caching
const variableNameCache = new Map<string, string>();

async function variableToColorName(variableId: string): Promise<string> {
  if (variableNameCache.has(variableId)) {
    return variableNameCache.get(variableId)!;
  }

  const variable = await figma.variables.getVariableByIdAsync(variableId);
  const name = variable?.name || "unknown";

  variableNameCache.set(variableId, name);
  return name;
}
```

### 6.3 Parallel Processing

```typescript
// Process all fills/strokes in parallel
await Promise.all([
  ...node.fills.map(fill => processColorVariables(fill)),
  ...node.strokes.map(stroke => processColorVariables(stroke))
]);

// Process all text segments in parallel
await Promise.all(
  nodes.filter(n => n.type === "TEXT")
       .map(node => getStyledTextSegments(node))
);
```

---

## 7. Plugin Architecture

### 7.1 Two Operational Modes

```typescript
// 1. STANDARD MODE (default)
async function standardMode() {
  // Show UI in plugin panel
  figma.showUI(__html__, { width: 500, height: 500 });

  // Respond to selection changes
  figma.on('selectionchange', async () => {
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
      await run(currentSettings);
    }
  });

  // Real-time code generation
  // Color panel visible
  // Supports framework switching
}

// 2. CODEGEN MODE (Figma 5.4+)
async function codegenMode() {
  // Headless operation
  // Language-specific generation
  // Integrated into Figma's design-to-code workflow

  figma.codegen.on('generate', async (event: CodegenEvent) => {
    const node = event.node;
    const language = event.language; // 'HTML', 'JSX', etc.

    const code = await convertToCode([node], {
      framework: language,
      ...settings
    });

    return [{
      title: `${language} Component`,
      code: code,
      language: language.toLowerCase()
    }];
  });
}
```

### 7.2 Plugin ↔ UI Communication

**File**: `messaging.ts`

```typescript
// Message Types
type PluginMessage =
  | { type: 'conversion-complete', data: ConversionResult }
  | { type: 'settings-changed', settings: PluginSettings }
  | { type: 'error', message: string };

// Plugin → UI
function postConversionComplete(result: ConversionResult) {
  figma.ui.postMessage({
    type: 'conversion-complete',
    data: result
  });
}

// UI → Plugin
figma.ui.onmessage = (msg: PluginMessage) => {
  switch (msg.type) {
    case 'settings-changed':
      currentSettings = msg.settings;
      await run(currentSettings);
      break;
    case 'export-code':
      await exportCodeToFile(msg.data);
      break;
  }
};
```

---

## 8. Key Algorithms Summary

### 8.1 Layout Calculation
```
INPUT: Figma node with AutoLayout
  ↓
1. Detect layout mode (HORIZONTAL/VERTICAL/NONE)
2. Map alignment properties (primaryAxis, counterAxis)
3. Handle spacing (itemSpacing, padding)
4. Calculate child sizes (FILL/HUG/FIXED)
5. Handle rotation (bounding box adjustment)
  ↓
OUTPUT: Framework-specific layout code
```

### 8.2 Color Processing
```
INPUT: Figma node with fills/strokes
  ↓
1. Extract color properties (RGB/RGBA)
2. Check for bound color variables
3. Resolve variable names asynchronously
4. Store color → variable mappings
5. During generation: lookup and use variables
  ↓
OUTPUT: CSS with custom properties or literal colors
```

### 8.3 Text Generation
```
INPUT: Figma TextNode
  ↓
1. Extract character content
2. Get styled text segments (per-character styles)
3. Merge consecutive identical segments
4. Check for OpenType features (SUPS, SUBS)
5. Generate framework-specific text elements
  ↓
OUTPUT: Text elements with inline styling
```

---

## 9. Technology Stack

### Core Dependencies

```json
{
  "build_system": "Turborepo + esbuild",
  "package_manager": "pnpm 9.14.4",
  "language": "TypeScript 5.8.3",
  "figma_api": "@figma/plugin-typings 1.114.0",
  "utilities": {
    "nanoid": "5.1.5 (unique ID generation)",
    "js-base64": "3.7.7 (image encoding)"
  },
  "ui_framework": "React 19.0.0",
  "linting": "ESLint 9.29.0",
  "formatting": "Prettier 3.6.2"
}
```

### Build Configuration

**Monorepo Structure** (Turborepo):
- Incremental builds (only modified packages)
- Concurrent compilation (concurrency: 20)
- Shared TypeScript/ESLint configs
- Workspace dependencies

**Key Insight**: No template engines (Handlebars, EJS). Uses string concatenation + builder pattern for maximum control.

---

## 10. Comparison: FigmaToCode vs Our System

### Strengths of FigmaToCode

| Feature | FigmaToCode | Our System |
|---------|------------|-----------|
| **Layout Engine** | ⭐⭐⭐⭐⭐ Advanced rotation, FILL/HUG | ⭐⭐⭐ Basic layout support |
| **Multi-Framework** | ⭐⭐⭐⭐⭐ 7+ frameworks | ⭐⭐ React only |
| **Color Variables** | ⭐⭐⭐⭐ Figma variables → CSS vars | ⭐⭐ Basic color mapping |
| **Real-Time Updates** | ⭐⭐⭐⭐⭐ Plugin with live updates | ⭐⭐⭐ API-based (slower) |
| **Text Handling** | ⭐⭐⭐⭐⭐ Multi-segment + OpenType | ⭐⭐⭐ Basic text extraction |
| **Performance** | ⭐⭐⭐⭐ Built-in benchmarking | ⭐⭐⭐ Basic optimization |

### Our System's Advantages

| Feature | Our System | FigmaToCode |
|---------|-----------|-------------|
| **Component Mapping** | ⭐⭐⭐⭐ 40+ semantic types | ⭐⭐ Icon detection only |
| **Visual Validation** | ⭐⭐⭐⭐⭐ Puppeteer + pixelmatch | ❌ None |
| **Auto-Correction** | ⭐⭐⭐⭐⭐ Build errors + visual | ❌ None |
| **LLM Integration** | ⭐⭐⭐⭐⭐ OpenAI generation | ❌ None |
| **Sandbox Execution** | ⭐⭐⭐⭐⭐ Vite + TypeScript validation | ❌ None |
| **Design Tokens** | ⭐⭐⭐ Partial extraction | ⭐⭐ Color variables only |

### Gap Analysis

**What FigmaToCode Does Better**:
1. Layout algorithms (rotation, FILL/HUG/FIXED)
2. Multi-framework support architecture
3. Real-time plugin feedback
4. Color variable system
5. Text segment handling
6. Performance tracking

**What Our System Does Better**:
1. Component semantic mapping (40+ types)
2. Visual validation and comparison
3. Autonomous error correction
4. LLM-powered generation
5. Complete build pipeline
6. Sandbox execution and validation

**Where Both Can Improve**:
1. Design system awareness (comprehensive token extraction)
2. Responsive variant generation (@media queries)
3. Accessibility features (ARIA, semantic HTML)
4. Advanced theming (theme provider generation)
5. Component library integration (Chakra, Material UI, etc.)

---

## 11. Integration Strategy (GPL-3.0 Compliant)

### ✅ What We CAN Do (Legal)

1. **Study Architecture**:
   - Learn from their 4-stage pipeline design
   - Understand builder pattern implementation
   - Study intermediate representation approach

2. **Learn Algorithms** (Concept Level):
   - Rotation bounding box mathematics
   - FILL/HUG/FIXED sizing logic
   - Color variable resolution pattern
   - Text segment processing approach

3. **Adopt Design Patterns**:
   - Builder pattern for property composition
   - Framework-agnostic core utilities
   - Multi-framework plugin architecture
   - Real-time feedback systems

### ❌ What We CANNOT Do (GPL Violation)

1. **Copy Code**:
   - Cannot copy-paste any source files
   - Cannot adapt implementations directly
   - Cannot use their string generation patterns verbatim
   - Cannot reuse test cases or fixtures

2. **Derive Directly**:
   - Cannot create "cleaned up" versions of their code
   - Cannot translate their TypeScript to our TypeScript
   - Cannot extract and reuse specific functions

### ✅ Recommended Approach (Clean Room)

1. **Document Algorithms** (This Document):
   - Write our own descriptions of their algorithms
   - Create our own pseudocode
   - Draw our own diagrams

2. **Implement Independently**:
   - Use our documented understanding to write NEW code
   - Different variable names, different structure
   - Our own comments and documentation

3. **Benchmark Against**:
   - Compare output quality (not code similarity)
   - Test our implementation vs their results
   - Validate layout fidelity independently

---

## 12. Recommended Learning Path

### Phase 1: Deep Algorithm Study (Current)
✅ Understand their architecture
✅ Document key algorithms in our own words
✅ Identify patterns we want to adopt

### Phase 2: Clean-Room Design (Next)
- Design our own layout engine using learned concepts
- Create our own builder pattern implementation
- Design our own color variable system

### Phase 3: Independent Implementation
- Write NEW code based on our design
- Test against Figma files (not their code)
- Validate output quality independently

### Phase 4: Integration with Our Strengths
- Combine with our visual validation
- Integrate with our LLM generation
- Add our component mapping logic
- Enhance with our auto-correction

---

## 13. Key Takeaways

### Most Important Learnings

1. **Intermediate Representation is Critical**:
   - Don't generate code directly from Figma nodes
   - Create annotated IR for optimization before generation
   - Allows framework-agnostic analysis

2. **Layout is the Hardest Problem**:
   - Rotation requires complex mathematics
   - FILL/HUG/FIXED needs context awareness
   - Parent-child relationships affect sizing

3. **Builder Pattern Scales Well**:
   - Method chaining for composition
   - Framework-specific implementations
   - Shared core utilities

4. **Color Variables Need Early Resolution**:
   - Extract mappings during node traversal
   - Store for lookup during generation
   - Critical for design token support

5. **Real-Time Feedback is Powerful**:
   - Plugin architecture enables instant updates
   - Selection changes trigger regeneration
   - Visual preview improves UX

### Architecture Decisions to Adopt

1. ✅ **4-Stage Pipeline**: Extract → IR → Optimize → Generate
2. ✅ **Builder Pattern**: Composable property generation
3. ✅ **Framework-Agnostic Core**: Shared utilities
4. ✅ **Performance Tracking**: Built-in benchmarking
5. ✅ **Warning System**: User feedback on limitations

### What to Build Differently

1. **Component Mapping**: Extend beyond icons to full design systems
2. **Design Tokens**: Comprehensive token extraction (not just colors)
3. **Responsive Variants**: Generate @media queries and breakpoints
4. **Accessibility**: Add ARIA and semantic HTML generation
5. **Visual Validation**: Integrate with our existing Puppeteer system

---

## 14. Next Steps

### Immediate Actions

1. ✅ Complete this analysis document
2. ✅ Create comparison matrix with our system
3. ⏭️ Design our own layout engine (clean-room)
4. ⏭️ Implement builder pattern for our generators
5. ⏭️ Add color variable extraction to our IR

### Short-Term (1-2 Weeks)

1. Enhance our IR schema with AutoLayout properties
2. Implement FILL/HUG/FIXED sizing logic
3. Add rotation handling to position calculation
4. Create builder classes for React generation
5. Add performance tracking to our pipeline

### Medium-Term (1-2 Months)

1. Multi-framework support (Vue, Angular)
2. Design token extraction system
3. Responsive variant generation
4. Plugin architecture exploration
5. Real-time preview integration

---

## Appendix: File Reference

### Critical Files to Study Further

1. **Layout Engine**:
   - `commonPosition.ts` (rotation algorithm)
   - `htmlAutoLayout.ts` (flex conversion)
   - `nodeWidthHeight.ts` (FILL/HUG/FIXED)

2. **Color System**:
   - `jsonNodeConversion.ts` (variable extraction)
   - `common/color.ts` (color utilities)

3. **Text Handling**:
   - `htmlTextBuilder.ts` (text generation)
   - `tailwindTextBuilder.ts` (Tailwind text)

4. **Builder Pattern**:
   - `htmlDefaultBuilder.ts` (HTML builder)
   - `tailwindDefaultBuilder.ts` (Tailwind builder)

5. **Orchestration**:
   - `code.ts` (main pipeline)
   - `convertToCode.ts` (framework router)

---

**Analysis Complete**: 2025-11-25
**Next**: Create integration plan and start Phase 1 implementation
