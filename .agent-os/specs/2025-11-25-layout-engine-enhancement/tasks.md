# Tasks Breakdown

This is the tasks breakdown for the spec detailed in @.agent-os/specs/2025-11-25-layout-engine-enhancement/spec.md

> Created: 2025-11-25
> Version: 1.0.0
> Total Estimated Duration: 3 weeks

## Overview

Breaking down Phase 1 (Layout Engine Enhancement) into actionable tasks following the 4-phase implementation strategy:
- Phase 1a: Rotation Algorithm (5 days)
- Phase 1b: Sizing Logic (5 days)
- Phase 1c: AutoLayout Conversion (5 days)
- Phase 1d: Integration & Testing (5 days)

## Phase 1a: Rotation Algorithm Implementation

**Duration**: 5 days
**Dependencies**: None
**Risk Level**: Medium (mathematical complexity)

### Task 1.1: Create Rotation Module Structure

**Estimated Time**: 4 hours

**Deliverables**:
- Create `src/figma/position-calculator.ts` module
- Define TypeScript interfaces for rotation inputs/outputs
- Set up module exports

**Acceptance Criteria**:
- File created with proper TypeScript setup
- Interfaces match algorithm spec requirements
- Module compiles without errors

**Implementation Notes**:
```typescript
// src/figma/position-calculator.ts

export interface RotationInput {
  boundingBox: { x: number; y: number; width: number; height: number };
  figmaRotationDegrees: number;
}

export interface RotationOutput {
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
}

export function calculateRotatedPosition(
  input: RotationInput
): RotationOutput {
  // Implementation to follow
}
```

### Task 1.2: Implement Core Rotation Algorithm

**Estimated Time**: 8 hours

**Deliverables**:
- Complete `calculateRotatedPosition()` function
- Implement absolute value cos/sin logic from FigmaToCode study
- Add precision rounding (2 decimal places)
- Handle special cases (0°, 90°, 180°, 270°)

**Acceptance Criteria**:
- Algorithm matches algorithm-spec.md Version 1.1.0
- All mathematical transformations correct
- Special case detection works (denominator < 0.0001)
- Precision rounding applied to all outputs

**Implementation Notes**:
- Use `Math.abs()` for cos/sin as documented in algorithm spec
- Implement `parseFloat(value.toFixed(2))` for precision
- Create `specialCaseRotation()` helper for 90° multiples

### Task 1.3: Write Rotation Unit Tests

**Estimated Time**: 6 hours

**Deliverables**:
- Implement all 12 angle test cases from tests.md
- Add precision validation tests
- Add edge case tests (very large/small elements)
- Add invalid input tests

**Acceptance Criteria**:
- All 12 standard angle tests pass
- Precision tests validate 2 decimal places
- Edge cases handled gracefully
- Test coverage >95% for rotation module

**Implementation Notes**:
- Use `toBeCloseTo(expected, 2)` for decimal precision
- Test fixtures include known-good outputs from FigmaToCode
- Visual validation preparation with sample outputs

### Task 1.4: Integrate Rotation with Code Generator

**Estimated Time**: 4 hours

**Deliverables**:
- Import rotation calculator in `src/generator/code-generator.ts`
- Call rotation function when `node.rotation` exists
- Apply CSS transform in generated output
- Handle both CSS and Tailwind outputs

**Acceptance Criteria**:
- Rotation applied to elements with `rotation` property
- CSS output includes `transform: rotate(Xdeg)`
- Tailwind output uses arbitrary value syntax
- Non-rotated elements unaffected

**Implementation Notes**:
```typescript
// In code-generator.ts
import { calculateRotatedPosition } from '../figma/position-calculator';

if (node.rotation && node.rotation !== 0) {
  const rotated = calculateRotatedPosition({
    boundingBox: { x: node.x, y: node.y, width: node.width, height: node.height },
    figmaRotationDegrees: node.rotation
  });

  styles.push(`transform: rotate(${rotated.rotation}deg)`);
  styles.push(`width: ${rotated.width}px`);
  styles.push(`height: ${rotated.height}px`);
  styles.push(`left: ${rotated.left}px`);
  styles.push(`top: ${rotated.top}px`);
}
```

### Task 1.5: Visual Validation for Rotation

**Estimated Time**: 4 hours

**Deliverables**:
- Create 3 Figma test files with rotated elements (45°, 90°, 135°)
- Export Figma screenshots
- Generate HTML/CSS from Figma data
- Compare screenshots with visual diff tool

**Acceptance Criteria**:
- Visual difference <2% for all test cases
- Position accuracy within 1px
- Dimension accuracy within 0.5px
- Documentation of validation process

**Implementation Notes**:
- Use Playwright for headless browser rendering
- Implement pixel diff comparison utility
- Store test fixtures in `test-fixtures/rotation/`

---

## Phase 1b: Sizing Logic Implementation

**Duration**: 5 days
**Dependencies**: IR schema enhancement
**Risk Level**: Medium (context-aware complexity)

### Task 2.1: Enhance IR Schema

**Estimated Time**: 3 hours

**Deliverables**:
- Add `layoutSizing` property to IRNode interface
- Add `parent` reference to IRNode
- Update IR tree construction to establish parent links

**Acceptance Criteria**:
- TypeScript interfaces match technical-spec.md
- IR tree includes parent references
- Backward compatibility maintained

**Implementation Notes**:
```typescript
// In src/types/ir.ts

export interface IRNode {
  // ... existing fields ...

  layoutSizing?: {
    horizontal: 'FILL' | 'HUG' | number;
    vertical: 'FILL' | 'HUG' | number;
  };

  parent?: IRNode | null;
}
```

### Task 2.2: Extract Sizing Data from Figma API

**Estimated Time**: 4 hours

**Deliverables**:
- Update `src/figma/extractor.ts` to read sizing properties
- Map `layoutSizingHorizontal` and `layoutSizingVertical`
- Extract `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- Build parent-child relationships

**Acceptance Criteria**:
- All sizing modes extracted correctly (FILL, HUG, FIXED)
- Parent references established during extraction
- Constraints (min/max) captured
- Extraction tests pass

**Implementation Notes**:
```typescript
// In extractor.ts
layoutSizing: {
  horizontal: node.layoutSizingHorizontal === 'FILL' ? 'FILL' :
              node.layoutSizingHorizontal === 'HUG' ? 'HUG' :
              node.width,
  vertical: node.layoutSizingVertical === 'FILL' ? 'FILL' :
            node.layoutSizingVertical === 'HUG' ? 'HUG' :
            node.height
},
minWidth: node.minWidth,
maxWidth: node.maxWidth,
// Set parent reference during tree traversal
parent: parentNode || null
```

### Task 2.3: Implement Horizontal Sizing Function

**Estimated Time**: 6 hours

**Deliverables**:
- Create `generateHorizontalSizing()` in `src/generator/tailwind.ts`
- Implement FILL logic with parent context awareness
- Implement HUG logic (no explicit width)
- Implement FIXED logic with pixel values
- Add `align-self: stretch` vs `width: 100%` distinction

**Acceptance Criteria**:
- All sizing modes generate correct CSS
- Parent context correctly influences output
- `maxWidth` constraint affects FILL behavior
- Returns both CSS and Tailwind outputs

**Implementation Notes**:
```typescript
export function generateHorizontalSizing(
  node: IRNode,
  parent: IRNode | null
): { css: string | null; tailwind: string } {
  const sizingMode = node.layoutSizing?.horizontal;
  const parentLayoutMode = parent?.autoLayout?.mode || 'NONE';

  if (sizingMode === 'FILL') {
    if (parentLayoutMode === 'HORIZONTAL') {
      return { css: 'flex: 1 1 0', tailwind: 'flex-1' };
    } else {
      if (node.maxWidth) {
        return { css: 'width: 100%', tailwind: 'w-full' };
      } else {
        return { css: 'align-self: stretch', tailwind: 'self-stretch' };
      }
    }
  } else if (sizingMode === 'HUG') {
    return { css: null, tailwind: 'w-auto' };
  } else {
    return {
      css: `width: ${sizingMode}px`,
      tailwind: `w-[${sizingMode}px]`
    };
  }
}
```

### Task 2.4: Implement Vertical Sizing Function

**Estimated Time**: 4 hours

**Deliverables**:
- Create `generateVerticalSizing()` mirroring horizontal logic
- Implement FILL/HUG/FIXED for vertical axis
- Handle `maxHeight` constraint
- Ensure dual-axis FILL works correctly

**Acceptance Criteria**:
- Vertical sizing mirrors horizontal logic
- FILL in VERTICAL parent → `flex: 1 1 0`
- `maxHeight` affects FILL behavior
- Dual-axis FILL uses flex-1 on primary axis only

**Implementation Notes**:
- Similar structure to horizontal sizing
- Test dual-axis cases (FILL + FILL)
- Ensure primary axis gets `flex-1`, counter axis gets `stretch`

### Task 2.5: Write Sizing Unit Tests

**Estimated Time**: 6 hours

**Deliverables**:
- Implement all 21 sizing test cases from tests.md
- Test FILL in all parent contexts
- Test HUG in all contexts
- Test FIXED in all contexts
- Test dual-axis FILL behavior

**Acceptance Criteria**:
- All 21 sizing tests pass
- Edge cases covered (null parent, missing properties)
- Test coverage >90% for sizing functions

**Implementation Notes**:
- Mock parent nodes with different layoutModes
- Test all combinations systematically
- Validate both CSS and Tailwind outputs

### Task 2.6: Integrate Sizing with Code Generator

**Estimated Time**: 3 hours

**Deliverables**:
- Call sizing functions in code generator
- Pass parent context to sizing functions
- Apply sizing CSS/Tailwind classes
- Handle min/max constraints

**Acceptance Criteria**:
- Sizing applied to all elements with layoutSizing
- Parent context passed correctly
- Generated code includes sizing classes
- Constraints applied where present

---

## Phase 1c: AutoLayout Conversion Implementation

**Duration**: 5 days
**Dependencies**: IR schema enhancement
**Risk Level**: Low (straightforward mapping)

### Task 3.1: Enhance IR Schema for AutoLayout

**Estimated Time**: 2 hours

**Deliverables**:
- Add `autoLayout` property to IRNode interface
- Define all AutoLayout sub-properties

**Acceptance Criteria**:
- Interface matches technical-spec.md
- All Figma AutoLayout properties captured

**Implementation Notes**:
```typescript
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
```

### Task 3.2: Extract AutoLayout Data from Figma API

**Estimated Time**: 4 hours

**Deliverables**:
- Update extractor to read all AutoLayout properties
- Map Figma properties to IR structure
- Handle frames without AutoLayout (mode: NONE)

**Acceptance Criteria**:
- All AutoLayout properties extracted
- NONE mode handled correctly
- Extraction tests pass

**Implementation Notes**:
```typescript
autoLayout: node.layoutMode !== 'NONE' ? {
  mode: node.layoutMode,
  primaryAxisAlignItems: node.primaryAxisAlignItems || 'MIN',
  counterAxisAlignItems: node.counterAxisAlignItems || 'MIN',
  paddingLeft: node.paddingLeft || 0,
  paddingRight: node.paddingRight || 0,
  paddingTop: node.paddingTop || 0,
  paddingBottom: node.paddingBottom || 0,
  itemSpacing: node.itemSpacing || 0,
  layoutWrap: node.layoutWrap || 'NO_WRAP'
} : null
```

### Task 3.3: Implement layoutMode Mapping

**Estimated Time**: 3 hours

**Deliverables**:
- Map HORIZONTAL → `flex` / `inline-flex`
- Map VERTICAL → `flex flex-col` / `inline-flex flex-col`
- Implement parent context logic for flex vs inline-flex
- Handle NONE mode (no flex properties)

**Acceptance Criteria**:
- Correct flex/inline-flex selection based on parent
- Direction classes correct
- NONE mode produces no flex output

**Implementation Notes**:
```typescript
const useFlex = node.parent &&
  'layoutMode' in node.parent &&
  node.parent.layoutMode === layout.mode;

if (layout.mode === 'HORIZONTAL') {
  css.push('display: ' + (useFlex ? 'flex' : 'inline-flex'));
  tailwind.push(useFlex ? 'flex' : 'inline-flex');
  // Omit flex-row as it's default
} else if (layout.mode === 'VERTICAL') {
  css.push('display: ' + (useFlex ? 'flex' : 'inline-flex'));
  css.push('flex-direction: column');
  tailwind.push(useFlex ? 'flex' : 'inline-flex', 'flex-col');
}
```

### Task 3.4: Implement Alignment Mapping

**Estimated Time**: 4 hours

**Deliverables**:
- Map primaryAxisAlignItems to justify-content
- Map counterAxisAlignItems to align-items
- Implement all 4 alignment values for each
- Add align-content for wrapped layouts

**Acceptance Criteria**:
- All 16 alignment combinations correct
- Wrapped layouts include align-content
- CSS and Tailwind outputs match

**Implementation Notes**:
```typescript
// Primary axis
const justifyMap = {
  MIN: { css: 'justify-content: flex-start', tailwind: 'justify-start' },
  CENTER: { css: 'justify-content: center', tailwind: 'justify-center' },
  MAX: { css: 'justify-content: flex-end', tailwind: 'justify-end' },
  SPACE_BETWEEN: { css: 'justify-content: space-between', tailwind: 'justify-between' }
};

// Counter axis
const alignMap = {
  MIN: { css: 'align-items: flex-start', tailwind: 'items-start' },
  CENTER: { css: 'align-items: center', tailwind: 'items-center' },
  MAX: { css: 'align-items: flex-end', tailwind: 'items-end' },
  BASELINE: { css: 'align-items: baseline', tailwind: 'items-baseline' }
};

// Wrap + align-content
if (layout.layoutWrap === 'WRAP') {
  css.push('flex-wrap: wrap');
  tailwind.push('flex-wrap');

  const contentMap = { /* same as alignMap but align-content/content-* */ };
  // Add align-content based on counterAxisAlignItems
}
```

### Task 3.5: Implement Gap and Padding

**Estimated Time**: 4 hours

**Deliverables**:
- Implement gap logic (conditional on SPACE_BETWEEN)
- Implement padding optimization (uniform, horizontal, vertical, individual)
- Map pixel values to Tailwind scale

**Acceptance Criteria**:
- Gap not used with SPACE_BETWEEN
- Padding optimized with shorthand when possible
- Tailwind scale mapping correct

**Implementation Notes**:
```typescript
// Gap - only if itemSpacing > 0 AND not SPACE_BETWEEN
if (layout.itemSpacing > 0 && layout.primaryAxisAlignItems !== 'SPACE_BETWEEN') {
  css.push(`gap: ${layout.itemSpacing}px`);
  tailwind.push(pxToTailwindGap(layout.itemSpacing));
}

// Padding optimization
const { paddingLeft, paddingRight, paddingTop, paddingBottom } = layout;

if (paddingLeft === paddingRight && paddingTop === paddingBottom && paddingLeft === paddingTop) {
  // Uniform padding
  css.push(`padding: ${paddingLeft}px`);
  tailwind.push(`p-${pxToTailwindScale(paddingLeft)}`);
} else if (paddingLeft === paddingRight && paddingTop === paddingBottom) {
  // Horizontal and vertical
  css.push(`padding: ${paddingTop}px ${paddingLeft}px`);
  tailwind.push(`py-${pxToTailwindScale(paddingTop)}`, `px-${pxToTailwindScale(paddingLeft)}`);
} else {
  // Individual
  // ... individual padding classes
}
```

### Task 3.6: Write AutoLayout Unit Tests

**Estimated Time**: 6 hours

**Deliverables**:
- Implement all 24+ AutoLayout tests from tests.md
- Test all alignment combinations
- Test gap conditional logic
- Test padding optimization
- Test wrapping + align-content

**Acceptance Criteria**:
- All AutoLayout tests pass
- Edge cases covered
- Test coverage >90%

### Task 3.7: Integrate AutoLayout with Code Generator

**Estimated Time**: 3 hours

**Deliverables**:
- Call `generateAutoLayoutClasses()` in code generator
- Apply AutoLayout CSS/Tailwind classes
- Handle elements without AutoLayout

**Acceptance Criteria**:
- AutoLayout applied to frames with layoutMode
- Classes included in generated output
- Non-AutoLayout elements unaffected

---

## Phase 1d: Integration & Testing

**Duration**: 5 days
**Dependencies**: All previous phases
**Risk Level**: Low (validation and refinement)

### Task 4.1: End-to-End Integration

**Estimated Time**: 6 hours

**Deliverables**:
- Complete integration of all three algorithms
- Test with real Figma files
- Validate complete pipeline (Figma API → IR → Code)

**Acceptance Criteria**:
- All algorithms work together
- No integration conflicts
- Real Figma files generate correct code

### Task 4.2: Integration Tests

**Estimated Time**: 6 hours

**Deliverables**:
- Implement integration tests from tests.md
- Test nested AutoLayout scenarios
- Test complex responsive layouts
- Test rotation + AutoLayout combinations

**Acceptance Criteria**:
- All integration tests pass
- Complex scenarios handled correctly
- Test coverage >85% for integration paths

### Task 4.3: Visual Regression Testing

**Estimated Time**: 8 hours

**Deliverables**:
- Set up Playwright visual comparison
- Create 10+ visual test fixtures
- Implement screenshot comparison
- Document visual validation process

**Acceptance Criteria**:
- Visual difference <2% for all tests
- Screenshot comparison automated
- Test fixtures documented

### Task 4.4: Performance Benchmarking

**Estimated Time**: 4 hours

**Deliverables**:
- Benchmark rotation algorithm (<5ms per element)
- Benchmark sizing logic (<2ms per element)
- Benchmark AutoLayout conversion (<3ms per element)
- Profile memory usage

**Acceptance Criteria**:
- All performance targets met
- No memory leaks detected
- Benchmarks documented

### Task 4.5: Regression Testing

**Estimated Time**: 4 hours

**Deliverables**:
- Run existing test suite
- Validate backward compatibility
- Test existing features still work
- Fix any breaking changes

**Acceptance Criteria**:
- Zero breaking changes
- All existing tests pass
- Backward compatibility maintained

### Task 4.6: Documentation

**Estimated Time**: 6 hours

**Deliverables**:
- Algorithm documentation with examples
- API documentation for new functions
- Migration guide for existing code
- Usage examples and best practices

**Acceptance Criteria**:
- Complete API documentation
- Examples for all algorithms
- Migration guide clear and tested

### Task 4.7: Code Review and Refinement

**Estimated Time**: 4 hours

**Deliverables**:
- Internal code review
- Address review feedback
- Refactor for clarity and maintainability
- Final testing pass

**Acceptance Criteria**:
- Code review complete
- All feedback addressed
- Code meets quality standards

---

## Task Dependencies Graph

```
Phase 1a (Rotation)
├── 1.1 Create Module Structure
├── 1.2 Implement Algorithm ────────┐
├── 1.3 Write Unit Tests ───────────┤
├── 1.4 Integrate with Generator ───┤
└── 1.5 Visual Validation ──────────┤
                                     │
Phase 1b (Sizing)                   │
├── 2.1 Enhance IR Schema ──────────┤
├── 2.2 Extract from Figma API ─────┤
├── 2.3 Implement Horizontal ───────┤
├── 2.4 Implement Vertical ─────────┤
├── 2.5 Write Unit Tests ───────────┤
└── 2.6 Integrate with Generator ───┤
                                     │
Phase 1c (AutoLayout)               │
├── 3.1 Enhance IR Schema ──────────┤
├── 3.2 Extract from Figma API ─────┤
├── 3.3 Implement layoutMode ───────┤
├── 3.4 Implement Alignment ────────┤
├── 3.5 Implement Gap/Padding ──────┤
├── 3.6 Write Unit Tests ───────────┤
└── 3.7 Integrate with Generator ───┤
                                     │
Phase 1d (Integration & Testing)    │
├── 4.1 End-to-End Integration ←────┘
├── 4.2 Integration Tests
├── 4.3 Visual Regression Testing
├── 4.4 Performance Benchmarking
├── 4.5 Regression Testing
├── 4.6 Documentation
└── 4.7 Code Review and Refinement
```

## Risk Mitigation Tasks

### Risk 1: Mathematical Errors in Rotation
**Mitigation Tasks**:
- Task 1.3: Comprehensive test suite with 12 angles
- Task 1.5: Visual validation against Figma screenshots
- Task 4.3: Visual regression testing with pixel comparison

### Risk 2: Context-Aware Logic Complexity
**Mitigation Tasks**:
- Task 2.5: 21 test cases covering all combinations
- Task 4.2: Integration tests for nested scenarios
- Task 2.1: Proper parent reference validation

### Risk 3: Breaking Existing Features
**Mitigation Tasks**:
- Task 4.5: Comprehensive regression testing
- Task 2.1: Backward compatibility in IR schema
- Task 4.7: Code review with focus on compatibility

## Quality Gates

**After Each Phase**:
- [ ] All unit tests pass (>90% coverage)
- [ ] Integration tests pass
- [ ] Code review complete
- [ ] Documentation updated

**Final Quality Gate (Phase 1d)**:
- [ ] All 380+ tests pass
- [ ] Visual difference <2%
- [ ] Performance targets met (<5ms/element)
- [ ] Zero breaking changes
- [ ] Documentation complete
- [ ] Code review approved

## Total Time Estimate

- **Phase 1a**: 26 hours (3.25 days)
- **Phase 1b**: 26 hours (3.25 days)
- **Phase 1c**: 26 hours (3.25 days)
- **Phase 1d**: 38 hours (4.75 days)

**Total**: 116 hours (~15 working days / 3 weeks)

**Buffer**: Add 20% contingency for unforeseen issues = ~18 working days

## Success Metrics

1. **Rotation Accuracy**: All 12 test angles within 1px position, 0.5px dimension
2. **Sizing Correctness**: 100% pass rate for 21 test combinations
3. **AutoLayout Fidelity**: Generated layouts match Figma with <2px variance
4. **Performance**: <5ms overhead per element
5. **Test Coverage**: >90% for new modules
6. **Visual Validation**: All visual tests pass with <2% difference
7. **Zero Regressions**: All existing tests continue to pass
