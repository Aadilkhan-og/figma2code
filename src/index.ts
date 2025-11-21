/**
 * Figma2Code - Main Entry Point
 * Autonomous AI agent for converting Figma designs to React + TypeScript + TailwindCSS
 */

// Export types
export type {
  IRDocument,
  IRNode,
  ComponentType,
  Style,
  AutoLayout,
  BoundingBox,
} from './types/ir.js';

export type {
  AgentConfig,
  AgentState,
  AgentOutput,
  AgentEvent,
  GeneratedFile,
  GeneratedCodeBundle,
  BuildResult,
  BuildError,
  VisualComparisonResult,
  VisualDifference,
  CorrectionAction,
  ComponentMapping,
} from './types/agent.js';

export type {
  FigmaFile,
  FigmaNode,
  FigmaFrameNode,
  FigmaTextNode,
} from './types/figma.js';

// Export modules
export { AgentOrchestrator } from './agent/index.js';
export type { AgentOptions } from './agent/index.js';

export { FigmaClient, FigmaExtractor } from './figma/index.js';
export type { FigmaClientConfig, ExtractionOptions } from './figma/index.js';

export { ComponentMapper, DEFAULT_MAPPING_RULES } from './mapping/index.js';

export { CodeGenerator, TailwindGenerator } from './generator/index.js';
export type { CodeGeneratorOptions } from './generator/index.js';

export { SandboxExecutor } from './sandbox/index.js';
export type { SandboxOptions } from './sandbox/index.js';

export { VisualDiffEngine } from './visual/index.js';
export type { DiffEngineOptions } from './visual/index.js';

export { ErrorFixer, VisualCorrector } from './correction/index.js';

/**
 * Quick conversion function for programmatic use
 */
export async function convert(
  figmaUrl: string,
  config: Partial<AgentConfig> & {
    figmaAccessToken: string;
  },
  options?: {
    outputDir?: string;
    skipBuild?: boolean;
    skipVisualComparison?: boolean;
  }
): Promise<AgentOutput> {
  const fullConfig: AgentConfig = {
    figmaAccessToken: config.figmaAccessToken,
    openaiApiKey: config.openaiApiKey || '',
    openaiModel: config.openaiModel || 'gpt-4-turbo-preview',
    maxBuildRetries: config.maxBuildRetries || 5,
    maxVisualCorrectionCycles: config.maxVisualCorrectionCycles || 7,
    visualSimilarityThreshold: config.visualSimilarityThreshold || 90,
    sandboxTimeout: config.sandboxTimeout || 30000,
    sandboxPort: config.sandboxPort || 3001,
    outputDir: options?.outputDir || './generated',
    debug: config.debug || false,
  };

  const agent = new AgentOrchestrator(fullConfig);

  return agent.run({
    figmaUrl,
    outputDir: options?.outputDir,
    skipBuild: options?.skipBuild,
    skipVisualComparison: options?.skipVisualComparison,
  });
}

/**
 * Default export for CommonJS compatibility
 */
export default {
  convert,
  AgentOrchestrator,
  FigmaClient,
  FigmaExtractor,
  ComponentMapper,
  CodeGenerator,
  TailwindGenerator,
  SandboxExecutor,
  VisualDiffEngine,
  ErrorFixer,
  VisualCorrector,
};
