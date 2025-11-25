# Algorithm Specification

This is the clean-room algorithm specification for the layout engine enhancement detailed in @.agent-os/specs/2025-11-25-layout-engine-enhancement/spec.md

> Created: 2025-11-25
> Version: 1.1.0 (Updated with actual FigmaToCode implementation details)
> Purpose: GPL-3.0 Compliant Clean-Room Documentation

## Important Notice

This document describes algorithms based on studying **actual FigmaToCode source code** from:
- `packages/backend/src/common/commonPosition.ts`
- `packages/backend/src/common/nodeWidthHeight.ts`
- `packages/backend/src/tailwind/builderImpl/tailwindAutoLayout.ts`
- `packages/backend/src/tailwind/builderImpl/tailwindSize.ts`
- `packages/backend/src/html/builderImpl/htmlSize.ts`

All implementations must be written independently from these specifications as clean-room documentation. This document serves as the **specification layer** between study and implementation to maintain GPL-3.0 compliance.

## Key Updates in Version 1.1

**Rotation Algorithm**:
- ✅ Confirmed use of **absolute values** for cos/sin in denominator and dimension calculations
- ✅ Added precision: round to 2 decimal places using `parseFloat(value.toFixed(2))`

**Sizing Logic**:
- ✅ Added `align-self: stretch` / `self-stretch` as alternative to `width: 100%` when no max constraint
- ✅ Confirmed min/max constraints handled separately from sizing
- ✅ Added context-aware logic: check if `node.maxWidth` / `node.maxHeight` exists

**AutoLayout Mapping**:
- ✅ Added `flex` vs `inline-flex` decision based on parent layoutMode matching
- ✅ Confirmed `flex-row` can be omitted (default direction in Tailwind)
- ✅ Added `align-content` for wrapped layouts (WRAP mode)
- ✅ Confirmed gap NOT used when `primaryAxisAlignItems === SPACE_BETWEEN`

## Algorithm 1: Rotation Bounding Box Calculation

### Problem Statement

When an element is rotated in Figma, the visual bounding box shown represents the rotated element's bounds. However, CSS `transform: rotate()` rotates an element around its center point. We need to calculate:
1. The original (unrotated) element dimensions
2. The correct CSS position (left, top) such that when rotated, the element appears in the correct location

### Mathematical Foundation

**Given**:
- `boundingBox`: The rotated bounding box from Figma `{ x, y, width, height }`
- `figmaRotationDegrees`: Rotation angle in degrees (0-360)

**Find**:
- Original element `width` and `height`
- CSS `left` and `top` position
- CSS `rotation` value

### Step-by-Step Algorithm

#### Step 1: Convert Rotation

```
cssRotation = -figmaRotationDegrees
theta = (cssRotation * PI) / 180
```

**Rationale**: Figma and CSS use opposite rotation directions. Negate to convert.

#### Step 2: Calculate Original Dimensions

A rectangle with dimensions `(w, h)` rotated by `theta` produces a bounding box with dimensions `(w_b, h_b)`.

To find original `w` and `h` from rotated bounding box, solve this system of equations:

**CRITICAL**: Use **absolute values** for cos and sin in the calculations:

```
cos_theta = cos(theta)
sin_theta = sin(theta)
abs_cos_theta = |cos_theta|
abs_sin_theta = |sin_theta|

denominator = (abs_cos_theta * abs_cos_theta) - (abs_sin_theta * abs_sin_theta)

h = (w_b * abs_sin_theta - h_b * abs_cos_theta) / -denominator
w = (w_b - h * abs_sin_theta) / abs_cos_theta
```

**Rationale**: Using absolute values ensures correct dimension calculation regardless of rotation direction (positive or negative angles).

#### Step 3: Calculate Position Offset

When a rectangle rotates, its top-left corner moves. Calculate where all 4 corners end up:

```
corners = [
  { x: 0, y: 0 },          // top-left
  { x: w, y: 0 },          // top-right
  { x: w, y: h },          // bottom-right
  { x: 0, y: h }           // bottom-left
]

For each corner:
  rotated_x = corner.x * cos_theta + corner.y * sin_theta
  rotated_y = -corner.x * sin_theta + corner.y * cos_theta

min_x = minimum of all rotated_x values
min_y = minimum of all rotated_y values
```

#### Step 4: Final Position Calculation

```
left = boundingBox.x - min_x
top = boundingBox.y - min_y
```

### Implementation Pseudocode

```typescript
function calculateRotatedPosition(
  boundingBox: { x: number, y: number, width: number, height: number },
  figmaRotationDegrees: number
): { width: number, height: number, left: number, top: number, rotation: number } {

  // Step 1: Convert rotation
  const cssRotation = -figmaRotationDegrees;
  const theta = (cssRotation * Math.PI) / 180;
  const cos_theta = Math.cos(theta);
  const sin_theta = Math.sin(theta);

  // Step 2: Calculate original dimensions
  // CRITICAL: Use absolute values for cos/sin
  const abs_cos_theta = Math.abs(cos_theta);
  const abs_sin_theta = Math.abs(sin_theta);

  const denominator = (abs_cos_theta * abs_cos_theta) - (abs_sin_theta * abs_sin_theta);

  // Handle special cases (avoid division by zero)
  if (Math.abs(denominator) < 0.0001) {
    // 45°, 135°, 225°, 315° - denominator approaches zero
    return specialCaseRotation(boundingBox, figmaRotationDegrees);
  }

  const h = (boundingBox.width * abs_sin_theta - boundingBox.height * abs_cos_theta) / -denominator;
  const w = (boundingBox.width - h * abs_sin_theta) / abs_cos_theta;

  // Step 3: Calculate corner positions
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];

  const rotatedCorners = corners.map(corner => ({
    x: corner.x * cos_theta + corner.y * sin_theta,
    y: -corner.x * sin_theta + corner.y * cos_theta
  }));

  const min_x = Math.min(...rotatedCorners.map(c => c.x));
  const min_y = Math.min(...rotatedCorners.map(c => c.y));

  // Step 4: Final position
  return {
    width: w,
    height: h,
    left: boundingBox.x - min_x,
    top: boundingBox.y - min_y,
    rotation: cssRotation
  };
}
```

### Edge Cases

1. **0° or 360°**: No rotation, return original bounding box values
2. **90°, 180°, 270°**: Simple transformations, no complex math needed
3. **45°, 135°, 225°, 315°**: Denominator approaches zero, use alternative calculation
4. **Negative rotations**: Normalize to 0-360° range before processing
5. **Large rotations (>360°)**: Modulo 360 to normalize

### Test Cases

| Angle | Input BBox (w×h) | Expected Output (w×h) | Validation Method |
|-------|------------------|----------------------|-------------------|
| 0° | 100×50 @ (10,20) | 100×50 @ (10,20) | Identity transform |
| 90° | 50×100 @ (10,20) | 100×50 @ (35,-25) | 90° rotation matrix |
| 45° | 70.71×70.71 @ (10,20) | 50×50 @ (calculated) | Diagonal = sqrt(2) * side |
| 180° | 100×50 @ (10,20) | 100×50 @ (-90,-30) | 180° inversion |
| 270° | 50×100 @ (10,20) | 100×50 @ (-15,45) | -90° rotation |

## Algorithm 2: Context-Aware Sizing

### Problem Statement

Figma has three sizing modes: FILL, HUG, and FIXED. The CSS output depends on both the sizing mode AND the parent's layout mode. We need to generate appropriate CSS properties based on this context.

### Decision Tree

```
INPUT: node.layoutSizingHorizontal, parent.layoutMode

IF parent is null OR parent.layoutMode === 'NONE':
  // No layout context, use simple sizing
  IF sizingMode === 'FILL':
    IF node.maxWidth exists:
      OUTPUT: width: 100% (or Tailwind: w-full)
    ELSE:
      OUTPUT: align-self: stretch (or Tailwind: self-stretch)
  ELSE IF sizingMode === 'HUG':
    OUTPUT: (no width property)
  ELSE: // FIXED
    OUTPUT: width: {value}px

ELSE IF parent.layoutMode === 'HORIZONTAL':
  // Parent uses row layout
  IF sizingMode === 'FILL':
    OUTPUT: flex: 1 1 0 (or Tailwind: flex-1)
  ELSE IF sizingMode === 'HUG':
    OUTPUT: (no width property, content-sized)
  ELSE: // FIXED
    OUTPUT: width: {value}px (or Tailwind: w-[{value}px])

ELSE IF parent.layoutMode === 'VERTICAL':
  // Parent uses column layout
  IF sizingMode === 'FILL':
    IF node.maxHeight exists:
      OUTPUT: height: 100% (or Tailwind: h-full)
    ELSE:
      OUTPUT: align-self: stretch (or Tailwind: self-stretch)
  ELSE IF sizingMode === 'HUG':
    OUTPUT: (no height property)
  ELSE: // FIXED
    OUTPUT: height: {value}px (or Tailwind: h-[{value}px])
```

### Implementation Pseudocode

```typescript
function generateHorizontalSizing(
  node: IRNode,
  parent: IRNode | null
): CSSProperty | TailwindClass {

  const sizingMode = node.layoutSizing?.horizontal;

  if (!sizingMode) {
    return null; // No sizing specified
  }

  // Determine parent layout context
  const parentLayoutMode = parent?.autoLayout?.mode || 'NONE';

  if (sizingMode === 'FILL') {
    if (parentLayoutMode === 'HORIZONTAL') {
      // Take remaining space in row
      return { css: 'flex: 1 1 0', tailwind: 'flex-1' };
    } else {
      // Full width in column or no-layout parent
      if (node.maxWidth) {
        return { css: 'width: 100%', tailwind: 'w-full' };
      } else {
        return { css: 'align-self: stretch', tailwind: 'self-stretch' };
      }
    }
  } else if (sizingMode === 'HUG') {
    // Content-sized, no explicit width
    return { css: null, tailwind: 'w-auto' }; // w-auto is optional
  } else {
    // FIXED mode - sizingMode is a number (pixels)
    return {
      css: `width: ${sizingMode}px`,
      tailwind: `w-[${sizingMode}px]`
    };
  }
}

// Handle min/max constraints separately
function generateConstraints(node: IRNode): string[] {
  const constraints = [];

  if (node.maxWidth) {
    constraints.push(`max-w-[${node.maxWidth}px]`);
  }
  if (node.minWidth) {
    constraints.push(`min-w-[${node.minWidth}px]`);
  }
  if (node.maxHeight) {
    constraints.push(`max-h-[${node.maxHeight}px]`);
  }
  if (node.minHeight) {
    constraints.push(`min-h-[${node.minHeight}px]`);
  }

  return constraints;
}

// Vertical sizing uses same logic with height/h- instead of width/w-
function generateVerticalSizing(
  node: IRNode,
  parent: IRNode | null
): CSSProperty | TailwindClass {
  // Mirror logic for vertical axis
  // ...
}
```

### Special Cases

1. **Both FILL**: If both horizontal and vertical are FILL in a flex parent, only the primary axis gets flex-grow
2. **Nested AutoLayouts**: Consider immediate parent only, not grandparent
3. **Absolute Positioning**: If `layoutPositioning === 'ABSOLUTE'`, use FIXED-like sizing
4. **Min/Max Constraints**: If Figma provides min/max width/height, add those as CSS min-width/max-width

### Test Cases

| Sizing Mode | Parent Layout | Max Constraint | Expected CSS | Expected Tailwind |
|-------------|---------------|----------------|--------------|-------------------|
| FILL | HORIZONTAL | - | flex: 1 1 0 | flex-1 |
| FILL | VERTICAL | Yes | height: 100% | h-full |
| FILL | VERTICAL | No | align-self: stretch | self-stretch |
| FILL | NONE | Yes | width: 100% | w-full |
| FILL | NONE | No | align-self: stretch | self-stretch |
| HUG | HORIZONTAL | - | (none) | w-auto |
| HUG | VERTICAL | - | (none) | w-auto |
| FIXED(200) | HORIZONTAL | - | width: 200px | w-[200px] |
| FIXED(200) | VERTICAL | - | width: 200px | w-[200px] |

## Algorithm 3: AutoLayout to Flexbox Mapping

### Problem Statement

Convert Figma's AutoLayout properties to CSS Flexbox properties with 100% fidelity.

### Property Mapping Table

#### layoutMode → flex-direction

**Important**: Use `flex` vs `inline-flex` based on parent context:
- If parent has same layoutMode → use `flex`
- Otherwise → use `inline-flex`

| Figma layoutMode | CSS | Tailwind |
|-----------------|-----|----------|
| HORIZONTAL | display: flex; flex-direction: row | flex (flex-row is default) |
| VERTICAL | display: flex; flex-direction: column | flex flex-col |
| NONE | (no flex) | (no flex classes) |

**Note**: `flex-row` can be omitted in Tailwind as it's the default direction.

#### primaryAxisAlignItems → justify-content

| Figma primaryAxisAlignItems | CSS | Tailwind |
|----------------------------|-----|----------|
| MIN | justify-content: flex-start | justify-start |
| CENTER | justify-content: center | justify-center |
| MAX | justify-content: flex-end | justify-end |
| SPACE_BETWEEN | justify-content: space-between | justify-between |

#### counterAxisAlignItems → align-items

| Figma counterAxisAlignItems | CSS | Tailwind |
|----------------------------|-----|----------|
| MIN | align-items: flex-start | items-start |
| CENTER | align-items: center | items-center |
| MAX | align-items: flex-end | items-end |
| BASELINE | align-items: baseline | items-baseline |

#### itemSpacing → gap

**Logic**:
```
IF itemSpacing > 0 AND primaryAxisAlignItems !== SPACE_BETWEEN:
  OUTPUT: gap: {itemSpacing}px
ELSE:
  OUTPUT: (no gap property)
```

**Rationale**: When `justify-content: space-between` is used, gap would interfere with spacing. Figma doesn't use gap in this case.

**Tailwind Conversion**:
```typescript
function pxToTailwindGap(px: number): string {
  // Tailwind scale: 0, 1(4px), 2(8px), 3(12px), 4(16px), etc.
  // 1 unit = 0.25rem = 4px

  const rem = px / 16; // Convert px to rem (assuming 16px base)
  const scale = rem / 0.25; // Convert rem to Tailwind scale

  // Round to nearest Tailwind value
  const rounded = Math.round(scale);

  // Check if close to standard scale value
  if (Math.abs(scale - rounded) < 0.1) {
    return `gap-${rounded}`;
  } else {
    // Use arbitrary value for non-standard spacing
    return `gap-[${px}px]`;
  }
}
```

#### layoutWrap → flex-wrap + align-content

| Figma layoutWrap | CSS | Tailwind |
|-----------------|-----|----------|
| WRAP | flex-wrap: wrap | flex-wrap |
| NO_WRAP | flex-wrap: nowrap | (default, omit) |

**Important**: When `layoutWrap === WRAP`, also add `align-content` property:

| counterAxisAlignItems | align-content | Tailwind |
|----------------------|---------------|----------|
| MIN | content-start | content-start |
| CENTER | content-center | content-center |
| MAX | content-end | content-end |
| BASELINE | content-baseline | content-baseline |

**Rationale**: `align-content` controls spacing between wrapped lines.

#### padding → padding properties

**Optimization Logic**:
```
IF paddingLeft === paddingRight === paddingTop === paddingBottom:
  OUTPUT: padding: {value}px
  TAILWIND: p-{scale}

ELSE IF paddingLeft === paddingRight AND paddingTop === paddingBottom:
  OUTPUT: padding: {vertical}px {horizontal}px
  TAILWIND: py-{scale} px-{scale}

ELSE:
  OUTPUT: padding: {top}px {right}px {bottom}px {left}px
  TAILWIND: pt-{scale} pr-{scale} pb-{scale} pl-{scale}
```

### Implementation Pseudocode

```typescript
function generateAutoLayoutClasses(
  node: SceneNode,
  layout: AutoLayoutProperties
): { css: string[], tailwind: string[] } {

  const css: string[] = [];
  const tailwind: string[] = [];

  // Step 1: Base layout (flex vs inline-flex)
  const useFlex = node.parent &&
    'layoutMode' in node.parent &&
    node.parent.layoutMode === layout.mode;

  if (layout.mode === 'HORIZONTAL') {
    css.push('display: ' + (useFlex ? 'flex' : 'inline-flex'));
    css.push('flex-direction: row');
    tailwind.push(useFlex ? 'flex' : 'inline-flex');
    // flex-row is default, can omit
  } else if (layout.mode === 'VERTICAL') {
    css.push('display: ' + (useFlex ? 'flex' : 'inline-flex'));
    css.push('flex-direction: column');
    tailwind.push(useFlex ? 'flex' : 'inline-flex', 'flex-col');
  } else {
    // NONE - no flex layout
    return { css: [], tailwind: [] };
  }

  // Step 2: Primary axis alignment (justify-content)
  const justifyMap = {
    MIN: { css: 'justify-content: flex-start', tailwind: 'justify-start' },
    CENTER: { css: 'justify-content: center', tailwind: 'justify-center' },
    MAX: { css: 'justify-content: flex-end', tailwind: 'justify-end' },
    SPACE_BETWEEN: { css: 'justify-content: space-between', tailwind: 'justify-between' }
  };
  const justifyValue = justifyMap[layout.primaryAxisAlignItems || 'MIN'];
  css.push(justifyValue.css);
  tailwind.push(justifyValue.tailwind);

  // Step 3: Counter axis alignment (align-items)
  const alignMap = {
    MIN: { css: 'align-items: flex-start', tailwind: 'items-start' },
    CENTER: { css: 'align-items: center', tailwind: 'items-center' },
    MAX: { css: 'align-items: flex-end', tailwind: 'items-end' },
    BASELINE: { css: 'align-items: baseline', tailwind: 'items-baseline' }
  };
  const alignValue = alignMap[layout.counterAxisAlignItems || 'MIN'];
  css.push(alignValue.css);
  tailwind.push(alignValue.tailwind);

  // Step 4: Gap (conditional - not used with SPACE_BETWEEN)
  if (layout.itemSpacing > 0 && layout.primaryAxisAlignItems !== 'SPACE_BETWEEN') {
    css.push(`gap: ${layout.itemSpacing}px`);
    tailwind.push(pxToTailwindGap(layout.itemSpacing));
  }

  // Step 5: Wrapping + align-content
  if (layout.layoutWrap === 'WRAP') {
    css.push('flex-wrap: wrap');
    tailwind.push('flex-wrap');

    // Add align-content for wrapped layouts
    const contentMap = {
      MIN: { css: 'align-content: flex-start', tailwind: 'content-start' },
      CENTER: { css: 'align-content: center', tailwind: 'content-center' },
      MAX: { css: 'align-content: flex-end', tailwind: 'content-end' },
      BASELINE: { css: 'align-content: baseline', tailwind: 'content-baseline' }
    };
    const contentValue = contentMap[layout.counterAxisAlignItems || 'MIN'];
    css.push(contentValue.css);
    tailwind.push(contentValue.tailwind);
  }

  // Step 6: Padding (optimized)
  const padding = optimizePadding({
    left: layout.paddingLeft,
    right: layout.paddingRight,
    top: layout.paddingTop,
    bottom: layout.paddingBottom
  });
  css.push(...padding.css);
  tailwind.push(...padding.tailwind);

  return { css, tailwind };
}
```

### Test Cases

| Config | Expected CSS | Expected Tailwind |
|--------|-------------|-------------------|
| HORIZONTAL, MIN, CENTER, gap=16 | display: flex; flex-direction: row; justify-content: flex-start; align-items: center; gap: 16px | flex justify-start items-center gap-4 |
| VERTICAL, SPACE_BETWEEN, MAX, gap=16 (ignored) | display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end | flex flex-col justify-between items-end |
| HORIZONTAL, CENTER, CENTER, gap=24, WRAP | display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 24px; flex-wrap: wrap; align-content: center | flex justify-center items-center gap-6 flex-wrap content-center |

## Integration Algorithm

### Complete Layout Generation Flow

```
STEP 1: Extract Layout Data from Figma
  - Get node properties via Figma API
  - Build IR tree with parent references
  - Extract AutoLayout, layoutSizing, rotation for each node

STEP 2: Calculate Rotation (if applicable)
  IF node.rotation !== 0:
    calculatedPosition = calculateRotatedPosition(node.boundingBox, node.rotation)
    Apply to generated CSS

STEP 3: Generate AutoLayout Styles (if parent has AutoLayout)
  IF node.parent.autoLayout:
    autoLayoutStyles = generateAutoLayoutClasses(node.parent.autoLayout)
    Apply to parent container

STEP 4: Generate Sizing Styles
  horizontalSizing = generateHorizontalSizing(node, node.parent)
  verticalSizing = generateVerticalSizing(node, node.parent)
  Apply to node

STEP 5: Generate Final Code
  Combine all styles into CSS or Tailwind classes
  Format according to framework (HTML, React, etc.)
  Return generated component code
```

## Validation Strategy

### Unit Test Coverage

1. **Rotation Tests**: 12 test cases covering 0°, 30°, 45°, 60°, 90°, 120°, 135°, 150°, 180°, 270°, 315°, 360°
2. **Sizing Tests**: 21 test cases (3 modes × 7 parent contexts)
3. **AutoLayout Tests**: 24 test cases (all alignment combinations)
4. **Integration Tests**: 10 complex scenarios with nested layouts

### Visual Validation

1. **Screenshot Comparison**: Generate HTML, capture screenshot, compare to Figma export
2. **Pixel Diff**: Use pixelmatch or similar for automated visual regression
3. **Tolerance**: <2px variance acceptable (sub-pixel rendering differences)

### Performance Benchmarks

1. **Rotation Calculation**: <1ms per element
2. **Sizing Logic**: <0.5ms per element
3. **AutoLayout Generation**: <0.5ms per container
4. **Total Overhead**: <5ms for typical 20-element layout

## Implementation Checklist

- [ ] Implement `calculateRotatedPosition` with all edge cases
- [ ] Add rotation unit tests (12 cases)
- [ ] Implement `generateHorizontalSizing` with parent context
- [ ] Implement `generateVerticalSizing` with parent context
- [ ] Add sizing unit tests (21 cases)
- [ ] Implement `generateAutoLayoutClasses` with all mappings
- [ ] Add AutoLayout unit tests (24 cases)
- [ ] Extend IR schema with new properties
- [ ] Update `FigmaExtractor` to capture new properties
- [ ] Integrate algorithms into `TailwindGenerator`
- [ ] Integrate algorithms into `CodeGenerator`
- [ ] Create integration tests (10 scenarios)
- [ ] Set up visual validation pipeline
- [ ] Performance profiling and optimization
- [ ] Documentation and examples

## References

- Figma API Documentation: Layout Properties
- CSS Flexbox Specification (W3C)
- Tailwind CSS Utility Classes
- Linear Algebra: 2D Rotation Matrices
- FigmaToCode: Conceptual architecture study (GPL-3.0, studied for concepts only)

---

**IMPORTANT**: This specification is clean-room documentation. Implementations must be written independently without direct reference to FigmaToCode source code to maintain GPL-3.0 compliance.
