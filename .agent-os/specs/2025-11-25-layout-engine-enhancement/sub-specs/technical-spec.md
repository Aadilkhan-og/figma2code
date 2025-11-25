# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-11-25-layout-engine-enhancement/spec.md

> Created: 2025-11-25
> Version: 1.0.0

## Technical Requirements

### 1. Rotation Handling

**Requirement**: Implement mathematical algorithm to calculate CSS position and dimensions for rotated elements such that the rotated bounding box matches Figma's visual output.

**Mathematical Approach**:
- Convert Figma rotation degrees to CSS rotation (negate angle)
- Given rotated bounding box dimensions, solve for original width/height using rotation matrix mathematics
- Calculate position offset by rotating all 4 corners and finding minimum x, y coordinates
- Apply transform-origin adjustments for center-based rotation

**Input**:
- Figma boundingBox: `{ x, y, width, height }`
- Figma rotation: degrees (0-360)

**Output**:
- CSS properties: `{ width, height, left, top, transform: rotate(deg) }`

**Precision Requirements**: Position accuracy within 1px, dimension accuracy within 0.5px

### 2. FILL/HUG/FIXED Sizing

**Requirement**: Generate appropriate CSS sizing properties based on Figma sizing mode AND parent layout context.

**Context-Aware Logic**:

**FILL Mode** (`layoutSizingHorizontal: "FILL"`):
- Parent has `layoutMode: HORIZONTAL` → `flex: 1 1 0` (take remaining space)
- Parent has `layoutMode: VERTICAL` → `width: 100%` (full width)
- Parent has `layoutMode: NONE` → `width: 100%` (default behavior)

**HUG Mode** (`layoutSizingHorizontal: "HUG"`):
- All contexts → implicit sizing (no explicit width property)
- Tailwind: `w-auto` or omit class

**FIXED Mode** (`layoutSizingHorizontal: {number}`):
- All contexts → `width: {value}px`
- Tailwind: `w-[{value}px]`

**Vertical Sizing**: Same logic applies for `layoutSizingVertical`

**Special Cases**:
- FILL + FILL (both axes) → flex-grow on primary axis only
- Nested AutoLayouts → respect parent's primary axis direction

### 3. AutoLayout → Flexbox Mapping

**Requirement**: Convert all Figma AutoLayout properties to CSS Flexbox with 100% fidelity.

**Property Mappings**:

**layoutMode**:
- `HORIZONTAL` → `display: flex; flex-direction: row` / `flex flex-row`
- `VERTICAL` → `display: flex; flex-direction: column` / `flex flex-col`
- `NONE` → no flex properties

**primaryAxisAlignItems** (justify-content):
- `MIN` → `justify-content: flex-start` / `justify-start`
- `CENTER` → `justify-content: center` / `justify-center`
- `MAX` → `justify-content: flex-end` / `justify-end`
- `SPACE_BETWEEN` → `justify-content: space-between` / `justify-between`

**counterAxisAlignItems** (align-items):
- `MIN` → `align-items: flex-start` / `items-start`
- `CENTER` → `align-items: center` / `items-center`
- `MAX` → `align-items: flex-end` / `items-end`
- `BASELINE` → `align-items: baseline` / `items-baseline`

**itemSpacing**:
- If `> 0` AND `primaryAxisAlignItems !== SPACE_BETWEEN` → `gap: {value}px` / `gap-{scale}`
- If `primaryAxisAlignItems === SPACE_BETWEEN` → no gap (space-between handles spacing)

**layoutWrap**:
- `WRAP` → `flex-wrap: wrap` / `flex-wrap`
- `NO_WRAP` → `flex-wrap: nowrap` (default, can omit)

**padding** (paddingLeft, paddingRight, paddingTop, paddingBottom):
- Optimize output using `padding` shorthand when possible
- Generate Tailwind padding utilities: `p-{value}`, `px-{value}`, `py-{value}`, or individual

### 4. IR Schema Enhancements

**New Fields to Add to IRNode**:

```typescript
interface IRNode {
  // ... existing fields ...

  // AutoLayout properties (from Figma API)
  autoLayout?: {
    mode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;
    itemSpacing: number;
    layoutWrap: 'WRAP' | 'NO_WRAP';
  };

  // Sizing mode (from Figma API)
  layoutSizing?: {
    horizontal: 'FILL' | 'HUG' | number; // number = fixed pixels
    vertical: 'FILL' | 'HUG' | number;
  };

  // Rotation (from Figma API)
  rotation?: number; // degrees

  // Parent reference (for context-aware sizing)
  parent?: IRNode | null;
}
```

**Extraction Logic** (in `src/figma/extractor.ts`):
- Read `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems` from Figma API
- Read `layoutSizingHorizontal`, `layoutSizingVertical` from Figma API
- Read `rotation` from Figma API
- Establish parent-child references during IR tree construction

### 5. Code Generation Integration

**File Modifications**:

**src/figma/position-calculator.ts** (NEW):
- `calculateRotatedPosition(boundingBox, rotation)` → returns `{ width, height, left, top, rotation }`
- Mathematical implementation of rotation bounding box algorithm
- Test coverage for 0-360° angles

**src/generator/tailwind.ts** (ENHANCE):
- `generateSizeClasses(node, parent)` → uses `layoutSizing` + parent context
- `generateAutoLayoutClasses(layout)` → maps AutoLayout properties to Tailwind classes
- Integration with existing `TailwindGenerator` class

**src/generator/code-generator.ts** (ENHANCE):
- Call `calculateRotatedPosition` when `node.rotation` exists
- Apply rotation transform in generated CSS/styles
- Call sizing and layout generators with parent context

**src/figma/extractor.ts** (ENHANCE):
- Extract AutoLayout properties from Figma API response
- Extract sizing modes (`layoutSizingHorizontal`, `layoutSizingVertical`)
- Extract rotation property
- Build parent references in IR tree

## Approach Options

### Option A: Gradual Enhancement (Selected)

**Description**: Enhance existing `TailwindGenerator` and `CodeGenerator` with new algorithms while maintaining backward compatibility.

**Pros**:
- Preserves existing functionality
- Allows incremental testing
- Can ship partial improvements
- Lower risk of breaking changes
- Maintains visual validation pipeline

**Cons**:
- More complex code with conditional logic
- Requires careful integration
- May have performance overhead from compatibility checks

**Rationale**: This approach minimizes risk by building on our proven foundation. We can validate each algorithm independently and maintain our unique strengths (visual validation, LLM generation, auto-correction) throughout the process.

### Option B: Clean Rewrite of Layout System

**Description**: Create new layout calculation system separate from existing code, then swap in.

**Pros**:
- Clean, focused implementation
- Easier to test in isolation
- No legacy constraints

**Cons**:
- Higher risk of breaking existing features
- All-or-nothing deployment
- Loses context during development
- Requires extensive regression testing
- May disrupt visual validation system

**Rationale for Rejection**: Too risky for Phase 1. Our system has 5 unique capabilities (visual validation, LLM, auto-correction, sandbox, component mapping) that could be disrupted by a full rewrite.

## External Dependencies

**No new external dependencies required.**

**Justification**:
- Mathematical calculations use built-in JavaScript `Math` functions
- Tailwind class generation uses existing string manipulation
- IR schema changes are pure TypeScript types
- All algorithms can be implemented with standard library

**Future Consideration**: If performance becomes an issue with complex rotation calculations, consider:
- `gl-matrix` (MIT license) for optimized matrix math
- Only add if profiling shows >10ms overhead per element

## Implementation Strategy

### Phase 1a: Rotation Algorithm (Week 1)
1. Implement `calculateRotatedPosition` function with full mathematics
2. Add unit tests for all angle ranges
3. Integrate with `CodeGenerator` for CSS transform generation
4. Validate with visual comparison tests

### Phase 1b: Sizing Logic (Week 2)
1. Add `layoutSizing` to IR schema
2. Implement context-aware sizing in `TailwindGenerator`
3. Handle FILL/HUG/FIXED for both axes
4. Test all parent-child layout combinations

### Phase 1c: AutoLayout Conversion (Week 2-3)
1. Add `autoLayout` to IR schema
2. Implement `generateAutoLayoutClasses` with all property mappings
3. Handle edge cases (SPACE_BETWEEN + gap, wrapping)
4. Integration tests with nested layouts

### Phase 1d: Integration & Testing (Week 3)
1. End-to-end tests with real Figma files
2. Visual regression testing
3. Performance benchmarking
4. Documentation updates

## Risk Mitigation

### Risk 1: Mathematical Errors in Rotation

**Mitigation**:
- Comprehensive test suite with known-good outputs from FigmaToCode
- Visual validation against Figma screenshots
- Unit tests for edge cases (0°, 90°, 180°, 270°, non-standard angles)

### Risk 2: Context-Aware Logic Complexity

**Mitigation**:
- Clear decision tree documentation
- Extensive unit tests for all combinations
- Parent reference validation in IR construction
- Fallback to FIXED sizing if parent unavailable

### Risk 3: Tailwind Class Conflicts

**Mitigation**:
- Class precedence documentation
- Integration tests with class inspector
- Validation that generated classes don't conflict
- CSS specificity testing

### Risk 4: Breaking Existing Features

**Mitigation**:
- Feature flags for new algorithms
- Parallel code paths during transition
- Regression test suite for all existing layouts
- Visual diff comparison before/after

## Success Criteria

1. **Rotation Accuracy**: All test angles position within 1px of expected
2. **Sizing Correctness**: 100% pass rate for FILL/HUG/FIXED in all contexts
3. **AutoLayout Fidelity**: Generated layouts match Figma with <2px variance
4. **Performance**: <5ms overhead per element for new calculations
5. **Test Coverage**: >90% code coverage for new modules
6. **Visual Validation**: All existing visual tests still pass
7. **No Regressions**: Zero breaking changes to existing features

## Documentation Requirements

1. Algorithm documentation with mathematical explanations
2. Decision tree diagrams for sizing logic
3. Property mapping tables for AutoLayout
4. Example code snippets for each algorithm
5. Migration guide for existing code
6. Performance profiling results
