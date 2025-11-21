/**
 * Visual Corrector
 * Analyzes visual differences and generates code corrections
 */

import OpenAI from 'openai';
import type { VisualDifference, CorrectionAction, AgentConfig, GeneratedFile } from '../types/agent';
import type { IRDocument, IRNode } from '../types/ir';

export class VisualCorrector {
  private openai: OpenAI | null = null;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generate corrections based on visual differences
   */
  async generateCorrections(
    differences: VisualDifference[],
    ir: IRDocument,
    files: GeneratedFile[]
  ): Promise<CorrectionAction[]> {
    const corrections: CorrectionAction[] = [];

    // Group differences by type for efficient processing
    const positionDiffs = differences.filter(d => d.type === 'position');
    const sizeDiffs = differences.filter(d => d.type === 'size');
    const spacingDiffs = differences.filter(d => d.type === 'spacing');
    const colorDiffs = differences.filter(d => d.type === 'color');
    const missingDiffs = differences.filter(d => d.type === 'missing');

    // Generate corrections for each type
    corrections.push(...this.correctPositionDiffs(positionDiffs, ir));
    corrections.push(...this.correctSizeDiffs(sizeDiffs, ir));
    corrections.push(...this.correctSpacingDiffs(spacingDiffs, ir));
    corrections.push(...this.correctColorDiffs(colorDiffs, ir));

    // For missing elements, we need more context
    if (missingDiffs.length > 0 && this.openai) {
      const missingCorrections = await this.generateMissingElementCorrections(missingDiffs, ir, files);
      corrections.push(...missingCorrections);
    }

    return corrections;
  }

  /**
   * Apply corrections to generated files
   */
  async applyCorrections(
    corrections: CorrectionAction[],
    files: GeneratedFile[]
  ): Promise<GeneratedFile[]> {
    const updatedFiles: GeneratedFile[] = [];

    for (const file of files) {
      let content = file.content;

      // Find corrections applicable to this file
      const fileCorrections = corrections.filter(c => {
        // Check if correction target appears in this file
        return content.includes(c.before) || c.target.includes(file.path);
      });

      // Apply each correction
      for (const correction of fileCorrections) {
        if (correction.before && correction.after) {
          content = content.replace(correction.before, correction.after);
        }
      }

      updatedFiles.push({
        ...file,
        content,
      });
    }

    return updatedFiles;
  }

  /**
   * Correct position differences
   */
  private correctPositionDiffs(diffs: VisualDifference[], ir: IRDocument): CorrectionAction[] {
    const corrections: CorrectionAction[] = [];

    for (const diff of diffs) {
      const node = this.findNodeById(ir.root, diff.elementId);
      if (!node) continue;

      // Position issues are usually layout-related
      // Generate Tailwind class corrections
      const correction: CorrectionAction = {
        type: 'layout',
        target: node.name,
        description: `Fix position of ${node.name}`,
        before: '',
        after: '',
        confidence: 0.7,
      };

      // Analyze expected vs actual
      const expectedPos = diff.expected.toString();
      const actualPos = diff.actual.toString();

      // Try to determine if it's a margin/padding issue
      if (node.autoLayout?.padding) {
        // Might need to adjust container padding
        correction.description = `Adjust padding/margin for ${node.name}`;
      }

      corrections.push(correction);
    }

    return corrections;
  }

  /**
   * Correct size differences
   */
  private correctSizeDiffs(diffs: VisualDifference[], ir: IRDocument): CorrectionAction[] {
    const corrections: CorrectionAction[] = [];

    for (const diff of diffs) {
      const node = this.findNodeById(ir.root, diff.elementId);
      if (!node) continue;

      const expected = diff.expected.toString();
      const actual = diff.actual.toString();

      // Parse dimensions
      const [expectedW, expectedH] = expected.split('x').map(Number);
      const [actualW, actualH] = actual.split('x').map(Number);

      const classUpdates: string[] = [];

      // Width correction
      if (expectedW && actualW && Math.abs(expectedW - actualW) > 5) {
        classUpdates.push(this.generateWidthClass(expectedW));
      }

      // Height correction
      if (expectedH && actualH && Math.abs(expectedH - actualH) > 5) {
        classUpdates.push(this.generateHeightClass(expectedH));
      }

      if (classUpdates.length > 0) {
        corrections.push({
          type: 'tailwind_class',
          target: node.name,
          description: `Fix size of ${node.name} from ${actual} to ${expected}`,
          before: `className="`,
          after: `className="${classUpdates.join(' ')} `,
          confidence: 0.8,
        });
      }
    }

    return corrections;
  }

  /**
   * Correct spacing differences
   */
  private correctSpacingDiffs(diffs: VisualDifference[], ir: IRDocument): CorrectionAction[] {
    const corrections: CorrectionAction[] = [];

    for (const diff of diffs) {
      const node = this.findNodeById(ir.root, diff.elementId);
      if (!node) continue;

      const expectedGap = Number(diff.expected);
      const actualGap = Number(diff.actual);

      if (!isNaN(expectedGap) && !isNaN(actualGap)) {
        const gapClass = this.generateGapClass(expectedGap);

        // Try to find and replace existing gap class
        const gapPattern = /gap-\[?\d+(?:px)?\]?/;

        corrections.push({
          type: 'spacing',
          target: node.name,
          description: `Fix gap in ${node.name} from ${actualGap}px to ${expectedGap}px`,
          before: gapPattern.source,
          after: gapClass,
          confidence: 0.85,
        });
      }
    }

    return corrections;
  }

  /**
   * Correct color differences
   */
  private correctColorDiffs(diffs: VisualDifference[], ir: IRDocument): CorrectionAction[] {
    const corrections: CorrectionAction[] = [];

    for (const diff of diffs) {
      const node = this.findNodeById(ir.root, diff.elementId);
      if (!node) continue;

      const expectedColor = diff.expected.toString();

      corrections.push({
        type: 'style',
        target: node.name,
        description: `Fix color of ${node.name} to ${expectedColor}`,
        before: `bg-[#`,
        after: `bg-[${expectedColor}`,
        confidence: 0.75,
      });
    }

    return corrections;
  }

  /**
   * Generate corrections for missing elements using OpenAI
   */
  private async generateMissingElementCorrections(
    diffs: VisualDifference[],
    ir: IRDocument,
    files: GeneratedFile[]
  ): Promise<CorrectionAction[]> {
    if (!this.openai) return [];

    const corrections: CorrectionAction[] = [];

    const missingElements = diffs.map(d => ({
      name: d.elementName,
      type: d.expected,
      boundingBox: d.boundingBox,
    }));

    // Find the main page/component file
    const mainFile = files.find(f => f.type === 'page') || files[0];
    if (!mainFile) return corrections;

    const response = await this.openai.chat.completions.create({
      model: this.config.openaiModel || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert React developer. Analyze the missing UI elements and suggest code insertions.

Return a JSON array of corrections:
[
  {
    "target": "element name",
    "insertAfter": "string to find in code to insert after",
    "code": "JSX code to insert"
  }
]

Rules:
1. Use TailwindCSS for styling
2. Match the component types (Button, Card, etc.)
3. Use appropriate semantic HTML
4. Return valid JSON only`,
        },
        {
          role: 'user',
          content: `Missing elements that need to be added:
${JSON.stringify(missingElements, null, 2)}

Current code:
\`\`\`tsx
${mainFile.content}
\`\`\`

Generate insertions for the missing elements:`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    try {
      const content = response.choices[0]?.message?.content || '[]';
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const insertions = JSON.parse(jsonMatch[0]) as Array<{
          target: string;
          insertAfter: string;
          code: string;
        }>;

        for (const insertion of insertions) {
          corrections.push({
            type: 'structure',
            target: insertion.target,
            description: `Add missing element: ${insertion.target}`,
            before: insertion.insertAfter,
            after: `${insertion.insertAfter}\n${insertion.code}`,
            confidence: 0.6,
          });
        }
      }
    } catch {
      // Failed to parse response
    }

    return corrections;
  }

  /**
   * Find node by ID in IR tree
   */
  private findNodeById(node: IRNode, id: string): IRNode | null {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Generate Tailwind width class
   */
  private generateWidthClass(width: number): string {
    const widthMap: Record<number, string> = {
      16: 'w-4', 24: 'w-6', 32: 'w-8', 40: 'w-10', 48: 'w-12',
      64: 'w-16', 80: 'w-20', 96: 'w-24', 128: 'w-32',
      160: 'w-40', 192: 'w-48', 256: 'w-64', 320: 'w-80', 384: 'w-96',
    };

    // Find closest match
    const closest = Object.keys(widthMap).reduce((prev, curr) =>
      Math.abs(Number(curr) - width) < Math.abs(Number(prev) - width) ? curr : prev
    );

    return widthMap[Number(closest)] || `w-[${width}px]`;
  }

  /**
   * Generate Tailwind height class
   */
  private generateHeightClass(height: number): string {
    const heightMap: Record<number, string> = {
      16: 'h-4', 24: 'h-6', 32: 'h-8', 40: 'h-10', 48: 'h-12',
      64: 'h-16', 80: 'h-20', 96: 'h-24', 128: 'h-32',
      160: 'h-40', 192: 'h-48', 256: 'h-64', 320: 'h-80', 384: 'h-96',
    };

    const closest = Object.keys(heightMap).reduce((prev, curr) =>
      Math.abs(Number(curr) - height) < Math.abs(Number(prev) - height) ? curr : prev
    );

    return heightMap[Number(closest)] || `h-[${height}px]`;
  }

  /**
   * Generate Tailwind gap class
   */
  private generateGapClass(gap: number): string {
    const gapMap: Record<number, string> = {
      0: 'gap-0', 4: 'gap-1', 8: 'gap-2', 12: 'gap-3', 16: 'gap-4',
      20: 'gap-5', 24: 'gap-6', 28: 'gap-7', 32: 'gap-8',
      40: 'gap-10', 48: 'gap-12', 64: 'gap-16',
    };

    const closest = Object.keys(gapMap).reduce((prev, curr) =>
      Math.abs(Number(curr) - gap) < Math.abs(Number(prev) - gap) ? curr : prev
    );

    return gapMap[Number(closest)] || `gap-[${gap}px]`;
  }
}
