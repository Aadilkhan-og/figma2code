/**
 * Agent System Type Definitions
 */

import type { IRDocument } from './ir';

// Build Status Types
export type BuildStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'IN_PROGRESS';

// Error Types
export interface BuildError {
  type: 'typescript' | 'syntax' | 'import' | 'jsx' | 'runtime' | 'unknown';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
}

export interface VisualDifference {
  elementId: string;
  elementName: string;
  type: 'position' | 'size' | 'color' | 'spacing' | 'missing' | 'extra' | 'style';
  expected: string | number;
  actual: string | number;
  severity: 'critical' | 'major' | 'minor';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Generation Result Types
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'component' | 'page' | 'style' | 'config' | 'util' | 'type';
}

export interface GeneratedCodeBundle {
  files: GeneratedFile[];
  entryPoint: string;
  dependencies: Record<string, string>;
}

// Build Result Types
export interface BuildResult {
  status: BuildStatus;
  errors: BuildError[];
  warnings: string[];
  outputPath?: string;
  buildTime?: number;
}

// Visual Comparison Types
export interface VisualComparisonResult {
  score: number;
  differences: VisualDifference[];
  screenshotPath?: string;
  diffImagePath?: string;
  matchedElements: number;
  totalElements: number;
  metrics: {
    boundingBoxMatch: number;
    colorMatch: number;
    spacingMatch: number;
    componentPresence: number;
  };
}

// Correction Types
export interface CorrectionAction {
  type: 'tailwind_class' | 'layout' | 'spacing' | 'component_mapping' | 'style' | 'structure';
  target: string;
  description: string;
  before: string;
  after: string;
  confidence: number;
}

export interface CorrectionResult {
  applied: CorrectionAction[];
  skipped: CorrectionAction[];
  newScore: number;
  previousScore: number;
  improved: boolean;
}

// Agent Configuration
export interface AgentConfig {
  figmaAccessToken: string;
  openaiApiKey: string;
  openaiModel: string;
  maxBuildRetries: number;
  maxVisualCorrectionCycles: number;
  visualSimilarityThreshold: number;
  sandboxTimeout: number;
  sandboxPort: number;
  outputDir: string;
  debug: boolean;
}

// Agent State Types
export interface AgentState {
  phase: AgentPhase;
  iteration: number;
  buildAttempts: number;
  correctionCycles: number;
  currentScore: number;
  errors: BuildError[];
  differences: VisualDifference[];
}

export type AgentPhase =
  | 'IDLE'
  | 'EXTRACTING_FIGMA'
  | 'MAPPING_COMPONENTS'
  | 'GENERATING_CODE'
  | 'BUILDING'
  | 'FIXING_ERRORS'
  | 'RENDERING'
  | 'COMPARING'
  | 'CORRECTING'
  | 'COMPLETE'
  | 'FAILED';

// Final Output Types
export interface AgentOutput {
  ir: IRDocument;
  generatedCode: {
    bundle: string; // Base64 encoded zip
    fileStructure: string[];
  };
  buildStatus: BuildStatus;
  visualSimilarityScore: number;
  remainingDifferences: {
    unmatchedElements: string[];
    improvementSuggestions: string[];
  };
  manualReviewRequired: string[];
  metadata: {
    figmaFileId: string;
    figmaNodeId?: string;
    generatedAt: string;
    totalIterations: number;
    buildAttempts: number;
    correctionCycles: number;
    processingTime: number;
  };
}

// Component Mapping Types
export interface ComponentMapping {
  figmaName: string;
  figmaType: string;
  reactComponent: string;
  props: Record<string, unknown>;
  confidence: number;
  variants?: Record<string, string>;
}

export interface ComponentMappingRule {
  pattern: RegExp | string;
  componentType: string;
  reactComponent: string;
  defaultProps?: Record<string, unknown>;
  variantMapping?: Record<string, Record<string, string>>;
  childrenMapping?: string;
}

// LLM Types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Event Types for Progress Tracking
export interface AgentEvent {
  type: AgentEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type AgentEventType =
  | 'started'
  | 'figma_extraction_started'
  | 'figma_extraction_complete'
  | 'component_mapping_started'
  | 'component_mapping_complete'
  | 'code_generation_started'
  | 'code_generation_complete'
  | 'build_started'
  | 'build_complete'
  | 'build_failed'
  | 'error_fix_started'
  | 'error_fix_complete'
  | 'render_started'
  | 'render_complete'
  | 'comparison_started'
  | 'comparison_complete'
  | 'correction_started'
  | 'correction_complete'
  | 'iteration_complete'
  | 'complete'
  | 'failed'
  | 'error';

export type AgentEventListener = (event: AgentEvent) => void;
