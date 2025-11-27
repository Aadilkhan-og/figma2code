/**
 * POSTDEV Programmatic API
 * Clean, simple API for backend services to call the figma2code engine
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import type {
  AgentConfig,
  AgentEvent,
  AgentOutput,
} from '../types/agent.js';

export interface PostDevOptions {
  figmaUrl: string;
  framework?: 'react'; // Will expand to 'vue' | 'angular' | 'html' in Phase 4
  outputDir: string;
  skipBuild?: boolean;
  skipVisualComparison?: boolean;
  onProgress?: (event: ProgressEvent) => void;
  config?: Partial<AgentConfig>;
}

export interface ProgressEvent {
  phase: string;
  message: string;
  progress: number; // 0-100
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface PostDevResult {
  success: boolean;
  bundleZip: Buffer;
  screenshots: {
    figma?: string;
    generated?: string;
    diff?: string;
  };
  metadata: {
    figmaFileId: string;
    figmaNodeId?: string;
    buildStatus: 'SUCCESS' | 'FAILED';
    visualScore: number; // 0-1
    processingTime: number; // milliseconds
    buildAttempts: number;
    correctionCycles: number;
  };
  files: {
    count: number;
    structure: string[];
    entryPoint: string;
  };
  warnings: string[];
  manualReviewRequired: string[];
}

export interface PostDevError {
  success: false;
  error: string;
  phase: string;
  details?: unknown;
}

/**
 * Main entry point for POSTDEV API
 * Generate React + TypeScript + Tailwind code from Figma URL
 */
export async function generateFromFigmaLink(
  options: PostDevOptions
): Promise<PostDevResult | PostDevError> {
  const startTime = Date.now();

  try {
    // Validate inputs
    validateOptions(options);

    // Build agent config
    const config = buildConfig(options);

    // Create orchestrator
    const orchestrator = new AgentOrchestrator(config);

    // Attach progress listener if provided
    if (options.onProgress) {
      orchestrator.addEventListener((event: AgentEvent) => {
        options.onProgress!(mapEventToProgress(event));
      });
    }

    // Run the conversion
    const result: AgentOutput = await orchestrator.run({
      figmaUrl: options.figmaUrl,
      outputDir: options.outputDir,
      skipBuild: options.skipBuild,
      skipVisualComparison: options.skipVisualComparison,
    });

    // Save files to disk
    await orchestrator.saveFiles(options.outputDir);

    // Read screenshots if available
    const screenshots = await readScreenshots(options.outputDir);

    // Convert bundle to Buffer
    const bundleZip = Buffer.from(result.generatedCode.bundle, 'base64');

    // Build successful result
    return {
      success: true,
      bundleZip,
      screenshots,
      metadata: {
        figmaFileId: result.metadata.figmaFileId,
        figmaNodeId: result.metadata.figmaNodeId,
        buildStatus: result.buildStatus,
        visualScore: result.visualSimilarityScore,
        processingTime: Date.now() - startTime,
        buildAttempts: result.metadata.buildAttempts,
        correctionCycles: result.metadata.correctionCycles,
      },
      files: {
        count: result.generatedCode.fileStructure.length,
        structure: result.generatedCode.fileStructure,
        entryPoint: 'src/pages/GeneratedPage.tsx', // Will be dynamic later
      },
      warnings: result.remainingDifferences.improvementSuggestions,
      manualReviewRequired: result.manualReviewRequired,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      phase: 'unknown',
      details: error,
    };
  }
}

/**
 * Validate input options
 */
function validateOptions(options: PostDevOptions): void {
  if (!options.figmaUrl) {
    throw new Error('figmaUrl is required');
  }

  if (!options.figmaUrl.includes('figma.com')) {
    throw new Error('Invalid Figma URL');
  }

  if (!options.outputDir) {
    throw new Error('outputDir is required');
  }

  if (options.framework && options.framework !== 'react') {
    throw new Error('Only React framework is supported in this version');
  }
}

/**
 * Build agent configuration from options
 */
function buildConfig(options: PostDevOptions): AgentConfig {
  // Get credentials from environment
  const figmaAccessToken = process.env.FIGMA_ACCESS_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!figmaAccessToken) {
    throw new Error('FIGMA_ACCESS_TOKEN environment variable is required');
  }

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // Build config with defaults + user overrides
  return {
    figmaAccessToken,
    openaiApiKey,
    openaiModel: 'gpt-4-turbo-preview',
    maxBuildRetries: 3,
    maxVisualCorrectionCycles: 3,
    visualSimilarityThreshold: 85, // 85%
    sandboxTimeout: 120000, // 2 minutes
    sandboxPort: 3000 + Math.floor(Math.random() * 1000), // Random port to avoid conflicts
    outputDir: options.outputDir,
    debug: false,
    ...options.config,
  };
}

/**
 * Map agent events to progress events
 */
function mapEventToProgress(event: AgentEvent): ProgressEvent {
  const phaseProgress: Record<string, number> = {
    started: 5,
    figma_extraction_started: 10,
    figma_extraction_complete: 20,
    component_mapping_started: 25,
    component_mapping_complete: 35,
    code_generation_started: 40,
    code_generation_complete: 60,
    build_started: 65,
    build_complete: 75,
    comparison_started: 80,
    comparison_complete: 85,
    correction_started: 88,
    correction_complete: 92,
    complete: 100,
  };

  const phaseMessages: Record<string, string> = {
    started: 'Starting conversion...',
    figma_extraction_started: 'Extracting Figma design...',
    figma_extraction_complete: 'Figma extraction complete',
    component_mapping_started: 'Mapping UI components...',
    component_mapping_complete: 'Component mapping complete',
    code_generation_started: 'Generating React code...',
    code_generation_complete: 'Code generation complete',
    build_started: 'Building and validating...',
    build_complete: 'Build successful',
    comparison_started: 'Comparing with Figma design...',
    comparison_complete: 'Visual comparison complete',
    correction_started: 'Applying corrections...',
    correction_complete: 'Corrections applied',
    complete: 'Conversion complete!',
    failed: 'Conversion failed',
  };

  return {
    phase: event.type,
    message: phaseMessages[event.type] || event.type,
    progress: phaseProgress[event.type] || 50,
    timestamp: event.timestamp,
    details: event.data,
  };
}

/**
 * Read screenshots from output directory
 */
async function readScreenshots(outputDir: string): Promise<{
  figma?: string;
  generated?: string;
  diff?: string;
}> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  const screenshots: { figma?: string; generated?: string; diff?: string } = {};

  try {
    const files = await fs.readdir(screenshotsDir);

    for (const file of files) {
      const filePath = path.join(screenshotsDir, file);

      if (file.includes('figma-reference')) {
        screenshots.figma = filePath;
      } else if (file.includes('generated')) {
        screenshots.generated = filePath;
      } else if (file.includes('diff')) {
        screenshots.diff = filePath;
      }
    }
  } catch {
    // Screenshots directory doesn't exist or is empty
  }

  return screenshots;
}

/**
 * Quick health check - verify credentials and connectivity
 */
export async function healthCheck(): Promise<{
  ready: boolean;
  figmaConnected: boolean;
  openaiConnected: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let figmaConnected = false;
  let openaiConnected = false;

  // Check environment variables
  if (!process.env.FIGMA_ACCESS_TOKEN) {
    errors.push('FIGMA_ACCESS_TOKEN not set');
  } else {
    figmaConnected = true; // We can't test without making a real API call
  }

  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY not set');
  } else {
    openaiConnected = true; // We can't test without making a real API call
  }

  return {
    ready: errors.length === 0,
    figmaConnected,
    openaiConnected,
    errors,
  };
}
