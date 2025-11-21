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
} from './types/ir';

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
} from './types/agent';

export type {
  FigmaFile,
  FigmaNode,
  FigmaFrameNode,
  FigmaTextNode,
} from './types/figma';

// Export modules
export { AgentOrchestrator } from './agent/index';
export type { AgentOptions } from './agent/index';

export { FigmaClient, FigmaExtractor } from './figma/index';
export type { FigmaClientConfig, ExtractionOptions } from './figma/index';

export { ComponentMapper, DEFAULT_MAPPING_RULES } from './mapping/index';

export { CodeGenerator, TailwindGenerator } from './generator/index';
export type { CodeGeneratorOptions } from './generator/index';

export { SandboxExecutor } from './sandbox/index';
export type { SandboxOptions } from './sandbox/index';

export { VisualDiffEngine } from './visual/index';
export type { DiffEngineOptions } from './visual/index';

export { ErrorFixer, VisualCorrector } from './correction/index';

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
