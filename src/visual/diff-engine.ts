/**
 * Visual Diff Engine
 * Compares rendered UI against Figma reference using screenshot diffing
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { promises as fs } from 'fs';
import path from 'path';
import type { VisualComparisonResult, VisualDifference, AgentConfig } from '../types/agent';
import type { IRDocument, IRNode, BoundingBox } from '../types/ir';

export interface DiffEngineOptions {
  threshold?: number;
  outputDir?: string;
  viewport?: { width: number; height: number };
}

export class VisualDiffEngine {
  private config: AgentConfig;
  private options: DiffEngineOptions;
  private browser: Browser | null = null;

  constructor(config: AgentConfig, options?: DiffEngineOptions) {
    this.config = config;
    this.options = {
      threshold: 0.1, // Pixel matching threshold
      outputDir: path.join(process.cwd(), 'screenshots'),
      ...options,
    };
  }

  /**
   * Initialize browser instance
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    await fs.mkdir(this.options.outputDir!, { recursive: true });
  }

  /**
   * Cleanup browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Capture screenshot of rendered page
   */
  async captureScreenshot(url: string, outputPath: string, viewport?: { width: number; height: number }): Promise<string> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();

    try {
      // Set viewport
      await page.setViewport({
        width: viewport?.width || this.options.viewport?.width || 1440,
        height: viewport?.height || this.options.viewport?.height || 900,
      });

      // Navigate and wait for network idle
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait a bit for any animations to settle
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

      // Capture screenshot
      await page.screenshot({ path: outputPath, fullPage: false });

      return outputPath;
    } finally {
      await page.close();
    }
  }

  /**
   * Compare two screenshots using pixelmatch
   */
  async compareScreenshots(
    actualPath: string,
    expectedPath: string,
    diffPath: string
  ): Promise<{ matchPercentage: number; diffPixels: number; totalPixels: number }> {
    const [actualBuffer, expectedBuffer] = await Promise.all([
      fs.readFile(actualPath),
      fs.readFile(expectedPath),
    ]);

    const actualPng = PNG.sync.read(actualBuffer);
    const expectedPng = PNG.sync.read(expectedBuffer);

    // Ensure same dimensions by resizing if needed
    const width = Math.max(actualPng.width, expectedPng.width);
    const height = Math.max(actualPng.height, expectedPng.height);

    // Create diff image
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      this.resizeImageData(actualPng, width, height),
      this.resizeImageData(expectedPng, width, height),
      diff.data,
      width,
      height,
      { threshold: this.options.threshold || 0.1 }
    );

    // Save diff image
    await fs.writeFile(diffPath, PNG.sync.write(diff));

    const totalPixels = width * height;
    const matchPercentage = ((totalPixels - numDiffPixels) / totalPixels) * 100;

    return {
      matchPercentage,
      diffPixels: numDiffPixels,
      totalPixels,
    };
  }

  /**
   * Resize image data to target dimensions (padding with transparent pixels)
   */
  private resizeImageData(png: PNG, width: number, height: number): Uint8Array {
    if (png.width === width && png.height === height) {
      return png.data;
    }

    const result = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;
        if (x < png.width && y < png.height) {
          const srcIdx = (y * png.width + x) * 4;
          result[dstIdx] = png.data[srcIdx]!;
          result[dstIdx + 1] = png.data[srcIdx + 1]!;
          result[dstIdx + 2] = png.data[srcIdx + 2]!;
          result[dstIdx + 3] = png.data[srcIdx + 3]!;
        } else {
          // Transparent padding
          result[dstIdx] = 0;
          result[dstIdx + 1] = 0;
          result[dstIdx + 2] = 0;
          result[dstIdx + 3] = 0;
        }
      }
    }

    return result;
  }

  /**
   * Full visual comparison workflow
   */
  async compare(
    renderedUrl: string,
    figmaImagePath: string,
    ir: IRDocument
  ): Promise<VisualComparisonResult> {
    await this.initialize();

    const timestamp = Date.now();
    const actualPath = path.join(this.options.outputDir!, `actual-${timestamp}.png`);
    const diffPath = path.join(this.options.outputDir!, `diff-${timestamp}.png`);

    // Capture screenshot of rendered page
    await this.captureScreenshot(renderedUrl, actualPath, {
      width: ir.canvas.width,
      height: ir.canvas.height,
    });

    // Compare with Figma reference
    const comparison = await this.compareScreenshots(actualPath, figmaImagePath, diffPath);

    // Analyze structural differences
    const differences = await this.analyzeStructuralDifferences(
      renderedUrl,
      ir,
      actualPath,
      figmaImagePath
    );

    // Calculate component-level metrics
    const metrics = this.calculateMetrics(differences, ir);

    return {
      score: comparison.matchPercentage,
      differences,
      screenshotPath: actualPath,
      diffImagePath: diffPath,
      matchedElements: metrics.matchedElements,
      totalElements: metrics.totalElements,
      metrics: {
        boundingBoxMatch: metrics.boundingBoxMatch,
        colorMatch: metrics.colorMatch,
        spacingMatch: metrics.spacingMatch,
        componentPresence: metrics.componentPresence,
      },
    };
  }

  /**
   * Analyze structural differences between rendered UI and IR
   */
  private async analyzeStructuralDifferences(
    renderedUrl: string,
    ir: IRDocument,
    actualPath: string,
    expectedPath: string
  ): Promise<VisualDifference[]> {
    const differences: VisualDifference[] = [];

    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();

    try {
      await page.setViewport({
        width: ir.canvas.width,
        height: ir.canvas.height,
      });

      await page.goto(renderedUrl, { waitUntil: 'networkidle0' });

      // Analyze each IR node
      const analyzeNode = async (node: IRNode, parentBox?: BoundingBox) => {
        try {
          // Try to find corresponding element in DOM
          const selector = this.generateSelector(node);
          const element = await page.$(selector);

          if (!element) {
            differences.push({
              elementId: node.id,
              elementName: node.name,
              type: 'missing',
              expected: node.componentType,
              actual: 'not found',
              severity: 'critical',
              boundingBox: node.boundingBox,
            });
            return;
          }

          // Get rendered element's bounding box
          const renderedBox = await element.boundingBox();

          if (renderedBox && node.boundingBox) {
            // Check position differences
            const positionDiff = Math.abs(renderedBox.x - node.boundingBox.x) +
                                 Math.abs(renderedBox.y - node.boundingBox.y);

            if (positionDiff > 10) {
              differences.push({
                elementId: node.id,
                elementName: node.name,
                type: 'position',
                expected: `(${node.boundingBox.x}, ${node.boundingBox.y})`,
                actual: `(${renderedBox.x}, ${renderedBox.y})`,
                severity: positionDiff > 50 ? 'major' : 'minor',
                boundingBox: node.boundingBox,
              });
            }

            // Check size differences
            const sizeDiff = Math.abs(renderedBox.width - node.boundingBox.width) +
                            Math.abs(renderedBox.height - node.boundingBox.height);

            if (sizeDiff > 10) {
              differences.push({
                elementId: node.id,
                elementName: node.name,
                type: 'size',
                expected: `${node.boundingBox.width}x${node.boundingBox.height}`,
                actual: `${renderedBox.width}x${renderedBox.height}`,
                severity: sizeDiff > 50 ? 'major' : 'minor',
                boundingBox: node.boundingBox,
              });
            }
          }

          // Check spacing (for containers with children)
          if (node.children && node.autoLayout) {
            const gap = await this.measureGap(page, element, node.children.length);
            if (gap !== null && node.autoLayout.gap) {
              const gapDiff = Math.abs(gap - node.autoLayout.gap);
              if (gapDiff > 4) {
                differences.push({
                  elementId: node.id,
                  elementName: node.name,
                  type: 'spacing',
                  expected: node.autoLayout.gap,
                  actual: gap,
                  severity: gapDiff > 16 ? 'major' : 'minor',
                  boundingBox: node.boundingBox,
                });
              }
            }
          }

          // Recursively analyze children
          if (node.children) {
            for (const child of node.children) {
              await analyzeNode(child, node.boundingBox);
            }
          }
        } catch (error) {
          // Element analysis failed - might be dynamically rendered
          console.warn(`Failed to analyze element ${node.name}:`, error);
        }
      };

      await analyzeNode(ir.root);
    } finally {
      await page.close();
    }

    return differences;
  }

  /**
   * Generate CSS selector for an IR node
   */
  private generateSelector(node: IRNode): string {
    // Try to match by data attribute first
    if (node.figmaNodeId) {
      return `[data-figma-id="${node.figmaNodeId}"]`;
    }

    // Fall back to class-based matching
    const sanitizedName = node.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `[class*="${sanitizedName}"], .${sanitizedName}, [data-testid="${sanitizedName}"]`;
  }

  /**
   * Measure gap between child elements
   */
  private async measureGap(page: Page, container: puppeteer.ElementHandle, childCount: number): Promise<number | null> {
    if (childCount < 2) return null;

    try {
      const gap = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const gapValue = style.gap || style.columnGap || style.rowGap;
        if (gapValue && gapValue !== 'normal') {
          return parseFloat(gapValue);
        }
        return null;
      }, container);

      return gap;
    } catch {
      return null;
    }
  }

  /**
   * Calculate comparison metrics
   */
  private calculateMetrics(
    differences: VisualDifference[],
    ir: IRDocument
  ): {
    matchedElements: number;
    totalElements: number;
    boundingBoxMatch: number;
    colorMatch: number;
    spacingMatch: number;
    componentPresence: number;
  } {
    // Count total elements in IR
    let totalElements = 0;
    const countElements = (node: IRNode) => {
      totalElements++;
      node.children?.forEach(countElements);
    };
    countElements(ir.root);

    // Count differences by type
    const missingCount = differences.filter(d => d.type === 'missing').length;
    const positionDiffs = differences.filter(d => d.type === 'position').length;
    const sizeDiffs = differences.filter(d => d.type === 'size').length;
    const spacingDiffs = differences.filter(d => d.type === 'spacing').length;
    const colorDiffs = differences.filter(d => d.type === 'color').length;

    const matchedElements = totalElements - missingCount;

    return {
      matchedElements,
      totalElements,
      boundingBoxMatch: Math.max(0, 100 - ((positionDiffs + sizeDiffs) / totalElements) * 100),
      colorMatch: Math.max(0, 100 - (colorDiffs / totalElements) * 100),
      spacingMatch: Math.max(0, 100 - (spacingDiffs / totalElements) * 100),
      componentPresence: (matchedElements / totalElements) * 100,
    };
  }

  /**
   * Quick comparison without full structural analysis (faster)
   */
  async quickCompare(actualPath: string, expectedPath: string): Promise<number> {
    const diffPath = path.join(this.options.outputDir!, `quick-diff-${Date.now()}.png`);
    const result = await this.compareScreenshots(actualPath, expectedPath, diffPath);

    // Clean up diff file
    try {
      await fs.unlink(diffPath);
    } catch {
      // Ignore cleanup errors
    }

    return result.matchPercentage;
  }
}
