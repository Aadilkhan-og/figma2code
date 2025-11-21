/**
 * Agent Orchestrator
 * Main controller that orchestrates the entire Figma to React conversion process
 * with self-correction and optimization loops
 */

import archiver from 'archiver';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  AgentConfig,
  AgentState,
  AgentPhase,
  AgentOutput,
  AgentEvent,
  AgentEventListener,
  GeneratedCodeBundle,
  BuildResult,
  VisualComparisonResult,
} from '../types/agent.js';
import type { IRDocument } from '../types/ir.js';
import { FigmaClient, FigmaExtractor } from '../figma/index.js';
import { ComponentMapper } from '../mapping/index.js';
import { CodeGenerator } from '../generator/index.js';
import { SandboxExecutor } from '../sandbox/index.js';
import { VisualDiffEngine } from '../visual/index.js';
import { ErrorFixer, VisualCorrector } from '../correction/index.js';

export interface AgentOptions {
  figmaUrl: string;
  outputDir?: string;
  skipBuild?: boolean;
  skipVisualComparison?: boolean;
}

export class AgentOrchestrator {
  private config: AgentConfig;
  private state: AgentState;
  private eventListeners: AgentEventListener[] = [];

  // Module instances
  private figmaClient: FigmaClient;
  private sandbox: SandboxExecutor;
  private visualDiff: VisualDiffEngine;
  private errorFixer: ErrorFixer;
  private visualCorrector: VisualCorrector;
  private codeGenerator: CodeGenerator;
  private componentMapper: ComponentMapper;

  // Working data
  private ir: IRDocument | null = null;
  private bundle: GeneratedCodeBundle | null = null;
  private figmaImagePath: string | null = null;

  constructor(config: AgentConfig) {
    this.config = config;

    // Initialize state
    this.state = {
      phase: 'IDLE',
      iteration: 0,
      buildAttempts: 0,
      correctionCycles: 0,
      currentScore: 0,
      errors: [],
      differences: [],
    };

    // Initialize modules
    this.figmaClient = new FigmaClient({ accessToken: config.figmaAccessToken });
    this.sandbox = new SandboxExecutor(config);
    this.visualDiff = new VisualDiffEngine(config);
    this.errorFixer = new ErrorFixer(config);
    this.visualCorrector = new VisualCorrector(config);
    this.codeGenerator = new CodeGenerator(config);
    this.componentMapper = new ComponentMapper();
  }

  /**
   * Main entry point - run the full conversion pipeline
   */
  async run(options: AgentOptions): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      this.emit('started', { figmaUrl: options.figmaUrl });

      // Step 1: Extract Figma metadata
      await this.extractFigma(options.figmaUrl);

      // Step 2: Map components
      await this.mapComponents();

      // Step 3: Generate code
      await this.generateCode();

      // Step 4: Build and fix loop
      if (!options.skipBuild) {
        await this.buildLoop();
      }

      // Step 5: Visual comparison and correction loop
      if (!options.skipVisualComparison && this.figmaImagePath) {
        await this.visualLoop();
      }

      // Step 6: Generate final output
      const output = await this.generateOutput(options, startTime);

      this.setPhase('COMPLETE');
      this.emit('complete', { output });

      return output;
    } catch (error) {
      this.setPhase('FAILED');
      this.emit('failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Step 1: Extract Figma design metadata
   */
  private async extractFigma(figmaUrl: string): Promise<void> {
    this.setPhase('EXTRACTING_FIGMA');
    this.emit('figma_extraction_started', { url: figmaUrl });

    // Parse URL
    const fileKey = FigmaClient.extractFileKey(figmaUrl);
    const nodeId = FigmaClient.extractNodeId(figmaUrl);

    // Create extractor and extract IR
    const extractor = new FigmaExtractor(this.figmaClient, fileKey);
    this.ir = await extractor.extract(nodeId, {
      includeHidden: false,
      extractAssets: true,
    });

    // Download Figma screenshot for comparison
    const screenshotDir = path.join(process.cwd(), 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });

    const targetNodeId = nodeId || this.ir.root.figmaNodeId;
    if (targetNodeId) {
      try {
        const imageUrl = await this.figmaClient.getImageUrl(fileKey, targetNodeId, {
          scale: 2,
          format: 'png',
        });

        if (imageUrl) {
          const imageBuffer = await this.figmaClient.downloadImage(imageUrl);
          this.figmaImagePath = path.join(screenshotDir, `figma-reference-${Date.now()}.png`);
          await fs.writeFile(this.figmaImagePath, imageBuffer);
        }
      } catch (error) {
        console.warn('Failed to download Figma screenshot:', error);
      }
    }

    this.emit('figma_extraction_complete', {
      fileId: this.ir.figmaFileId,
      fileName: this.ir.figmaFileName,
      nodeCount: this.countNodes(this.ir.root),
    });
  }

  /**
   * Step 2: Map Figma components to React components
   */
  private async mapComponents(): Promise<void> {
    this.setPhase('MAPPING_COMPONENTS');
    this.emit('component_mapping_started', {});

    if (!this.ir) throw new Error('IR not available');

    // Map the IR tree
    this.ir.root = this.componentMapper.mapTree(this.ir.root);

    // Calculate mapping accuracy
    const accuracy = this.componentMapper.calculateMappingAccuracy(this.ir.root);

    this.emit('component_mapping_complete', {
      accuracy: accuracy.accuracy,
      totalNodes: accuracy.totalNodes,
      mappedNodes: accuracy.mappedNodes,
    });
  }

  /**
   * Step 3: Generate React code
   */
  private async generateCode(): Promise<void> {
    this.setPhase('GENERATING_CODE');
    this.emit('code_generation_started', {});

    if (!this.ir) throw new Error('IR not available');

    // Generate code bundle
    this.bundle = await this.codeGenerator.generate(this.ir);

    this.emit('code_generation_complete', {
      fileCount: this.bundle.files.length,
      entryPoint: this.bundle.entryPoint,
    });
  }

  /**
   * Step 4: Build and error fix loop
   */
  private async buildLoop(): Promise<void> {
    if (!this.bundle) throw new Error('Bundle not available');

    // Initialize sandbox
    await this.sandbox.initialize();

    let buildResult: BuildResult;
    let attempts = 0;
    const maxAttempts = this.config.maxBuildRetries;

    while (attempts < maxAttempts) {
      attempts++;
      this.state.buildAttempts = attempts;

      this.setPhase('BUILDING');
      this.emit('build_started', { attempt: attempts });

      // Deploy code to sandbox
      await this.sandbox.deploy(this.bundle);

      // Run build
      buildResult = await this.sandbox.build();

      if (buildResult.status === 'SUCCESS') {
        this.emit('build_complete', {
          attempt: attempts,
          buildTime: buildResult.buildTime,
        });
        break;
      }

      this.emit('build_failed', {
        attempt: attempts,
        errors: buildResult.errors,
      });

      // Try to fix errors
      if (attempts < maxAttempts && buildResult.errors.length > 0) {
        this.setPhase('FIXING_ERRORS');
        this.emit('error_fix_started', { errorCount: buildResult.errors.length });

        const { fixedFiles, remainingErrors } = await this.errorFixer.fixErrors(
          buildResult.errors,
          this.bundle.files,
          this.sandbox.getWorkDir()
        );

        this.bundle.files = fixedFiles;
        this.state.errors = remainingErrors;

        this.emit('error_fix_complete', {
          fixedCount: buildResult.errors.length - remainingErrors.length,
          remainingCount: remainingErrors.length,
        });

        // If no errors were fixed, stop trying
        if (remainingErrors.length === buildResult.errors.length) {
          break;
        }
      }
    }

    // Final state update
    this.state.errors = buildResult!.errors;
  }

  /**
   * Step 5: Visual comparison and correction loop
   */
  private async visualLoop(): Promise<void> {
    if (!this.bundle || !this.figmaImagePath || !this.ir) {
      return;
    }

    let cycles = 0;
    const maxCycles = this.config.maxVisualCorrectionCycles;
    const threshold = this.config.visualSimilarityThreshold;

    // Start dev server
    const { url } = await this.sandbox.startDevServer();

    await this.visualDiff.initialize();

    while (cycles < maxCycles) {
      cycles++;
      this.state.correctionCycles = cycles;

      this.setPhase('COMPARING');
      this.emit('comparison_started', { cycle: cycles });

      // Compare rendered UI with Figma reference
      const comparison = await this.visualDiff.compare(url, this.figmaImagePath, this.ir);

      this.state.currentScore = comparison.score;
      this.state.differences = comparison.differences;

      this.emit('comparison_complete', {
        cycle: cycles,
        score: comparison.score,
        differenceCount: comparison.differences.length,
      });

      // Check if we've reached the threshold
      if (comparison.score >= threshold) {
        break;
      }

      // Try to correct differences
      if (cycles < maxCycles && comparison.differences.length > 0) {
        this.setPhase('CORRECTING');
        this.emit('correction_started', {
          cycle: cycles,
          differenceCount: comparison.differences.length,
        });

        // Generate corrections
        const corrections = await this.visualCorrector.generateCorrections(
          comparison.differences,
          this.ir,
          this.bundle.files
        );

        // Apply corrections
        if (corrections.length > 0) {
          this.bundle.files = await this.visualCorrector.applyCorrections(
            corrections,
            this.bundle.files
          );

          // Redeploy and rebuild
          await this.sandbox.deploy(this.bundle);
          const rebuildResult = await this.sandbox.build();

          this.emit('correction_complete', {
            cycle: cycles,
            correctionCount: corrections.length,
            buildSuccess: rebuildResult.status === 'SUCCESS',
          });

          // If build failed, stop correcting
          if (rebuildResult.status !== 'SUCCESS') {
            break;
          }
        } else {
          // No corrections generated
          break;
        }
      }

      this.emit('iteration_complete', {
        cycle: cycles,
        score: comparison.score,
      });
    }

    await this.sandbox.stopDevServer();
  }

  /**
   * Generate final output
   */
  private async generateOutput(options: AgentOptions, startTime: number): Promise<AgentOutput> {
    if (!this.ir || !this.bundle) {
      throw new Error('IR or bundle not available');
    }

    // Create zip bundle
    const zipBuffer = await this.createZipBundle();

    // Determine manual review items
    const manualReviewRequired: string[] = [];

    // Always need review for:
    manualReviewRequired.push('API data binding');
    manualReviewRequired.push('Form validation rules');
    manualReviewRequired.push('State handling (Redux/Zustand)');
    manualReviewRequired.push('Event handlers implementation');

    if (this.state.currentScore < this.config.visualSimilarityThreshold) {
      manualReviewRequired.push('Visual fidelity adjustments');
    }

    if (this.state.errors.length > 0) {
      manualReviewRequired.push('Remaining build errors');
    }

    // Generate output
    return {
      ir: this.ir,
      generatedCode: {
        bundle: zipBuffer.toString('base64'),
        fileStructure: this.bundle.files.map(f => f.path),
      },
      buildStatus: this.state.errors.length === 0 ? 'SUCCESS' : 'FAILED',
      visualSimilarityScore: this.state.currentScore / 100,
      remainingDifferences: {
        unmatchedElements: this.state.differences
          .filter(d => d.type === 'missing')
          .map(d => d.elementName),
        improvementSuggestions: this.state.differences
          .filter(d => d.severity === 'major')
          .map(d => `${d.elementName}: ${d.type} - expected ${d.expected}, got ${d.actual}`),
      },
      manualReviewRequired,
      metadata: {
        figmaFileId: this.ir.figmaFileId,
        figmaNodeId: this.ir.figmaNodeId,
        generatedAt: new Date().toISOString(),
        totalIterations: this.state.iteration,
        buildAttempts: this.state.buildAttempts,
        correctionCycles: this.state.correctionCycles,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Create zip bundle of generated files
   */
  private async createZipBundle(): Promise<Buffer> {
    if (!this.bundle) throw new Error('Bundle not available');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add all files to archive
      for (const file of this.bundle!.files) {
        archive.append(file.content, { name: file.path });
      }

      archive.finalize();
    });
  }

  /**
   * Save generated files to disk
   */
  async saveFiles(outputDir: string): Promise<void> {
    if (!this.bundle) throw new Error('Bundle not available');

    for (const file of this.bundle.files) {
      const filePath = path.join(outputDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.sandbox.clean();
      await this.visualDiff.cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Count nodes in IR tree
   */
  private countNodes(node: { children?: unknown[] }): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child as { children?: unknown[] });
      }
    }
    return count;
  }

  /**
   * Set current phase
   */
  private setPhase(phase: AgentPhase): void {
    this.state.phase = phase;
  }

  /**
   * Emit event to listeners
   */
  private emit(type: AgentEvent['type'], data: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: AgentEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: AgentEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get IR document
   */
  getIR(): IRDocument | null {
    return this.ir;
  }

  /**
   * Get generated bundle
   */
  getBundle(): GeneratedCodeBundle | null {
    return this.bundle;
  }
}
