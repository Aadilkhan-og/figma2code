/**
 * Plugin API Routes
 *
 * Handles requests from the Figma plugin for data extraction
 */

import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import type { IRDocument } from '../types/ir.js';
import { CodeGenerator } from '../generator/code-generator.js';
import { SandboxExecutor } from '../sandbox/executor.js';
import type { AgentConfig } from '../types/agent.js';

const router = express.Router();

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * POST /api/plugin/extract
 *
 * Receives extracted data from Figma plugin
 */
router.post('/extract', async (req, res) => {
  try {
    const { ir, screenshot, metadata, config } = req.body;

    if (!ir || !metadata) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ir, metadata'
      });
    }

    // Create job
    const jobId = generateJobId();
    const jobDir = path.join(process.cwd(), 'jobs', jobId);
    const outputDir = path.join(jobDir, 'output');

    console.log(`\n📦 [${jobId}] New plugin extraction request`);
    console.log(`   File: ${metadata.fileName}`);
    console.log(`   Node: ${metadata.nodeName}`);
    console.log(`   Nodes: ${metadata.nodeCount}`);

    // Create job directory
    await fs.mkdir(jobDir, { recursive: true });

    // Save IR
    console.log(`   💾 Saving IR document...`);
    await fs.writeFile(
      path.join(jobDir, 'ir.json'),
      JSON.stringify(ir, null, 2),
      'utf-8'
    );

    // Save screenshot if provided
    if (screenshot) {
      console.log(`   📸 Saving screenshot...`);
      const screenshotBuffer = Buffer.from(screenshot, 'base64');
      await fs.writeFile(
        path.join(jobDir, 'screenshot-figma.png'),
        screenshotBuffer
      );
    }

    // Save metadata
    const jobMetadata = {
      id: jobId,
      source: 'plugin',
      ...metadata,
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: config || {}
    };

    await fs.writeFile(
      path.join(jobDir, 'metadata.json'),
      JSON.stringify(jobMetadata, null, 2),
      'utf-8'
    );

    console.log(`   ✅ Job ${jobId} created`);

    // Start async processing
    processPluginExtraction(jobId, ir, outputDir, config || {})
      .then(() => {
        console.log(`   ✅ [${jobId}] Processing complete`);
      })
      .catch(err => {
        console.error(`   ❌ [${jobId}] Processing error:`, err);
      });

    // Return immediately
    res.json({
      success: true,
      jobId,
      status: 'processing',
      message: 'Extraction received, code generation started'
    });

  } catch (error) {
    console.error('Plugin extraction error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process plugin extraction in the background
 */
async function processPluginExtraction(
  jobId: string,
  ir: IRDocument,
  outputDir: string,
  config: any
) {
  const jobDir = path.dirname(outputDir);

  try {
    console.log(`\n🔨 [${jobId}] Starting code generation...`);

    // Create agent config
    const agentConfig: AgentConfig = {
      figmaAccessToken: '', // Not needed - we have IR already
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxBuildRetries: 5,
      maxVisualCorrectionCycles: 7,
      visualSimilarityThreshold: 90,
      sandboxTimeout: parseInt(process.env.SANDBOX_TIMEOUT || '30000', 10),
      sandboxPort: parseInt(process.env.SANDBOX_PORT || '3001', 10),
      outputDir,
      debug: process.env.DEBUG === 'true'
    };

    // Generate code from IR
    console.log(`   📝 [${jobId}] Generating React code from IR...`);
    const generator = new CodeGenerator(agentConfig, {
      useOpenAI: false, // Use fallback generator - we already have structured IR
      generateComponents: true,
      generatePages: true,
      extractProps: true // Week 2: Enable prop extraction
    });

    const codeBundle = await generator.generate(ir);

    // Save generated files
    console.log(`   💾 [${jobId}] Saving ${codeBundle.files.length} files...`);
    await fs.mkdir(outputDir, { recursive: true });

    for (const file of codeBundle.files) {
      const filePath = path.join(outputDir, file.path);
      const fileDir = path.dirname(filePath);

      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    // Update metadata - code generated
    await updateMetadata(jobDir, {
      status: 'code_generated',
      progress: 50,
      currentPhase: 'building'
    });

    // Skip build if requested
    if (config.skipBuild) {
      console.log(`   ⏭️  [${jobId}] Skipping build (as requested)`);
      await updateMetadata(jobDir, {
        status: 'completed',
        progress: 100,
        currentPhase: 'completed',
        completedAt: new Date().toISOString()
      });
      return;
    }

    // Initialize sandbox and install dependencies
    console.log(`   📦 [${jobId}] Installing dependencies...`);
    const sandbox = new SandboxExecutor(agentConfig);
    await sandbox.initialize();

    // Build the code
    console.log(`   🔨 [${jobId}] Building generated code...`);
    const buildResult = await sandbox.build();

    if (buildResult.status === 'SUCCESS') {
      console.log(`   ✅ [${jobId}] Build successful!`);

      await updateMetadata(jobDir, {
        status: 'completed',
        progress: 100,
        currentPhase: 'completed',
        completedAt: new Date().toISOString(),
        buildStatus: 'success'
      });

    } else {
      console.error(`   ❌ [${jobId}] Build failed:`, buildResult.errors);

      await updateMetadata(jobDir, {
        status: 'build_failed',
        progress: 75,
        currentPhase: 'build_failed',
        buildErrors: buildResult.errors
      });
    }

    // Skip visual comparison if requested or if build failed
    if (config.skipVisual || buildResult.status !== 'SUCCESS') {
      return;
    }

    // Visual comparison could go here if screenshot is available
    // For now, we'll skip it

  } catch (error) {
    console.error(`   ❌ [${jobId}] Processing error:`, error);

    await updateMetadata(jobDir, {
      status: 'error',
      progress: 0,
      currentPhase: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Update job metadata
 */
async function updateMetadata(jobDir: string, updates: any) {
  const metadataPath = path.join(jobDir, 'metadata.json');

  try {
    const existingData = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(existingData);

    const updatedMetadata = {
      ...metadata,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(
      metadataPath,
      JSON.stringify(updatedMetadata, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Failed to update metadata:', error);
  }
}

/**
 * GET /api/plugin/jobs/:jobId
 *
 * Get job status
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobDir = path.join(process.cwd(), 'jobs', jobId);
    const metadataPath = path.join(jobDir, 'metadata.json');

    const data = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(data);

    res.json({
      success: true,
      job: metadata
    });

  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
});

export default router;
