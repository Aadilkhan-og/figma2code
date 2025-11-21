# Figma2Code

Autonomous AI agent for converting Figma UI designs to production-ready React + TypeScript + TailwindCSS code.

## Features

- **Figma Metadata Extraction**: Extracts layers, components, variants, AutoLayout, spacing, typography, and design tokens
- **Intelligent Component Mapping**: Automatically detects and maps UI elements (Buttons, Inputs, Cards, Modals, etc.) to React components
- **Intermediate Representation (IR)**: JSON-based UI layout representation with hierarchy, layout rules, and responsive breakpoints
- **Code Generation**: Generates clean React + TypeScript + TailwindCSS code using OpenAI or fallback templates
- **Self-Correction Loop**: Automatically fixes TypeScript/build errors and re-runs until code is valid
- **Visual Comparison**: Renders generated UI and compares with Figma reference using screenshot diffing
- **Iterative Optimization**: Adjusts code until reaching 90%+ visual similarity threshold

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
# Required
FIGMA_ACCESS_TOKEN=your_figma_access_token

# Optional (enables AI-powered code generation)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview

# Agent settings
MAX_BUILD_RETRIES=5
MAX_VISUAL_CORRECTION_CYCLES=7
VISUAL_SIMILARITY_THRESHOLD=90
```

## Usage

### CLI

```bash
# Convert a Figma design
npm run agent convert "https://figma.com/design/ABC123/MyDesign" -o ./output

# Extract IR only (no code generation)
npm run agent extract "https://figma.com/design/ABC123/MyDesign" -o ./ir.json

# Generate code from IR
npm run agent generate ./ir.json -o ./output

# Test Figma API connection
npm run agent test-connection
```

### CLI Options

```
convert <figma-url>     Convert Figma design to React code
  -o, --output <dir>    Output directory (default: ./generated)
  --skip-build          Skip build validation
  --skip-visual         Skip visual comparison
  --max-build-retries   Maximum build retry attempts (default: 5)
  --max-visual-cycles   Maximum visual correction cycles (default: 7)
  --threshold           Visual similarity threshold 0-100 (default: 90)
  --debug               Enable debug mode
  --json                Output result as JSON
```

### Programmatic Usage

```typescript
import { convert, AgentOrchestrator } from 'figma2code';

// Quick conversion
const result = await convert('https://figma.com/design/ABC123/MyDesign', {
  figmaAccessToken: 'your-token',
  openaiApiKey: 'your-openai-key',
});

// Or with full control
const agent = new AgentOrchestrator({
  figmaAccessToken: 'your-token',
  openaiApiKey: 'your-openai-key',
  openaiModel: 'gpt-4-turbo-preview',
  maxBuildRetries: 5,
  maxVisualCorrectionCycles: 7,
  visualSimilarityThreshold: 90,
  sandboxTimeout: 30000,
  sandboxPort: 3001,
  outputDir: './generated',
  debug: false,
});

// Listen to events
agent.addEventListener((event) => {
  console.log(`[${event.type}]`, event.data);
});

// Run conversion
const output = await agent.run({
  figmaUrl: 'https://figma.com/design/ABC123/MyDesign',
  outputDir: './output',
});
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        AgentOrchestrator                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐ │
│  │ FigmaClient │───>│  Extractor  │───>│ Intermediate         │ │
│  │             │    │             │    │ Representation (IR)  │ │
│  └─────────────┘    └─────────────┘    └──────────────────────┘ │
│                                                   │              │
│                                                   ▼              │
│                                        ┌──────────────────────┐ │
│                                        │ Component Mapper     │ │
│                                        └──────────────────────┘ │
│                                                   │              │
│                                                   ▼              │
│                                        ┌──────────────────────┐ │
│                                        │ Code Generator       │ │
│                                        │ (OpenAI / Fallback)  │ │
│                                        └──────────────────────┘ │
│                                                   │              │
│         ┌────────────────────────────────────────┼──────────┐   │
│         │                                        ▼          │   │
│         │  BUILD LOOP              ┌─────────────────────┐  │   │
│         │                          │ Sandbox Executor    │  │   │
│         │                          │ (Vite + TypeScript) │  │   │
│         │                          └─────────────────────┘  │   │
│         │                                   │               │   │
│         │                    ┌──────────────┴───────────┐   │   │
│         │                    │                          │   │   │
│         │              SUCCESS                     FAILED   │   │
│         │                    │                          │   │   │
│         │                    │         ┌────────────────┴─┐ │   │
│         │                    │         │ Error Fixer      │ │   │
│         │                    │         │ (OpenAI/Pattern) │ │   │
│         │                    │         └────────────────┬─┘ │   │
│         │                    │                          │   │   │
│         │                    │         ◄────────────────┘   │   │
│         │                    │         (retry until max)    │   │
│         └────────────────────┼──────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼──────────────────────────────┐   │
│         │                    ▼                              │   │
│         │  VISUAL LOOP     ┌────────────────────┐           │   │
│         │                  │ Visual Diff Engine │           │   │
│         │                  │ (Puppeteer)        │           │   │
│         │                  └────────────────────┘           │   │
│         │                          │                        │   │
│         │               ┌──────────┴──────────┐             │   │
│         │               │                     │             │   │
│         │         Score >= 90%          Score < 90%         │   │
│         │               │                     │             │   │
│         │               ▼         ┌───────────┴───────────┐ │   │
│         │            DONE         │ Visual Corrector      │ │   │
│         │                         │ (Tailwind adjustments)│ │   │
│         │                         └───────────┬───────────┘ │   │
│         │                                     │             │   │
│         │                          ◄──────────┘             │   │
│         │                          (retry until max/pass)   │   │
│         └───────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                        Final Output                        │  │
│  │  - IR Document                                            │  │
│  │  - Generated Code Bundle (base64 zip)                     │  │
│  │  - Build Status                                           │  │
│  │  - Visual Similarity Score                                │  │
│  │  - Remaining Differences                                  │  │
│  │  - Manual Review Items                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Output Format

```json
{
  "ir": { ... },
  "generatedCode": {
    "bundle": "base64_zip",
    "fileStructure": ["src/pages/GeneratedPage.tsx", "src/components/ui/Button.tsx", ...]
  },
  "buildStatus": "SUCCESS",
  "visualSimilarityScore": 0.93,
  "remainingDifferences": {
    "unmatchedElements": [],
    "improvementSuggestions": []
  },
  "manualReviewRequired": [
    "API data binding",
    "Form validation rules",
    "State handling (Redux/Zustand)"
  ],
  "metadata": {
    "figmaFileId": "ABC123",
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "totalIterations": 3,
    "buildAttempts": 2,
    "correctionCycles": 3,
    "processingTime": 45000
  }
}
```

## Generated Component Library

The agent generates a base component library including:

- **Button / IconButton**: Primary, secondary, outline, ghost, destructive variants
- **Input / Textarea / Select**: Form inputs with labels and error states
- **Checkbox / Radio / Switch / Slider**: Form controls
- **Card**: Container with header, content, footer sections
- **Avatar / Badge / Tag**: Display elements
- **Progress / Spinner / Skeleton**: Loading states
- **Modal / Drawer**: Overlay components

## Success Criteria

| Metric | Target |
|--------|--------|
| React Build Passes | Required |
| Visual Match Score | >= 90% |
| Component Mapping Accuracy | >= 95% |
| Human Rework After Generation | <= 20% |

## Development

```bash
# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## License

MIT
