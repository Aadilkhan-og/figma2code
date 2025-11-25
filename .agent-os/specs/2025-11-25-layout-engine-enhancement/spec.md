# Spec Requirements Document

> Spec: Layout Engine Enhancement - Phase 1
> Created: 2025-11-25
> Status: Planning

## Overview

Implement FigmaToCode's superior layout algorithms through clean-room development to achieve pixel-perfect fidelity for rotated elements, context-aware FILL/HUG/FIXED sizing, and precise AutoLayout-to-Flexbox conversion. This enhancement will dramatically improve the accuracy of generated layouts while maintaining GPL-3.0 compliance through independent implementation based on documented algorithmic concepts.

## User Stories

### Story 1: Accurate Rotation Handling

As a developer generating code from Figma designs, I want rotated elements to position correctly at any angle, so that my generated UI matches the design exactly without manual position adjustments.

**Workflow**: When a user converts a Figma design containing rotated elements (buttons, images, cards at 45°, 90°, 135°, etc.), the system calculates the correct CSS position and dimensions such that when the `transform: rotate()` is applied, the element appears in the exact position shown in Figma. This eliminates the current issue where rotated elements appear displaced or incorrectly sized.

### Story 2: Context-Aware Responsive Sizing

As a developer building responsive layouts, I want FILL/HUG/FIXED sizing modes to work correctly based on parent layout context, so that my generated components automatically adapt to different screen sizes without manual flex property adjustments.

**Workflow**: When generating code for a child element with `layoutSizingHorizontal: FILL` inside a HORIZONTAL parent layout, the system generates `flex: 1` or `w-full` (Tailwind) to take remaining space. For the same element in a VERTICAL parent, it generates `width: 100%` instead. This context-aware logic ensures responsive behaviors match Figma's AutoLayout system.

### Story 3: Pixel-Perfect AutoLayout Conversion

As a designer-developer handoff facilitator, I want Figma's AutoLayout properties to convert precisely to CSS Flexbox, so that spacing, alignment, and layout direction match the design without iteration.

**Workflow**: When converting a Figma frame with `layoutMode: HORIZONTAL`, `primaryAxisAlignItems: SPACE_BETWEEN`, and `itemSpacing: 16`, the system generates CSS with `display: flex`, `flex-direction: row`, `justify-content: space-between`, and `gap: 16px` (or Tailwind equivalents), resulting in a layout that exactly matches the Figma preview.

## Spec Scope

1. **Rotation Bounding Box Algorithm** - Mathematical calculation to determine original element dimensions and position such that CSS rotation produces correct visual output matching Figma's rotated bounding box
2. **FILL/HUG/FIXED Sizing Logic** - Context-aware sizing that considers parent layout mode to generate appropriate CSS flex properties, widths, and heights for all three Figma sizing modes
3. **AutoLayout Property Mapping** - Complete conversion system for Figma AutoLayout properties (layoutMode, primaryAxisAlignItems, counterAxisAlignItems, itemSpacing, layoutWrap) to CSS Flexbox and Tailwind utility classes
4. **Enhanced IR Schema** - Extension of current Intermediate Representation to capture AutoLayout metadata, sizing modes, and rotation data from Figma API
5. **Comprehensive Test Suite** - Unit and integration tests covering rotation angles (0-360°), all sizing mode combinations, and all AutoLayout alignment variations

## Out of Scope

- Multi-framework support (React, Vue, Angular) - deferred to Phase 2
- Color variable system - deferred to Phase 3
- Text segment handling - deferred to Phase 4
- Performance optimization and caching - deferred to Phase 5
- Plugin architecture and real-time updates - future consideration
- Design system detection and token extraction - Phase 2 scope

## Expected Deliverable

1. **Rotation Test Suite**: All test cases pass for elements rotated at 0°, 15°, 30°, 45°, 60°, 90°, 135°, 180°, 270°, and 360°, with correct positioning visible in browser screenshots
2. **Sizing Fidelity**: Generated layouts with FILL children inside HORIZONTAL parents use flex-grow, FILL children in VERTICAL parents use width: 100%, and all combinations produce pixel-perfect matches to Figma
3. **AutoLayout Accuracy**: Generated CSS Flexbox layouts match Figma AutoLayout previews with 100% alignment, spacing, and direction fidelity, validated through visual comparison tests

## Spec Documentation

- Tasks: @.agent-os/specs/2025-11-25-layout-engine-enhancement/tasks.md
- Technical Specification: @.agent-os/specs/2025-11-25-layout-engine-enhancement/sub-specs/technical-spec.md
- Algorithm Specification: @.agent-os/specs/2025-11-25-layout-engine-enhancement/sub-specs/algorithm-spec.md
- Tests Specification: @.agent-os/specs/2025-11-25-layout-engine-enhancement/sub-specs/tests.md
