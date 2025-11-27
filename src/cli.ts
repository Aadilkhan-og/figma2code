#!/usr/bin/env node

/**
 * Figma2Code CLI
 * Command-line interface for the Figma to React conversion agent
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import type { AgentConfig, AgentEvent } from './types/agent.js';
import { AgentOrchestrator } from './agent/index.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('figma2code')
  .description('Autonomous AI agent for converting Figma designs to React + TypeScript + TailwindCSS')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert a Figma design to React code')
  .argument('<figma-url>', 'Figma file URL or file key')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .option('--skip-build', 'Skip build validation')
  .option('--skip-visual', 'Skip visual comparison')
  .option('--max-build-retries <n>', 'Maximum build retry attempts', '5')
  .option('--max-visual-cycles <n>', 'Maximum visual correction cycles', '7')
  .option('--threshold <n>', 'Visual similarity threshold (0-100)', '90')
  .option('--debug', 'Enable debug mode')
  .option('--json', 'Output result as JSON')
  .action(async (figmaUrl: string, options) => {
    const spinner = ora('Initializing agent...').start();

    try {
      // Validate required environment variables
      const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!figmaToken) {
        spinner.fail('FIGMA_ACCESS_TOKEN environment variable is required');
        process.exit(1);
      }

      if (!openaiKey) {
        spinner.warn('OPENAI_API_KEY not set - using fallback code generation');
      }

      // Build config
      const config: AgentConfig = {
        figmaAccessToken: figmaToken,
        openaiApiKey: openaiKey || '',
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxBuildRetries: parseInt(options.maxBuildRetries, 10),
        maxVisualCorrectionCycles: parseInt(options.maxVisualCycles, 10),
        visualSimilarityThreshold: parseInt(options.threshold, 10),
        sandboxTimeout: parseInt(process.env.SANDBOX_TIMEOUT || '30000', 10),
        sandboxPort: parseInt(process.env.SANDBOX_PORT || '3001', 10),
        outputDir: options.output,
        debug: options.debug || process.env.DEBUG === 'true',
      };

      // Create agent
      const agent = new AgentOrchestrator(config);

      // Add event listener for progress
      if (!options.json) {
        agent.addEventListener((event: AgentEvent) => {
          updateSpinner(spinner, event);
        });
      }

      spinner.text = 'Starting conversion...';

      // Run the agent
      const result = await agent.run({
        figmaUrl,
        outputDir: options.output,
        skipBuild: options.skipBuild,
        skipVisualComparison: options.skipVisual,
      });

      // Save files
      await agent.saveFiles(options.output);

      spinner.succeed('Conversion complete!');

      // Output results
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSummary(result, options.output);
      }

    } catch (error) {
      spinner.fail('Conversion failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));

      if (options.debug && error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }

      process.exit(1);
    }
  });

program
  .command('extract')
  .description('Extract IR from Figma design without code generation')
  .argument('<figma-url>', 'Figma file URL or file key')
  .option('-o, --output <file>', 'Output IR JSON file', './ir.json')
  .action(async (figmaUrl: string, options) => {
    const spinner = ora('Extracting Figma design...').start();

    try {
      const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
      if (!figmaToken) {
        spinner.fail('FIGMA_ACCESS_TOKEN environment variable is required');
        process.exit(1);
      }

      // Import modules
      const { FigmaClient, FigmaExtractor } = await import('./figma/index.js');

      const client = new FigmaClient({ accessToken: figmaToken });
      const fileKey = FigmaClient.extractFileKey(figmaUrl);
      const nodeId = FigmaClient.extractNodeId(figmaUrl);

      spinner.text = 'Fetching design from Figma...';

      const extractor = new FigmaExtractor(client, fileKey);
      const ir = await extractor.extract(nodeId);

      // Save IR to file
      await fs.writeFile(options.output, JSON.stringify(ir, null, 2));

      spinner.succeed(`IR extracted and saved to ${options.output}`);

      console.log(chalk.gray(`\nFile: ${ir.figmaFileName}`));
      console.log(chalk.gray(`Canvas: ${ir.canvas.width}x${ir.canvas.height}`));

    } catch (error) {
      spinner.fail('Extraction failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('Generate code from IR JSON file')
  .argument('<ir-file>', 'Path to IR JSON file')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .action(async (irFile: string, options) => {
    const spinner = ora('Generating code...').start();

    try {
      // Read IR file
      const irContent = await fs.readFile(irFile, 'utf-8');
      const ir = JSON.parse(irContent);

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        spinner.warn('OPENAI_API_KEY not set - using fallback code generation');
      }

      const config: AgentConfig = {
        figmaAccessToken: '',
        openaiApiKey: openaiKey || '',
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxBuildRetries: 5,
        maxVisualCorrectionCycles: 7,
        visualSimilarityThreshold: 90,
        sandboxTimeout: 30000,
        sandboxPort: 3001,
        outputDir: options.output,
        debug: false,
      };

      // Import and run generator
      const { CodeGenerator } = await import('./generator/index.js');
      const { ComponentMapper } = await import('./mapping/index.js');

      const mapper = new ComponentMapper();
      const generator = new CodeGenerator(config);

      spinner.text = 'Mapping components...';
      ir.root = mapper.mapTree(ir.root);

      spinner.text = 'Generating React code...';
      const bundle = await generator.generate(ir);

      // Save files
      await fs.mkdir(options.output, { recursive: true });
      for (const file of bundle.files) {
        const filePath = path.join(options.output, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
      }

      spinner.succeed(`Generated ${bundle.files.length} files in ${options.output}`);

    } catch (error) {
      spinner.fail('Code generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('test-connection')
  .description('Test Figma API connection')
  .action(async () => {
    const spinner = ora('Testing Figma API connection...').start();

    try {
      const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
      if (!figmaToken) {
        spinner.fail('FIGMA_ACCESS_TOKEN environment variable is required');
        process.exit(1);
      }

      const { FigmaClient } = await import('./figma/index.js');
      const client = new FigmaClient({ accessToken: figmaToken });
      const connected = await client.testConnection();

      if (connected) {
        spinner.succeed('Figma API connection successful');
      } else {
        spinner.fail('Figma API connection failed - check your access token');
        process.exit(1);
      }

    } catch (error) {
      spinner.fail('Connection test failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// Helper functions
function updateSpinner(spinner: Ora, event: AgentEvent): void {
  switch (event.type) {
    case 'figma_extraction_started':
      spinner.text = 'Extracting design from Figma...';
      break;
    case 'figma_extraction_complete':
      spinner.succeed('Figma extraction complete');
      spinner.start('Mapping components...');
      break;
    case 'component_mapping_complete':
      const accuracy = event.data.accuracy as number;
      spinner.succeed(`Component mapping complete (${(accuracy * 100).toFixed(1)}% accuracy)`);
      spinner.start('Generating code...');
      break;
    case 'code_generation_complete':
      const fileCount = event.data.fileCount as number;
      spinner.succeed(`Generated ${fileCount} files`);
      spinner.start('Building...');
      break;
    case 'build_started':
      const attempt = event.data.attempt as number;
      spinner.text = `Building (attempt ${attempt})...`;
      break;
    case 'build_complete':
      spinner.succeed('Build successful');
      spinner.start('Running visual comparison...');
      break;
    case 'build_failed':
      const errors = event.data.errors as unknown[];
      spinner.warn(`Build failed with ${errors.length} errors - attempting fix...`);
      break;
    case 'error_fix_complete':
      const fixedCount = event.data.fixedCount as number;
      spinner.info(`Fixed ${fixedCount} errors`);
      spinner.start('Rebuilding...');
      break;
    case 'comparison_started':
      const cycle = event.data.cycle as number;
      spinner.text = `Visual comparison (cycle ${cycle})...`;
      break;
    case 'comparison_complete':
      const score = event.data.score as number;
      spinner.info(`Visual similarity: ${score.toFixed(1)}%`);
      break;
    case 'correction_started':
      spinner.text = 'Applying visual corrections...';
      break;
    case 'correction_complete':
      const correctionCount = event.data.correctionCount as number;
      spinner.info(`Applied ${correctionCount} corrections`);
      break;
    case 'failed':
      spinner.fail(`Conversion failed: ${event.data.error}`);
      break;
  }
}

function printSummary(result: Awaited<ReturnType<AgentOrchestrator['run']>>, outputDir: string): void {
  console.log('');
  console.log(chalk.bold('Conversion Summary'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(`${chalk.green('✓')} Figma File: ${result.metadata.figmaFileId}`);
  console.log(`${chalk.green('✓')} Build Status: ${result.buildStatus}`);
  console.log(`${chalk.green('✓')} Visual Similarity: ${(result.visualSimilarityScore * 100).toFixed(1)}%`);
  console.log(`${chalk.green('✓')} Processing Time: ${(result.metadata.processingTime / 1000).toFixed(1)}s`);
  console.log(`${chalk.green('✓')} Build Attempts: ${result.metadata.buildAttempts}`);
  console.log(`${chalk.green('✓')} Correction Cycles: ${result.metadata.correctionCycles}`);

  console.log('');
  console.log(chalk.bold('Generated Files'));
  console.log(chalk.gray('─'.repeat(50)));

  for (const file of result.generatedCode.fileStructure) {
    console.log(`  ${chalk.cyan(file)}`);
  }

  if (result.remainingDifferences.unmatchedElements.length > 0) {
    console.log('');
    console.log(chalk.yellow('Unmatched Elements:'));
    for (const elem of result.remainingDifferences.unmatchedElements) {
      console.log(`  - ${elem}`);
    }
  }

  if (result.manualReviewRequired.length > 0) {
    console.log('');
    console.log(chalk.yellow('Manual Review Required:'));
    for (const item of result.manualReviewRequired) {
      console.log(`  - ${item}`);
    }
  }

  console.log('');
  console.log(chalk.green(`Output saved to: ${outputDir}`));
}

program.parse();
