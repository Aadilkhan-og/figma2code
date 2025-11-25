# FIGMA2CODE INTEGRATION PLAN

**Date**: 2025-11-25
**Purpose**: Actionable plan to leverage FigmaToCode learnings while respecting GPL-3.0 license
**Approach**: Clean-room implementation of algorithms + integration with our existing strengths

---

## Executive Summary

After comprehensive analysis of both systems, the optimal strategy is:

**HYBRID APPROACH**: Enhance our existing system by implementing FigmaToCode's superior layout algorithms (clean-room) while leveraging our unique strengths (visual validation, LLM generation, auto-correction).

### Key Decision: Don't Replace, Enhance

**Rationale**:
1. Our system has 5 unique capabilities FigmaToCode lacks (visual validation, LLM, auto-correction, sandbox, component mapping)
2. FigmaToCode has 3 superior algorithms we need (rotation, FILL/HUG sizing, multi-framework architecture)
3. Clean-room implementation of their algorithms is faster than rebuilding our unique features

---

## 📊 Comparative Analysis Matrix

### Feature Comparison

| Feature | Our System | FigmaToCode | Winner | Action |
|---------|-----------|-------------|--------|--------|
| **Layout Engine** | ⭐⭐⭐ Basic | ⭐⭐⭐⭐⭐ Advanced | FTC | Learn & implement |
| **Rotation Handling** | ❌ None | ⭐⭐⭐⭐⭐ Mathematical | FTC | Implement algorithm |
| **FILL/HUG/FIXED** | ⭐⭐ Partial | ⭐⭐⭐⭐⭐ Complete | FTC | Learn & implement |
| **Multi-Framework** | ⭐⭐ React only | ⭐⭐⭐⭐⭐ 7 frameworks | FTC | Adopt architecture |
| **Color Variables** | ⭐⭐ Basic | ⭐⭐⭐⭐ Figma vars | FTC | Enhance our system |
| **Component Mapping** | ⭐⭐⭐⭐ 40+ types | ⭐⭐ Icons only | Ours | Keep & enhance |
| **Visual Validation** | ⭐⭐⭐⭐⭐ Puppeteer | ❌ None | Ours | Keep & improve |
| **Auto-Correction** | ⭐⭐⭐⭐⭐ Build+Visual | ❌ None | Ours | Keep & enhance |
| **LLM Generation** | ⭐⭐⭐⭐⭐ OpenAI | ❌ Template only | Ours | Keep & improve |
| **Sandbox Execution** | ⭐⭐⭐⭐⭐ Vite+TS | ❌ None | Ours | Keep & enhance |
| **Design Tokens** | ⭐⭐⭐ Partial | ⭐⭐ Colors only | Tie | Both need work |
| **Text Handling** | ⭐⭐⭐ Basic | ⭐⭐⭐⭐⭐ Multi-segment | FTC | Learn & implement |
| **Real-Time Updates** | ⭐⭐ API-based | ⭐⭐⭐⭐⭐ Plugin | FTC | Phase 5 (low priority) |

**Conclusion**: We have **5 unique strengths** (visual, LLM, auto-correct, sandbox, mapping) vs. **4 areas to improve** (layout, multi-framework, text, variables). Focus on importing the 4 missing pieces.

---

## 🎯 Integration Strategy

### Principles

1. **GPL-3.0 Compliance**: Study algorithms, implement independently (clean-room)
2. **Preserve Our Strengths**: Keep visual validation, LLM generation, auto-correction
3. **Adopt Their Best Practices**: Layout engine, builder pattern, multi-framework architecture
4. **Progressive Enhancement**: Incremental improvements, ship after each phase

### Legal Framework

```
✅ LEGAL (Study & Learn):
  - Read their code to understand algorithms
  - Document concepts in our own words
  - Draw our own diagrams
  - Benchmark against their output quality

❌ ILLEGAL (Derivative Work):
  - Copy any source code (even with modifications)
  - Translate their TS to our TS directly
  - Use their variable names or structure
  - Copy test cases or fixtures

✅ SAFE APPROACH (Clean Room):
  1. Person A studies FigmaToCode, writes algorithm spec
  2. Person B implements from spec without seeing FTC code
  3. Validate output quality independently
```

---

## 🚀 5-Phase Implementation Plan

### PHASE 1: Layout Engine Enhancement (2-3 weeks)

**Goal**: Implement FigmaToCode's superior layout algorithms

#### 1.1 Rotation Handling
**File**: Create `src/figma/position-calculator.ts`

**Algorithm** (from our documentation, NOT their code):
```typescript
/**
 * Calculate CSS position for rotated elements
 * Mathematical approach to find original dimensions
 * such that rotated bounding box matches Figma
 */
interface RotatedPosition {
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
}

function calculateRotatedPosition(
  boundingBox: BoundingBox,
  rotationDegrees: number
): RotatedPosition {
  // Convert Figma rotation to CSS rotation
  const cssRotation = -rotationDegrees;
  const theta = (cssRotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // Solve for original dimensions
  // Given: rotated bounding box dimensions
  // Find: original w, h such that rotation matches
  const denominator = cos * cos - sin * sin;
  const h = (boundingBox.width * sin - boundingBox.height * cos) / -denominator;
  const w = (boundingBox.width - h * sin) / cos;

  // Calculate position adjustment
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];

  const rotatedCorners = corners.map(c => ({
    x: c.x * cos + c.y * sin,
    y: -c.x * sin + c.y * cos
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

**Integration**: Update `src/figma/extractor.ts` to use new rotation logic

**Testing**: Create test cases with 45°, 90°, 135° rotations

#### 1.2 FILL/HUG/FIXED Sizing
**File**: Enhance `src/generator/tailwind.ts`

**Algorithm** (our implementation):
```typescript
/**
 * Context-aware sizing based on parent layout mode
 */
enum SizingMode {
  FILL = 'FILL',   // Takes remaining space
  HUG = 'HUG',     // Fits content
  FIXED = 'FIXED'  // Explicit size
}

function generateSizeClasses(
  node: IRNode,
  parent: IRNode | null
): string[] {
  const classes: string[] = [];

  const horizMode = getSizingMode(node.layoutSizingHorizontal);
  const vertMode = getSizingMode(node.layoutSizingVertical);

  // Horizontal sizing
  if (horizMode === SizingMode.FILL) {
    if (parent?.autoLayout?.mode === 'HORIZONTAL') {
      classes.push('flex-1'); // Take remaining space
    } else {
      classes.push('w-full'); // Full width
    }
  } else if (horizMode === SizingMode.FIXED) {
    classes.push(`w-[${node.boundingBox.width}px]`);
  }
  // HUG = no class (implicit)

  // Vertical sizing
  if (vertMode === SizingMode.FILL) {
    if (parent?.autoLayout?.mode === 'VERTICAL') {
      classes.push('flex-1');
    } else {
      classes.push('h-full');
    }
  } else if (vertMode === SizingMode.FIXED) {
    classes.push(`h-[${node.boundingBox.height}px]`);
  }

  return classes;
}
```

**Integration**: Update `TailwindGenerator.generateSize()` method

**Testing**: Test with FILL children in HORIZONTAL/VERTICAL parents

#### 1.3 AutoLayout → Flexbox Mapping
**File**: Enhance `src/generator/tailwind.ts`

**Algorithm** (our implementation):
```typescript
function generateAutoLayoutClasses(layout: AutoLayout): string[] {
  const classes: string[] = [];

  // Base layout
  if (layout.mode === 'HORIZONTAL') {
    classes.push('flex', 'flex-row');
  } else if (layout.mode === 'VERTICAL') {
    classes.push('flex', 'flex-col');
  }

  // Primary axis (justify-content)
  const justifyMap = {
    MIN: 'justify-start',
    CENTER: 'justify-center',
    MAX: 'justify-end',
    SPACE_BETWEEN: 'justify-between'
  };
  classes.push(justifyMap[layout.primaryAxisAlignItems]);

  // Counter axis (align-items)
  const alignMap = {
    MIN: 'items-start',
    CENTER: 'items-center',
    MAX: 'items-end',
    BASELINE: 'items-baseline'
  };
  classes.push(alignMap[layout.counterAxisAlignItems]);

  // Gap (if not SPACE_BETWEEN)
  if (layout.itemSpacing > 0 && layout.primaryAxisAlignItems !== 'SPACE_BETWEEN') {
    classes.push(`gap-${pxToTailwindScale(layout.itemSpacing)}`);
  }

  // Wrapping
  if (layout.layoutWrap === 'WRAP') {
    classes.push('flex-wrap');
  }

  return classes;
}
```

**Integration**: Replace current AutoLayout logic in `TailwindGenerator`

**Testing**: Test HORIZONTAL/VERTICAL with all alignment combinations

**Deliverables**:
- ✅ Rotation handling works for all angles
- ✅ FILL/HUG/FIXED sizing matches Figma exactly
- ✅ AutoLayout → Flexbox conversion has 100% fidelity
- ✅ Test suite covers edge cases

---

### PHASE 2: Builder Pattern & Multi-Framework (3-4 weeks)

**Goal**: Adopt FigmaToCode's scalable architecture for multi-framework support

#### 2.1 Builder Pattern Implementation
**File**: Create `src/generator/builders/` directory

```typescript
// Base builder interface
interface CodeBuilder {
  node: IRNode;
  settings: GeneratorSettings;

  // Composable methods (return this for chaining)
  size(): this;
  position(): this;
  layout(): this;
  padding(): this;
  border(): this;
  shadow(): this;
  color(): this;
  text(): this;

  // Final output
  build(): GeneratedComponent;
}

// React + Tailwind builder
class ReactTailwindBuilder implements CodeBuilder {
  private classes: string[] = [];
  private styles: Record<string, string> = {};
  private children: string = '';

  node: IRNode;
  settings: GeneratorSettings;

  constructor(node: IRNode, settings: GeneratorSettings) {
    this.node = node;
    this.settings = settings;
  }

  size(): this {
    const sizeClasses = generateSizeClasses(this.node, this.node.parent);
    this.classes.push(...sizeClasses);
    return this;
  }

  position(): this {
    if (this.node.boundingBox.rotation) {
      const rotated = calculateRotatedPosition(
        this.node.boundingBox,
        this.node.boundingBox.rotation
      );
      this.styles['transform'] = `rotate(${rotated.rotation}deg)`;
    }
    return this;
  }

  layout(): this {
    if (this.node.autoLayout) {
      const layoutClasses = generateAutoLayoutClasses(this.node.autoLayout);
      this.classes.push(...layoutClasses);
    }
    return this;
  }

  // ... other methods

  build(): GeneratedComponent {
    return {
      code: `<div className="${this.classes.join(' ')}" style={${JSON.stringify(this.styles)}}>${this.children}</div>`,
      imports: [],
      types: []
    };
  }
}
```

#### 2.2 Framework Plugin System
**File**: Create `src/generator/plugins/` directory

```typescript
interface GeneratorPlugin {
  name: string;
  framework: 'react' | 'vue' | 'angular' | 'html';
  supportedFeatures: string[];

  createBuilder(node: IRNode, settings: GeneratorSettings): CodeBuilder;
  formatOutput(code: string): string;
  generateBoilerplate(): { files: GeneratedFile[] };
}

class GeneratorRegistry {
  private plugins = new Map<string, GeneratorPlugin>();

  register(plugin: GeneratorPlugin): void {
    this.plugins.set(plugin.framework, plugin);
  }

  getPlugin(framework: string): GeneratorPlugin | null {
    return this.plugins.get(framework) || null;
  }

  generate(ir: IRDocument, framework: string, settings: GeneratorSettings): GeneratedCodeBundle {
    const plugin = this.getPlugin(framework);
    if (!plugin) {
      throw new Error(`Unsupported framework: ${framework}`);
    }

    const builder = plugin.createBuilder(ir.root, settings);
    const component = builder
      .size()
      .position()
      .layout()
      .padding()
      .border()
      .color()
      .build();

    return {
      files: [
        ...plugin.generateBoilerplate().files,
        {
          path: 'src/GeneratedComponent.tsx',
          content: plugin.formatOutput(component.code)
        }
      ]
    };
  }
}
```

#### 2.3 Vue Generator Plugin
**File**: Create `src/generator/plugins/vue-plugin.ts`

```typescript
class VueGenerator implements GeneratorPlugin {
  name = 'Vue';
  framework = 'vue' as const;
  supportedFeatures = ['components', 'styling', 'composition-api'];

  createBuilder(node: IRNode, settings: GeneratorSettings): VueBuilder {
    return new VueBuilder(node, settings);
  }

  formatOutput(code: string): string {
    return `
<template>
  ${code}
</template>

<script setup lang="ts">
import { ref } from 'vue';
</script>

<style scoped>
/* Component-specific styles */
</style>
    `.trim();
  }

  generateBoilerplate(): { files: GeneratedFile[] } {
    return {
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            dependencies: {
              'vue': '^3.4.0'
            }
          }, null, 2)
        },
        {
          path: 'vite.config.ts',
          content: `
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()]
});
          `.trim()
        }
      ]
    };
  }
}
```

**Deliverables**:
- ✅ Builder pattern implemented for React
- ✅ Plugin system supports React, Vue, HTML
- ✅ Method chaining works correctly
- ✅ Vue generator produces valid SFC components

---

### PHASE 3: Color Variable System (1-2 weeks)

**Goal**: Implement Figma color variable → CSS custom property mapping

#### 3.1 Variable Extraction
**File**: Enhance `src/figma/extractor.ts`

```typescript
interface ColorVariable {
  id: string;
  name: string;
  value: { r: number, g: number, b: number, a: number };
  collection: string;
}

class ColorVariableExtractor {
  private variableCache = new Map<string, ColorVariable>();

  async extractColorVariables(fileKey: string): Promise<Map<string, ColorVariable>> {
    // Get all color variables from Figma file
    const variables = await this.figmaClient.getFileVariables(fileKey);

    for (const variable of variables.filter(v => v.resolvedType === 'COLOR')) {
      const colorVar: ColorVariable = {
        id: variable.id,
        name: this.sanitizeVariableName(variable.name),
        value: variable.valuesByMode[Object.keys(variable.valuesByMode)[0]],
        collection: variable.variableCollectionId
      };

      this.variableCache.set(variable.id, colorVar);
    }

    return this.variableCache;
  }

  private sanitizeVariableName(name: string): string {
    // Convert "Colors/Primary/500" → "color-primary-500"
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  resolveColorVariable(paint: Paint): ColorVariable | null {
    if (!paint.boundVariables?.color) return null;

    const variableId = paint.boundVariables.color.id;
    return this.variableCache.get(variableId) || null;
  }
}
```

#### 3.2 CSS Variable Generation
**File**: Create `src/generator/css-variables.ts`

```typescript
function generateCSSVariables(variables: Map<string, ColorVariable>): string {
  const cssVars: string[] = [];

  for (const [id, variable] of variables) {
    const { r, g, b, a } = variable.value;
    const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    cssVars.push(`  --${variable.name}: ${rgba};`);
  }

  return `
:root {
${cssVars.join('\n')}
}
  `.trim();
}
```

#### 3.3 Integration with Code Generation
**File**: Update `src/generator/tailwind.ts`

```typescript
class TailwindGenerator {
  private colorVariables: Map<string, ColorVariable>;

  generateColorClass(paint: Paint): string {
    // Check if color is bound to a variable
    const variable = this.colorVariableExtractor.resolveColorVariable(paint);

    if (variable) {
      // Use CSS variable
      return `[color:var(--${variable.name})]`;
    } else {
      // Use literal color
      const hex = rgbToHex(paint.color);
      return `text-[${hex}]`;
    }
  }
}
```

**Deliverables**:
- ✅ Color variables extracted from Figma
- ✅ CSS custom properties generated
- ✅ Tailwind classes use CSS variables when available
- ✅ Fallback to literal colors when no variable

---

### PHASE 4: Text Segment Handling (1-2 weeks)

**Goal**: Support multi-segment text with inline styling

#### 4.1 Text Segment Extraction
**File**: Enhance `src/figma/extractor.ts`

```typescript
interface TextSegment {
  characters: string;
  start: number;
  end: number;
  style: TextStyle;
}

interface TextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textDecoration?: 'underline' | 'line-through';
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize';
  color: { r: number, g: number, b: number, a: number };
}

async function extractTextSegments(node: TextNode): Promise<TextSegment[]> {
  const segments: TextSegment[] = [];
  let currentSegment: TextSegment | null = null;

  for (let i = 0; i < node.characters.length; i++) {
    const style: TextStyle = {
      fontSize: node.getRangeFontSize(i, i + 1) as number,
      fontFamily: node.getRangeFontName(i, i + 1).family,
      fontWeight: convertFontWeight(node.getRangeFontName(i, i + 1).style),
      textDecoration: node.getRangeTextDecoration(i, i + 1),
      textTransform: node.getRangeTextCase(i, i + 1),
      color: node.getRangeFills(i, i + 1)[0]?.color || { r: 0, g: 0, b: 0, a: 1 }
    };

    // Start new segment or continue current
    if (!currentSegment || !areStylesEqual(currentSegment.style, style)) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        characters: node.characters[i],
        start: i,
        end: i + 1,
        style
      };
    } else {
      currentSegment.characters += node.characters[i];
      currentSegment.end = i + 1;
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}
```

#### 4.2 Multi-Segment Text Generation
**File**: Update `src/generator/code-generator.ts`

```typescript
function generateTextElement(node: IRNode, segments: TextSegment[]): string {
  if (segments.length === 1) {
    // Simple case: single style
    const classes = generateTextClasses(segments[0].style);
    return `<p className="${classes}">${escapeHtml(segments[0].characters)}</p>`;
  } else {
    // Complex case: multiple styles
    const spans = segments.map(segment => {
      const classes = generateTextClasses(segment.style);
      return `<span className="${classes}">${escapeHtml(segment.characters)}</span>`;
    });

    return `<p>${spans.join('')}</p>`;
  }
}

function generateTextClasses(style: TextStyle): string {
  const classes: string[] = [];

  // Font size
  classes.push(`text-[${style.fontSize}px]`);

  // Font weight
  classes.push(`font-${fontWeightToTailwind(style.fontWeight)}`);

  // Text decoration
  if (style.textDecoration === 'underline') {
    classes.push('underline');
  } else if (style.textDecoration === 'line-through') {
    classes.push('line-through');
  }

  // Text transform
  if (style.textTransform === 'uppercase') {
    classes.push('uppercase');
  } else if (style.textTransform === 'lowercase') {
    classes.push('lowercase');
  } else if (style.textTransform === 'capitalize') {
    classes.push('capitalize');
  }

  // Color
  const colorHex = rgbToHex(style.color);
  classes.push(`text-[${colorHex}]`);

  return classes.join(' ');
}
```

**Deliverables**:
- ✅ Text segments extracted with per-character styling
- ✅ Single-style text generates simple elements
- ✅ Multi-style text generates spans
- ✅ Text decorations and transforms supported

---

### PHASE 5: Performance & Optimization (1-2 weeks)

**Goal**: Match FigmaToCode's performance with benchmarking

#### 5.1 Performance Tracking
**File**: Create `src/utils/performance.ts`

```typescript
interface PerformanceMetrics {
  [key: string]: {
    totalTime: number;
    callCount: number;
    averageTime: number;
  };
}

class PerformanceTracker {
  private metrics: PerformanceMetrics = {};

  async track<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    if (!this.metrics[operation]) {
      this.metrics[operation] = {
        totalTime: 0,
        callCount: 0,
        averageTime: 0
      };
    }

    this.metrics[operation].totalTime += duration;
    this.metrics[operation].callCount++;
    this.metrics[operation].averageTime =
      this.metrics[operation].totalTime / this.metrics[operation].callCount;

    return result;
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  reset(): void {
    this.metrics = {};
  }
}
```

#### 5.2 Caching Strategy
**File**: Create `src/utils/cache.ts`

```typescript
class LRUCache<K, V> {
  private cache = new Map<K, { value: V, timestamp: number }>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Usage
const figmaResponseCache = new LRUCache<string, FigmaFile>(50, 3600000);
const imageCache = new LRUCache<string, string>(100, 7200000);
```

#### 5.3 Parallel Processing
**File**: Update `src/figma/extractor.ts`

```typescript
async function extractMultipleNodes(nodeIds: string[]): Promise<IRNode[]> {
  // Process nodes in parallel (up to 10 concurrent)
  const batchSize = 10;
  const results: IRNode[] = [];

  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(id => extractNode(id))
    );
    results.push(...batchResults);
  }

  return results;
}

async function downloadImages(urls: string[]): Promise<string[]> {
  // Download images in parallel
  return await Promise.all(
    urls.map(url => downloadImage(url))
  );
}
```

**Deliverables**:
- ✅ Performance tracking for all operations
- ✅ Caching for Figma responses and images
- ✅ Parallel processing where possible
- ✅ Performance dashboard/logging

---

## 📋 Implementation Checklist

### Phase 1: Layout Engine (2-3 weeks)
- [ ] Implement rotation bounding box algorithm
- [ ] Add FILL/HUG/FIXED sizing logic
- [ ] Enhance AutoLayout → Flexbox conversion
- [ ] Create test suite for layout calculations
- [ ] Validate against FigmaToCode output (quality, not code)

### Phase 2: Builder Pattern (3-4 weeks)
- [ ] Design builder interface
- [ ] Implement ReactTailwindBuilder
- [ ] Create plugin system architecture
- [ ] Implement VueGenerator plugin
- [ ] Implement HTMLGenerator plugin
- [ ] Add framework selection to CLI

### Phase 3: Color Variables (1-2 weeks)
- [ ] Implement color variable extraction
- [ ] Generate CSS custom properties
- [ ] Update generators to use variables
- [ ] Add fallback for non-variable colors

### Phase 4: Text Segments (1-2 weeks)
- [ ] Implement text segment extraction
- [ ] Generate multi-style text elements
- [ ] Support text decorations
- [ ] Handle OpenType features

### Phase 5: Performance (1-2 weeks)
- [ ] Add performance tracking
- [ ] Implement caching strategy
- [ ] Optimize parallel processing
- [ ] Create performance dashboard

---

## 🎯 Success Criteria

### Phase 1 Success
- ✅ Rotated elements position correctly at all angles
- ✅ FILL/HUG/FIXED sizing matches Figma 100%
- ✅ AutoLayout conversion has pixel-perfect fidelity
- ✅ All tests pass

### Phase 2 Success
- ✅ Builder pattern implemented and tested
- ✅ React, Vue, HTML generators working
- ✅ Plugin system allows custom generators
- ✅ CLI supports `--framework` flag

### Phase 3 Success
- ✅ Color variables extracted from Figma
- ✅ CSS variables generated correctly
- ✅ Generators use variables when available
- ✅ 90%+ color variable coverage

### Phase 4 Success
- ✅ Multi-segment text renders correctly
- ✅ Text styling preserved
- ✅ OpenType features supported
- ✅ Performance impact < 10%

### Phase 5 Success
- ✅ Performance tracking implemented
- ✅ 80%+ cache hit rate
- ✅ 50%+ faster than current system
- ✅ Parallel processing optimized

---

## 📊 Timeline Summary

| Phase | Duration | Deliverables | Dependencies |
|-------|----------|-------------|--------------|
| **Phase 1** | 2-3 weeks | Layout engine | None |
| **Phase 2** | 3-4 weeks | Multi-framework | Phase 1 |
| **Phase 3** | 1-2 weeks | Color variables | Phase 1 |
| **Phase 4** | 1-2 weeks | Text segments | Phase 1 |
| **Phase 5** | 1-2 weeks | Performance | All phases |

**Total Duration**: 9-13 weeks (2-3 months)

**Can Run in Parallel**:
- Phase 3 can start after Phase 1 completes
- Phase 4 can start after Phase 1 completes
- Phase 5 runs continuously throughout

**Estimated Timeline**:
- Week 1-3: Phase 1 (Layout)
- Week 4-7: Phase 2 (Multi-framework)
- Week 4-5: Phase 3 (Color variables) - parallel
- Week 6-7: Phase 4 (Text segments) - parallel
- Week 8-9: Phase 5 (Performance)

---

## 🔄 Integration with Existing Strengths

### Preserve Our Unique Features

1. **Visual Validation** (src/visual/diff-engine.ts)
   - Keep Puppeteer + pixelmatch system
   - Enhance with multi-viewport testing (mobile, tablet, desktop)
   - Integrate with new layout engine for better positioning

2. **Auto-Correction** (src/correction/)
   - Keep build error fixing (src/correction/error-fixer.ts)
   - Keep visual correction (src/correction/visual-corrector.ts)
   - Enhance with new layout algorithms for better adjustments

3. **LLM Generation** (src/generator/code-generator.ts)
   - Keep OpenAI integration
   - Enhance prompts with new layout concepts
   - Add framework-specific prompt templates

4. **Sandbox Execution** (src/sandbox/executor.ts)
   - Keep Vite + TypeScript validation
   - Extend to support Vue and Angular projects
   - Add framework-specific build configurations

5. **Component Mapping** (src/mapping/mapper.ts)
   - Keep 40+ semantic component types
   - Enhance with better icon detection (from FigmaToCode)
   - Add design system component library detection

### Enhanced Pipeline

```
Current Pipeline:
  Figma API → IR → CodeGen → Build → Visual → Correction

Enhanced Pipeline:
  Figma API → IR (with layout optimization) → Multi-framework CodeGen → Build → Visual → Correction
      ↓           ↓                                    ↓
  Variables   FILL/HUG/FIXED                    React/Vue/HTML
  Colors      Rotation                          Builder Pattern
  Text        AutoLayout
```

---

## 🚀 Next Steps

### Immediate (This Week)
1. ✅ Review and approve this integration plan
2. ✅ Set up development branch: `feature/figmatocode-integration`
3. ✅ Create Phase 1 task breakdown in project management tool
4. ✅ Begin rotation algorithm implementation

### Short-Term (Next 2 Weeks)
1. Complete Phase 1: Layout Engine
2. Write comprehensive tests for layout algorithms
3. Validate against FigmaToCode output quality
4. Document learnings and challenges

### Medium-Term (1-2 Months)
1. Complete Phases 2-4
2. Ship multi-framework support
3. Validate with real-world Figma files
4. Gather user feedback

### Long-Term (3-4 Months)
1. Complete Phase 5
2. Optimize performance to match FigmaToCode
3. Add plugin architecture exploration
4. Consider real-time preview integration

---

## 📚 Resources & References

### Documentation Created
1. `ANALYSIS.md` - Current system analysis (6K lines)
2. `FIGMATOCODE_ANALYSIS.md` - FigmaToCode deep-dive (8K lines)
3. `INTEGRATION_PLAN.md` - This document

### Key Files to Study
1. FigmaToCode: `commonPosition.ts` (rotation)
2. FigmaToCode: `nodeWidthHeight.ts` (sizing)
3. FigmaToCode: `htmlAutoLayout.ts` (flexbox)
4. Our system: `src/figma/extractor.ts` (IR extraction)
5. Our system: `src/generator/code-generator.ts` (generation)

### Testing Strategy
1. Unit tests for each algorithm
2. Integration tests for complete pipeline
3. Visual regression tests with screenshots
4. Performance benchmarks against FigmaToCode

---

## ⚖️ Legal Compliance

### GPL-3.0 Respect
- ✅ Studied their code to understand algorithms
- ✅ Documented concepts in our own words
- ✅ Will implement algorithms independently
- ✅ No code copying or direct translation
- ✅ Clean-room development process

### License for Our Code
**Recommended**: MIT or Apache-2.0
- Allows commercial use
- Community-friendly
- Can integrate Apache-2.0 code (like Bricks)
- Clear license path

---

**Plan Status**: Ready for implementation
**Next Action**: Begin Phase 1 - Rotation algorithm
**Expected Completion**: 9-13 weeks (2-3 months)
