# Tests Specification

This is the test specification for the spec detailed in @.agent-os/specs/2025-11-25-layout-engine-enhancement/spec.md

> Created: 2025-11-25
> Version: 1.0.0

## Test Strategy

### Test-Driven Development Approach
- **Unit Tests First**: Write tests before implementing algorithms
- **Integration Tests**: Validate complete pipeline (Figma API → IR → Code Generation)
- **Visual Validation**: Screenshot comparison for pixel-perfect accuracy
- **Regression Tests**: Prevent breaking existing functionality
- **Coverage Target**: >90% code coverage for new modules

### Test Categories
1. **Algorithm Unit Tests**: Pure mathematical functions (rotation, sizing calculations)
2. **Code Generation Tests**: CSS/Tailwind class generation correctness
3. **Integration Tests**: End-to-end layout generation from Figma data
4. **Visual Tests**: Browser rendering validation
5. **Edge Case Tests**: Boundary conditions and special cases
6. **Regression Tests**: Existing feature compatibility

## 1. Rotation Algorithm Tests

### Test Suite: `calculateRotatedPosition()`

**Purpose**: Validate rotation bounding box mathematics for all angle ranges

**Test Cases** (12 comprehensive angles):

```typescript
describe('Rotation Algorithm', () => {

  test('0° rotation - no transformation', () => {
    const boundingBox = { x: 100, y: 100, width: 200, height: 100 };
    const result = calculateRotatedPosition(boundingBox, 0);

    expect(result.width).toBeCloseTo(200, 2);
    expect(result.height).toBeCloseTo(100, 2);
    expect(result.left).toBeCloseTo(100, 2);
    expect(result.top).toBeCloseTo(100, 2);
    expect(result.rotation).toBe(0);
  });

  test('45° rotation - diagonal case', () => {
    const boundingBox = { x: 100, y: 100, width: 141.42, height: 141.42 };
    const result = calculateRotatedPosition(boundingBox, 45);

    expect(result.width).toBeCloseTo(100, 1);
    expect(result.height).toBeCloseTo(100, 1);
    expect(result.rotation).toBe(-45);
    // Position offsets validated against known-good outputs
  });

  test('90° rotation - special case', () => {
    const boundingBox = { x: 100, y: 100, width: 100, height: 200 };
    const result = calculateRotatedPosition(boundingBox, 90);

    expect(result.width).toBeCloseTo(200, 2);
    expect(result.height).toBeCloseTo(100, 2);
    expect(result.rotation).toBe(-90);
  });

  test('135° rotation - obtuse angle', () => {
    const boundingBox = { x: 100, y: 100, width: 141.42, height: 141.42 };
    const result = calculateRotatedPosition(boundingBox, 135);

    expect(result.rotation).toBe(-135);
    // Dimensions and position validated
  });

  test('180° rotation - flip case', () => {
    const boundingBox = { x: 100, y: 100, width: 200, height: 100 };
    const result = calculateRotatedPosition(boundingBox, 180);

    expect(result.width).toBeCloseTo(200, 2);
    expect(result.height).toBeCloseTo(100, 2);
    expect(result.rotation).toBe(-180);
  });

  test('270° rotation - negative special case', () => {
    const boundingBox = { x: 100, y: 100, width: 100, height: 200 };
    const result = calculateRotatedPosition(boundingBox, 270);

    expect(result.width).toBeCloseTo(200, 2);
    expect(result.height).toBeCloseTo(100, 2);
    expect(result.rotation).toBe(-270);
  });

  test('15° rotation - small angle', () => {
    const boundingBox = { x: 50, y: 50, width: 103.53, height: 125.88 };
    const result = calculateRotatedPosition(boundingBox, 15);

    expect(result.rotation).toBe(-15);
    // Validate precision within 1px
    expect(Math.abs(result.left - 50)).toBeLessThan(1);
    expect(Math.abs(result.top - 50)).toBeLessThan(1);
  });

  test('30° rotation - common angle', () => {
    const boundingBox = { x: 100, y: 100, width: 150, height: 136.6 };
    const result = calculateRotatedPosition(boundingBox, 30);

    expect(result.rotation).toBe(-30);
    // Dimensions calculated correctly
  });

  test('60° rotation - complementary case', () => {
    const boundingBox = { x: 100, y: 100, width: 136.6, height: 150 };
    const result = calculateRotatedPosition(boundingBox, 60);

    expect(result.rotation).toBe(-60);
  });

  test('120° rotation - obtuse complement', () => {
    const boundingBox = { x: 100, y: 100, width: 136.6, height: 150 };
    const result = calculateRotatedPosition(boundingBox, 120);

    expect(result.rotation).toBe(-120);
  });

  test('225° rotation - diagonal negative', () => {
    const boundingBox = { x: 100, y: 100, width: 141.42, height: 141.42 };
    const result = calculateRotatedPosition(boundingBox, 225);

    expect(result.rotation).toBe(-225);
  });

  test('315° rotation - diagonal complement', () => {
    const boundingBox = { x: 100, y: 100, width: 141.42, height: 141.42 };
    const result = calculateRotatedPosition(boundingBox, 315);

    expect(result.rotation).toBe(-315);
  });

  test('precision - rounds to 2 decimal places', () => {
    const boundingBox = { x: 100.12345, y: 100.12345, width: 200.98765, height: 100.11111 };
    const result = calculateRotatedPosition(boundingBox, 23.7);

    // All outputs should be rounded to 2 decimals
    expect(result.width.toString()).toMatch(/^\d+\.\d{2}$/);
    expect(result.height.toString()).toMatch(/^\d+\.\d{2}$/);
    expect(result.left.toString()).toMatch(/^\d+\.\d{2}$/);
    expect(result.top.toString()).toMatch(/^\d+\.\d{2}$/);
  });
});
```

**Edge Cases**:
- Very small angles (<5°) - minimal transformation
- Very large bounding boxes (>5000px) - precision maintenance
- Zero-width or zero-height elements - graceful handling
- Negative rotation values - normalization to 0-360°

## 2. Sizing Logic Tests

### Test Suite: `generateHorizontalSizing()` and `generateVerticalSizing()`

**Purpose**: Validate context-aware FILL/HUG/FIXED sizing in all parent contexts

**Test Matrix** (21 combinations):

```typescript
describe('Context-Aware Sizing', () => {

  // FILL Mode Tests
  describe('FILL sizing mode', () => {

    test('FILL + HORIZONTAL parent → flex-1', () => {
      const node = { layoutSizing: { horizontal: 'FILL' } };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('flex: 1 1 0');
      expect(result.tailwind).toBe('flex-1');
    });

    test('FILL + VERTICAL parent + maxWidth → w-full', () => {
      const node = { layoutSizing: { horizontal: 'FILL' }, maxWidth: 500 };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 100%');
      expect(result.tailwind).toBe('w-full');
    });

    test('FILL + VERTICAL parent + no maxWidth → self-stretch', () => {
      const node = { layoutSizing: { horizontal: 'FILL' } };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('align-self: stretch');
      expect(result.tailwind).toBe('self-stretch');
    });

    test('FILL + NONE parent (absolute) + maxWidth → w-full', () => {
      const node = { layoutSizing: { horizontal: 'FILL' }, maxWidth: 500 };
      const parent = { autoLayout: { mode: 'NONE' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 100%');
      expect(result.tailwind).toBe('w-full');
    });

    test('FILL + NONE parent + no maxWidth → self-stretch', () => {
      const node = { layoutSizing: { horizontal: 'FILL' } };
      const parent = { autoLayout: { mode: 'NONE' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('align-self: stretch');
      expect(result.tailwind).toBe('self-stretch');
    });

    test('FILL + null parent → w-full (default)', () => {
      const node = { layoutSizing: { horizontal: 'FILL' } };
      const parent = null;

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 100%');
      expect(result.tailwind).toBe('w-full');
    });
  });

  // HUG Mode Tests
  describe('HUG sizing mode', () => {

    test('HUG + HORIZONTAL parent → w-auto', () => {
      const node = { layoutSizing: { horizontal: 'HUG' } };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBeNull();
      expect(result.tailwind).toBe('w-auto');
    });

    test('HUG + VERTICAL parent → w-auto', () => {
      const node = { layoutSizing: { horizontal: 'HUG' } };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBeNull();
      expect(result.tailwind).toBe('w-auto');
    });

    test('HUG + NONE parent → w-auto', () => {
      const node = { layoutSizing: { horizontal: 'HUG' } };
      const parent = { autoLayout: { mode: 'NONE' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBeNull();
      expect(result.tailwind).toBe('w-auto');
    });

    test('HUG + null parent → w-auto', () => {
      const node = { layoutSizing: { horizontal: 'HUG' } };
      const parent = null;

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBeNull();
      expect(result.tailwind).toBe('w-auto');
    });
  });

  // FIXED Mode Tests
  describe('FIXED sizing mode', () => {

    test('FIXED 200px + HORIZONTAL parent → w-[200px]', () => {
      const node = { layoutSizing: { horizontal: 200 } };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 200px');
      expect(result.tailwind).toBe('w-[200px]');
    });

    test('FIXED 350px + VERTICAL parent → w-[350px]', () => {
      const node = { layoutSizing: { horizontal: 350 } };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 350px');
      expect(result.tailwind).toBe('w-[350px]');
    });

    test('FIXED 500px + NONE parent → w-[500px]', () => {
      const node = { layoutSizing: { horizontal: 500 } };
      const parent = { autoLayout: { mode: 'NONE' } };

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 500px');
      expect(result.tailwind).toBe('w-[500px]');
    });

    test('FIXED 150px + null parent → w-[150px]', () => {
      const node = { layoutSizing: { horizontal: 150 } };
      const parent = null;

      const result = generateHorizontalSizing(node, parent);

      expect(result.css).toBe('width: 150px');
      expect(result.tailwind).toBe('w-[150px]');
    });
  });

  // Vertical Sizing Tests (mirror horizontal logic)
  describe('Vertical sizing', () => {

    test('FILL vertical + VERTICAL parent → flex-1', () => {
      const node = { layoutSizing: { vertical: 'FILL' } };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const result = generateVerticalSizing(node, parent);

      expect(result.css).toBe('flex: 1 1 0');
      expect(result.tailwind).toBe('flex-1');
    });

    test('FILL vertical + HORIZONTAL parent + maxHeight → h-full', () => {
      const node = { layoutSizing: { vertical: 'FILL' }, maxHeight: 300 };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const result = generateVerticalSizing(node, parent);

      expect(result.css).toBe('height: 100%');
      expect(result.tailwind).toBe('h-full');
    });

    test('FILL vertical + HORIZONTAL parent + no maxHeight → self-stretch', () => {
      const node = { layoutSizing: { vertical: 'FILL' } };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const result = generateVerticalSizing(node, parent);

      expect(result.css).toBe('align-self: stretch');
      expect(result.tailwind).toBe('self-stretch');
    });

    test('HUG vertical → h-auto', () => {
      const node = { layoutSizing: { vertical: 'HUG' } };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const result = generateVerticalSizing(node, parent);

      expect(result.css).toBeNull();
      expect(result.tailwind).toBe('h-auto');
    });

    test('FIXED 250px vertical → h-[250px]', () => {
      const node = { layoutSizing: { vertical: 250 } };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const result = generateVerticalSizing(node, parent);

      expect(result.css).toBe('height: 250px');
      expect(result.tailwind).toBe('h-[250px]');
    });
  });

  // Dual-Axis Tests
  describe('Dual-axis FILL behavior', () => {

    test('FILL + FILL in HORIZONTAL parent → flex-1 only on horizontal', () => {
      const node = {
        layoutSizing: { horizontal: 'FILL', vertical: 'FILL' }
      };
      const parent = { autoLayout: { mode: 'HORIZONTAL' } };

      const horizontal = generateHorizontalSizing(node, parent);
      const vertical = generateVerticalSizing(node, parent);

      expect(horizontal.tailwind).toBe('flex-1'); // Primary axis
      expect(vertical.tailwind).toBe('self-stretch'); // Counter axis
    });

    test('FILL + FILL in VERTICAL parent → flex-1 only on vertical', () => {
      const node = {
        layoutSizing: { horizontal: 'FILL', vertical: 'FILL' }
      };
      const parent = { autoLayout: { mode: 'VERTICAL' } };

      const horizontal = generateHorizontalSizing(node, parent);
      const vertical = generateVerticalSizing(node, parent);

      expect(horizontal.tailwind).toBe('self-stretch'); // Counter axis
      expect(vertical.tailwind).toBe('flex-1'); // Primary axis
    });
  });
});
```

**Edge Cases**:
- Nested AutoLayouts with different directions
- Min/max constraints combined with sizing modes
- Percentage-based fixed sizes
- Invalid or missing sizing mode data

## 3. AutoLayout Mapping Tests

### Test Suite: `generateAutoLayoutClasses()`

**Purpose**: Validate complete AutoLayout → Flexbox conversion fidelity

**Test Cases** (24 alignment combinations + special cases):

```typescript
describe('AutoLayout to Flexbox Mapping', () => {

  // Basic Layout Mode Tests
  describe('layoutMode mapping', () => {

    test('HORIZONTAL + parent match → flex flex-row', () => {
      const node = { parent: { layoutMode: 'HORIZONTAL' } };
      const layout = { mode: 'HORIZONTAL' };

      const result = generateAutoLayoutClasses(node, layout);

      expect(result.css).toContain('display: flex');
      expect(result.tailwind).toContain('flex');
      // flex-row omitted as default
    });

    test('HORIZONTAL + no parent match → inline-flex', () => {
      const node = { parent: { layoutMode: 'VERTICAL' } };
      const layout = { mode: 'HORIZONTAL' };

      const result = generateAutoLayoutClasses(node, layout);

      expect(result.css).toContain('display: inline-flex');
      expect(result.tailwind).toContain('inline-flex');
    });

    test('VERTICAL + parent match → flex flex-col', () => {
      const node = { parent: { layoutMode: 'VERTICAL' } };
      const layout = { mode: 'VERTICAL' };

      const result = generateAutoLayoutClasses(node, layout);

      expect(result.css).toContain('display: flex');
      expect(result.css).toContain('flex-direction: column');
      expect(result.tailwind).toContain('flex');
      expect(result.tailwind).toContain('flex-col');
    });

    test('VERTICAL + no parent match → inline-flex flex-col', () => {
      const node = { parent: { layoutMode: 'HORIZONTAL' } };
      const layout = { mode: 'VERTICAL' };

      const result = generateAutoLayoutClasses(node, layout);

      expect(result.css).toContain('display: inline-flex');
      expect(result.css).toContain('flex-direction: column');
      expect(result.tailwind).toContain('inline-flex');
      expect(result.tailwind).toContain('flex-col');
    });

    test('NONE → no flex properties', () => {
      const layout = { mode: 'NONE' };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toEqual([]);
      expect(result.tailwind).toEqual([]);
    });
  });

  // Primary Axis Alignment Tests
  describe('primaryAxisAlignItems mapping', () => {

    test('MIN → justify-start', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'MIN'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('justify-content: flex-start');
      expect(result.tailwind).toContain('justify-start');
    });

    test('CENTER → justify-center', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('justify-content: center');
      expect(result.tailwind).toContain('justify-center');
    });

    test('MAX → justify-end', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'MAX'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('justify-content: flex-end');
      expect(result.tailwind).toContain('justify-end');
    });

    test('SPACE_BETWEEN → justify-between', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('justify-content: space-between');
      expect(result.tailwind).toContain('justify-between');
    });
  });

  // Counter Axis Alignment Tests
  describe('counterAxisAlignItems mapping', () => {

    test('MIN → items-start', () => {
      const layout = {
        mode: 'HORIZONTAL',
        counterAxisAlignItems: 'MIN'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-items: flex-start');
      expect(result.tailwind).toContain('items-start');
    });

    test('CENTER → items-center', () => {
      const layout = {
        mode: 'HORIZONTAL',
        counterAxisAlignItems: 'CENTER'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-items: center');
      expect(result.tailwind).toContain('items-center');
    });

    test('MAX → items-end', () => {
      const layout = {
        mode: 'HORIZONTAL',
        counterAxisAlignItems: 'MAX'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-items: flex-end');
      expect(result.tailwind).toContain('items-end');
    });

    test('BASELINE → items-baseline', () => {
      const layout = {
        mode: 'HORIZONTAL',
        counterAxisAlignItems: 'BASELINE'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-items: baseline');
      expect(result.tailwind).toContain('items-baseline');
    });
  });

  // Gap/ItemSpacing Tests
  describe('itemSpacing mapping', () => {

    test('itemSpacing 16px + not SPACE_BETWEEN → gap-4', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'MIN',
        itemSpacing: 16
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('gap: 16px');
      expect(result.tailwind).toContain('gap-4');
    });

    test('itemSpacing 16px + SPACE_BETWEEN → no gap', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        itemSpacing: 16
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).not.toContain('gap');
      expect(result.tailwind).not.toContain('gap');
    });

    test('itemSpacing 0 → no gap', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'MIN',
        itemSpacing: 0
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).not.toContain('gap');
      expect(result.tailwind).not.toContain('gap');
    });

    test('itemSpacing 24px → gap-6', () => {
      const layout = {
        mode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        itemSpacing: 24
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('gap: 24px');
      expect(result.tailwind).toContain('gap-6');
    });
  });

  // Wrapping Tests
  describe('layoutWrap mapping', () => {

    test('WRAP → flex-wrap + align-content', () => {
      const layout = {
        mode: 'HORIZONTAL',
        layoutWrap: 'WRAP',
        counterAxisAlignItems: 'MIN'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('flex-wrap: wrap');
      expect(result.css).toContain('align-content: flex-start');
      expect(result.tailwind).toContain('flex-wrap');
      expect(result.tailwind).toContain('content-start');
    });

    test('WRAP + CENTER → content-center', () => {
      const layout = {
        mode: 'HORIZONTAL',
        layoutWrap: 'WRAP',
        counterAxisAlignItems: 'CENTER'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-content: center');
      expect(result.tailwind).toContain('content-center');
    });

    test('WRAP + MAX → content-end', () => {
      const layout = {
        mode: 'HORIZONTAL',
        layoutWrap: 'WRAP',
        counterAxisAlignItems: 'MAX'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-content: flex-end');
      expect(result.tailwind).toContain('content-end');
    });

    test('WRAP + BASELINE → content-baseline', () => {
      const layout = {
        mode: 'HORIZONTAL',
        layoutWrap: 'WRAP',
        counterAxisAlignItems: 'BASELINE'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('align-content: baseline');
      expect(result.tailwind).toContain('content-baseline');
    });

    test('NO_WRAP → no flex-wrap', () => {
      const layout = {
        mode: 'HORIZONTAL',
        layoutWrap: 'NO_WRAP'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).not.toContain('flex-wrap');
      expect(result.tailwind).not.toContain('flex-wrap');
    });
  });

  // Padding Tests
  describe('padding mapping', () => {

    test('uniform padding → p-4', () => {
      const layout = {
        mode: 'HORIZONTAL',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 16,
        paddingBottom: 16
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('padding: 16px');
      expect(result.tailwind).toContain('p-4');
    });

    test('horizontal padding → px-6', () => {
      const layout = {
        mode: 'HORIZONTAL',
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 0,
        paddingBottom: 0
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('padding-left: 24px');
      expect(result.css).toContain('padding-right: 24px');
      expect(result.tailwind).toContain('px-6');
    });

    test('vertical padding → py-8', () => {
      const layout = {
        mode: 'VERTICAL',
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 32,
        paddingBottom: 32
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('padding-top: 32px');
      expect(result.css).toContain('padding-bottom: 32px');
      expect(result.tailwind).toContain('py-8');
    });

    test('individual padding → p[t|r|b|l]-{n}', () => {
      const layout = {
        mode: 'HORIZONTAL',
        paddingLeft: 8,
        paddingRight: 16,
        paddingTop: 24,
        paddingBottom: 32
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.tailwind).toContain('pt-6');
      expect(result.tailwind).toContain('pr-4');
      expect(result.tailwind).toContain('pb-8');
      expect(result.tailwind).toContain('pl-2');
    });
  });

  // Complete Combination Tests
  describe('Complete AutoLayout combinations', () => {

    test('Complex layout - all properties', () => {
      const node = { parent: { layoutMode: 'HORIZONTAL' } };
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        counterAxisAlignItems: 'CENTER',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 16,
        paddingBottom: 16,
        itemSpacing: 16, // Should be ignored with SPACE_BETWEEN
        layoutWrap: 'NO_WRAP'
      };

      const result = generateAutoLayoutClasses(node, layout);

      expect(result.css).toContain('display: flex');
      expect(result.css).toContain('justify-content: space-between');
      expect(result.css).toContain('align-items: center');
      expect(result.css).toContain('padding: 16px');
      expect(result.css).not.toContain('gap'); // SPACE_BETWEEN

      expect(result.tailwind).toContain('flex');
      expect(result.tailwind).toContain('justify-between');
      expect(result.tailwind).toContain('items-center');
      expect(result.tailwind).toContain('p-4');
      expect(result.tailwind).not.toContain('gap');
    });

    test('Wrapped grid layout', () => {
      const layout = {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'MIN',
        counterAxisAlignItems: 'MIN',
        itemSpacing: 16,
        layoutWrap: 'WRAP'
      };

      const result = generateAutoLayoutClasses(null, layout);

      expect(result.css).toContain('flex-wrap: wrap');
      expect(result.css).toContain('gap: 16px');
      expect(result.css).toContain('align-content: flex-start');
      expect(result.tailwind).toContain('flex-wrap');
      expect(result.tailwind).toContain('gap-4');
      expect(result.tailwind).toContain('content-start');
    });
  });
});
```

**Edge Cases**:
- Missing or null layout properties
- Invalid alignment values
- Negative padding/spacing values
- Parent context without layoutMode

## 4. Integration Tests

### Test Suite: End-to-End Layout Generation

**Purpose**: Validate complete pipeline from Figma data → generated code

```typescript
describe('Integration Tests', () => {

  test('Complete rotated button layout', () => {
    const figmaData = {
      type: 'FRAME',
      name: 'RotatedButton',
      x: 100,
      y: 100,
      width: 141.42,
      height: 141.42,
      rotation: 45,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      itemSpacing: 8
    };

    const generatedCode = generateComponent(figmaData);

    // Validate rotation
    expect(generatedCode).toContain('transform: rotate(-45deg)');
    // Validate AutoLayout
    expect(generatedCode).toContain('display: flex');
    expect(generatedCode).toContain('justify-content: center');
    expect(generatedCode).toContain('align-items: center');
    expect(generatedCode).toContain('gap: 8px');
  });

  test('Nested AutoLayout with FILL children', () => {
    const figmaData = {
      type: 'FRAME',
      layoutMode: 'VERTICAL',
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      width: 400,
      height: 600,
      children: [
        {
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          layoutSizingHorizontal: 'FILL',
          layoutSizingVertical: 'FIXED',
          height: 60
        },
        {
          type: 'FRAME',
          layoutMode: 'NONE',
          layoutSizingHorizontal: 'FILL',
          layoutSizingVertical: 'FILL'
        }
      ]
    };

    const generatedCode = generateComponent(figmaData);

    // Parent should be flex column
    expect(generatedCode).toContain('flex-direction: column');
    // First child: FILL in VERTICAL parent → width: 100%
    expect(generatedCode).toContain('width: 100%');
    // Second child: FILL vertical in VERTICAL parent → flex: 1
    expect(generatedCode).toContain('flex: 1 1 0');
  });

  test('Complex responsive card component', () => {
    const figmaData = {
      type: 'FRAME',
      name: 'Card',
      layoutMode: 'VERTICAL',
      layoutSizingHorizontal: 300,
      layoutSizingVertical: 'HUG',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 24,
      paddingBottom: 24,
      itemSpacing: 16,
      children: [
        {
          type: 'TEXT',
          name: 'Title',
          layoutSizingHorizontal: 'FILL',
          layoutSizingVertical: 'HUG'
        },
        {
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          layoutSizingHorizontal: 'FILL',
          itemSpacing: 8,
          children: [
            { layoutSizingHorizontal: 'FILL' },
            { layoutSizingHorizontal: 100 }
          ]
        }
      ]
    };

    const generatedCode = generateComponent(figmaData);

    // Card should have fixed width
    expect(generatedCode).toContain('width: 300px');
    // Card should be flex column
    expect(generatedCode).toContain('flex-direction: column');
    // Title should be full width
    expect(generatedCode).toContain('width: 100%');
    // Nested horizontal layout
    expect(generatedCode).toContain('flex-direction: row');
    // First child of horizontal → flex-1
    expect(generatedCode).toContain('flex: 1 1 0');
    // Second child → fixed width
    expect(generatedCode).toContain('width: 100px');
  });
});
```

## 5. Visual Validation Tests

### Approach: Screenshot Comparison

**Purpose**: Pixel-perfect validation against Figma designs

**Process**:
1. Export Figma design as PNG screenshot
2. Generate HTML/CSS code from Figma data
3. Render in headless browser (Playwright)
4. Capture screenshot of rendered output
5. Compare screenshots pixel-by-pixel
6. Highlight differences with visual diff

**Test Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { generateComponent } from '../src/generator/code-generator';
import { comparePNGs } from '../src/test-utils/visual-diff';

describe('Visual Validation Tests', () => {

  test('Rotated element at 45° matches Figma', async ({ page }) => {
    const figmaScreenshot = './test-fixtures/rotated-45.png';
    const figmaData = loadFixture('rotated-45.json');

    const generatedHTML = generateComponent(figmaData);

    await page.setContent(generatedHTML);
    const screenshot = await page.screenshot();

    const diff = await comparePNGs(screenshot, figmaScreenshot);

    expect(diff.pixelDifference).toBeLessThan(0.02); // <2% difference
    expect(diff.maxPositionError).toBeLessThan(1); // <1px position error
  });

  test('Complex AutoLayout matches Figma', async ({ page }) => {
    const figmaScreenshot = './test-fixtures/complex-layout.png';
    const figmaData = loadFixture('complex-layout.json');

    const generatedHTML = generateComponent(figmaData);

    await page.setContent(generatedHTML);
    const screenshot = await page.screenshot();

    const diff = await comparePNGs(screenshot, figmaScreenshot);

    expect(diff.pixelDifference).toBeLessThan(0.01); // <1% difference
  });

  test('Responsive FILL layout matches Figma at 3 breakpoints', async ({ page }) => {
    const figmaData = loadFixture('responsive-layout.json');
    const generatedHTML = generateComponent(figmaData);

    const breakpoints = [
      { width: 375, screenshot: './test-fixtures/responsive-mobile.png' },
      { width: 768, screenshot: './test-fixtures/responsive-tablet.png' },
      { width: 1440, screenshot: './test-fixtures/responsive-desktop.png' }
    ];

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: 800 });
      await page.setContent(generatedHTML);
      const screenshot = await page.screenshot();

      const diff = await comparePNGs(screenshot, bp.screenshot);

      expect(diff.pixelDifference).toBeLessThan(0.02);
    }
  });
});
```

## 6. Edge Case Tests

### Boundary Conditions

```typescript
describe('Edge Case Tests', () => {

  test('Rotation near 45° singularity (44.9°)', () => {
    const boundingBox = { x: 100, y: 100, width: 141, height: 141 };
    const result = calculateRotatedPosition(boundingBox, 44.9);

    expect(result.width).toBeFinite();
    expect(result.height).toBeFinite();
    expect(Math.abs(result.width - 100)).toBeLessThan(2);
  });

  test('Very large element (10000px)', () => {
    const boundingBox = { x: 0, y: 0, width: 10000, height: 10000 };
    const result = calculateRotatedPosition(boundingBox, 30);

    expect(result.width).toBeFinite();
    expect(result.height).toBeFinite();
  });

  test('Very small element (1px)', () => {
    const boundingBox = { x: 100, y: 100, width: 1, height: 1 };
    const result = calculateRotatedPosition(boundingBox, 45);

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  test('Deeply nested AutoLayout (10 levels)', () => {
    const deepLayout = createNestedLayout(10);
    const generatedCode = generateComponent(deepLayout);

    expect(generatedCode).toBeDefined();
    expect(generatedCode.length).toBeGreaterThan(0);
  });

  test('FILL child with no parent context', () => {
    const node = { layoutSizing: { horizontal: 'FILL' } };
    const result = generateHorizontalSizing(node, null);

    expect(result.css).toBe('width: 100%');
    expect(result.tailwind).toBe('w-full');
  });

  test('Invalid rotation value (NaN)', () => {
    const boundingBox = { x: 100, y: 100, width: 200, height: 100 };

    expect(() => {
      calculateRotatedPosition(boundingBox, NaN);
    }).toThrow('Invalid rotation value');
  });

  test('Negative itemSpacing', () => {
    const layout = {
      mode: 'HORIZONTAL',
      itemSpacing: -16
    };

    const result = generateAutoLayoutClasses(null, layout);

    expect(result.css).not.toContain('gap');
  });
});
```

## 7. Regression Tests

### Existing Feature Protection

**Purpose**: Ensure new algorithms don't break existing functionality

```typescript
describe('Regression Tests', () => {

  test('Existing visual validation still works', () => {
    // Load existing test fixture
    const existingTest = loadFixture('existing-layout.json');
    const generatedCode = generateComponent(existingTest);

    expect(generatedCode).toMatchSnapshot();
  });

  test('LLM generation still works with new IR schema', () => {
    const figmaData = loadFixture('complex-layout.json');
    const irNode = extractIR(figmaData);

    expect(irNode.autoLayout).toBeDefined();
    expect(irNode.layoutSizing).toBeDefined();
    expect(irNode.rotation).toBeDefined();
  });

  test('Auto-correction still applies to new layouts', () => {
    const figmaData = loadFixture('layout-with-errors.json');
    const generatedCode = generateComponent(figmaData);
    const correctedCode = applyCorrectionAgent(generatedCode);

    expect(correctedCode).not.toBe(generatedCode);
    expect(correctedCode).toContain('corrected');
  });

  test('Sandbox execution works with new CSS', () => {
    const generatedCode = generateComponent(loadFixture('rotated-layout.json'));
    const sandboxResult = executeSandbox(generatedCode);

    expect(sandboxResult.status).toBe('success');
  });
});
```

## 8. Mock Requirements

### Figma API Mocks

**Mock Data Structure**:

```typescript
// Mock Figma API Response
const mockFigmaNode = {
  id: '1:2',
  name: 'TestFrame',
  type: 'FRAME',

  // Position & Size
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  rotation: 45,

  // AutoLayout Properties
  layoutMode: 'HORIZONTAL',
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 8,
  paddingBottom: 8,
  itemSpacing: 16,
  layoutWrap: 'NO_WRAP',

  // Sizing Properties
  layoutSizingHorizontal: 'FILL',
  layoutSizingVertical: 'HUG',
  minWidth: null,
  maxWidth: null,
  minHeight: null,
  maxHeight: null,

  // Children
  children: []
};

// Mock Extractor
jest.mock('../src/figma/extractor', () => ({
  extractIR: (figmaNode) => ({
    id: figmaNode.id,
    name: figmaNode.name,
    type: figmaNode.type,
    position: {
      x: figmaNode.x,
      y: figmaNode.y
    },
    size: {
      width: figmaNode.width,
      height: figmaNode.height
    },
    rotation: figmaNode.rotation,
    autoLayout: figmaNode.layoutMode !== 'NONE' ? {
      mode: figmaNode.layoutMode,
      primaryAxisAlignItems: figmaNode.primaryAxisAlignItems,
      counterAxisAlignItems: figmaNode.counterAxisAlignItems,
      paddingLeft: figmaNode.paddingLeft,
      paddingRight: figmaNode.paddingRight,
      paddingTop: figmaNode.paddingTop,
      paddingBottom: figmaNode.paddingBottom,
      itemSpacing: figmaNode.itemSpacing,
      layoutWrap: figmaNode.layoutWrap
    } : null,
    layoutSizing: {
      horizontal: figmaNode.layoutSizingHorizontal,
      vertical: figmaNode.layoutSizingVertical
    },
    children: figmaNode.children.map(extractIR)
  })
}));
```

## 9. Test Coverage Requirements

### Coverage Targets

**Code Coverage**:
- **New Modules**: >90% statement coverage
- **Modified Modules**: >85% statement coverage
- **Critical Algorithms**: 100% branch coverage

**Test Distribution**:
- Unit tests: 70% of test suite
- Integration tests: 20% of test suite
- Visual validation: 10% of test suite

**Critical Paths** (100% coverage required):
- Rotation calculation algorithm
- Context-aware sizing decision logic
- AutoLayout property mapping
- IR tree construction with parent references

## 10. Test Execution Plan

### Test Phases

**Phase 1: Algorithm Unit Tests** (Week 1)
- Implement rotation tests (12 angles)
- Implement sizing tests (21 combinations)
- Implement AutoLayout tests (24+ cases)
- Target: >95% algorithm coverage

**Phase 2: Integration Tests** (Week 2)
- End-to-end layout generation
- Nested AutoLayout scenarios
- Complex component tests
- Target: All critical paths covered

**Phase 3: Visual Validation** (Week 2-3)
- Screenshot comparison setup
- Figma export automation
- Pixel diff threshold calibration
- Target: <2% visual difference

**Phase 4: Regression Testing** (Week 3)
- Existing feature validation
- Backward compatibility checks
- Performance benchmarking
- Target: Zero breaking changes

### CI/CD Integration

**Pre-commit**:
- Lint all test files
- Run fast unit tests (<5s)
- Check test coverage deltas

**Pre-push**:
- Run full unit test suite
- Run integration tests
- Generate coverage report

**CI Pipeline**:
- Run all tests in parallel
- Visual validation tests
- Performance benchmarks
- Coverage enforcement (>90%)

**Success Criteria**:
- All tests pass
- Coverage >90%
- Visual difference <2%
- No performance regressions
