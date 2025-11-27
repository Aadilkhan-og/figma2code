/**
 * POSTDEV Backend Server
 * Simple Express server for job management and processing
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { generateFromFigmaLink, healthCheck } from '../api/index.js';
import type { ProgressEvent } from '../api/index.js';
import { JobStorage } from './job-storage.js';
import type { Job } from './job-storage.js';

export interface ServerConfig {
  port: number;
  host: string;
  jobsDir?: string;
  maxConcurrentJobs?: number;
  corsOrigins?: string[];
}

export class PostDevServer {
  private app: express.Application;
  private config: ServerConfig;
  private storage: JobStorage;
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      port: config.port || 3001,
      host: config.host || '0.0.0.0',
      jobsDir: config.jobsDir,
      maxConcurrentJobs: config.maxConcurrentJobs || 3,
      corsOrigins: config.corsOrigins || ['http://localhost:3000'],
    };

    this.maxConcurrentJobs = this.config.maxConcurrentJobs;
    this.storage = new JobStorage({ jobsDir: this.config.jobsDir });
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: this.config.corsOrigins,
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files from public directory
    const publicDir = path.join(process.cwd(), 'public');
    this.app.use(express.static(publicDir));

    // Logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await healthCheck();
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          ...health,
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Create new job
    this.app.post('/api/jobs', async (req, res) => {
      try {
        const { figmaUrl } = req.body;

        if (!figmaUrl) {
          return res.status(400).json({
            error: 'figmaUrl is required',
          });
        }

        // Validate Figma URL
        if (!figmaUrl.includes('figma.com')) {
          return res.status(400).json({
            error: 'Invalid Figma URL',
          });
        }

        // Check concurrent job limit
        if (this.activeJobs.size >= this.maxConcurrentJobs) {
          return res.status(429).json({
            error: 'Too many concurrent jobs. Please try again later.',
            activeJobs: this.activeJobs.size,
            maxConcurrentJobs: this.maxConcurrentJobs,
          });
        }

        // Create job
        const job = await this.storage.createJob({ figmaUrl });

        // Start processing in background
        this.processJob(job.id).catch((error) => {
          console.error(`Job ${job.id} processing failed:`, error);
        });

        res.status(201).json({
          jobId: job.id,
          status: job.status,
          figmaUrl: job.figmaUrl,
          createdAt: job.createdAt,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get job status
    this.app.get('/api/jobs/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const job = await this.storage.getJob(id);

        if (!job) {
          return res.status(404).json({
            error: 'Job not found',
          });
        }

        res.json(job);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Download bundle
    this.app.get('/api/jobs/:id/download', async (req, res) => {
      try {
        const { id } = req.params;
        const job = await this.storage.getJob(id);

        if (!job) {
          return res.status(404).json({
            error: 'Job not found',
          });
        }

        if (job.status !== 'complete') {
          return res.status(400).json({
            error: `Job is ${job.status}, not ready for download`,
          });
        }

        const bundlePath = this.storage.getBundlePath(id);
        const bundleExists = await this.storage.bundleExists(id);

        if (!bundleExists) {
          return res.status(404).json({
            error: 'Bundle not found',
          });
        }

        // Set headers for download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="postdev-${id}.zip"`
        );

        // Stream the file
        const fileStream = await fs.readFile(bundlePath);
        res.send(fileStream);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // List jobs (admin endpoint)
    this.app.get('/api/jobs', async (req, res) => {
      try {
        const status = req.query.status as Job['status'] | undefined;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const jobs = await this.storage.listJobs({
          status,
          limit,
          offset,
        });

        res.json({
          jobs,
          total: jobs.length,
          limit,
          offset,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Delete job (admin endpoint)
    this.app.delete('/api/jobs/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const success = await this.storage.deleteJob(id);

        if (!success) {
          return res.status(404).json({
            error: 'Job not found',
          });
        }

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });
  }

  /**
   * Process a job in the background
   */
  private async processJob(jobId: string): Promise<void> {
    this.activeJobs.add(jobId);

    try {
      console.log(`\n🚀 Starting job ${jobId}`);

      const job = await this.storage.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      console.log(`📋 Figma URL: ${job.figmaUrl}`);

      // Update status to processing
      await this.storage.updateJob(jobId, {
        status: 'processing',
        progress: 0,
      });

      // Get output directory
      const outputDir = this.storage.getJobOutputDir(jobId);
      console.log(`📁 Output directory: ${outputDir}`);

      // Process the job
      console.log(`⚙️  Processing job ${jobId}...`);
      const result = await generateFromFigmaLink({
        figmaUrl: job.figmaUrl,
        outputDir,
        onProgress: async (event: ProgressEvent) => {
          console.log(`📊 [${jobId}] ${event.progress}% - ${event.message}`);
          // Update job progress
          await this.storage.updateJob(jobId, {
            progress: event.progress,
            currentPhase: event.message,
          });
        },
      });

      console.log(`✓ Job ${jobId} completed processing`);

      if (!result.success) {
        // Job failed
        console.error(`✗ Job ${jobId} failed: ${result.error}`);
        console.error(`   Phase: ${result.phase}`);
        if (result.details) {
          console.error(`   Details:`, result.details);
        }

        await this.storage.updateJob(jobId, {
          status: 'failed',
          progress: 100,
          error: result.error,
        });
        return;
      }

      // Save bundle
      const bundlePath = await this.storage.saveBundleZip(
        jobId,
        result.bundleZip
      );

      // Save screenshots if available
      const screenshots: Job['result']['screenshots'] = {};

      if (result.screenshots.figma) {
        const figmaBuffer = await fs.readFile(result.screenshots.figma);
        screenshots.figma = await this.storage.saveScreenshot(
          jobId,
          'figma',
          figmaBuffer
        );
      }

      if (result.screenshots.generated) {
        const generatedBuffer = await fs.readFile(result.screenshots.generated);
        screenshots.generated = await this.storage.saveScreenshot(
          jobId,
          'generated',
          generatedBuffer
        );
      }

      if (result.screenshots.diff) {
        const diffBuffer = await fs.readFile(result.screenshots.diff);
        screenshots.diff = await this.storage.saveScreenshot(
          jobId,
          'diff',
          diffBuffer
        );
      }

      // Update job with success result
      await this.storage.updateJob(jobId, {
        status: 'complete',
        progress: 100,
        result: {
          bundlePath,
          screenshots,
          metadata: {
            buildStatus: result.metadata.buildStatus,
            visualScore: result.metadata.visualScore,
            processingTime: result.metadata.processingTime,
            fileCount: result.files.count,
          },
          warnings: result.warnings,
          manualReviewRequired: result.manualReviewRequired,
        },
      });

      console.log(`✓ Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`\n❌ Job ${jobId} EXCEPTION caught:`);
      console.error(`   Error:`, error);

      if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        console.error(`   Stack:`, error.stack);
      }

      await this.storage.updateJob(jobId, {
        status: 'failed',
        progress: 100,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.activeJobs.delete(jobId);
      console.log(`🏁 Job ${jobId} finished (removed from active jobs)\n`);
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Initialize storage
    await this.storage.initialize();

    // Start Express server
    return new Promise((resolve) => {
      this.app.listen(this.config.port, this.config.host, () => {
        console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║      POSTDEV Backend Server Running       ║
║                                           ║
╚═══════════════════════════════════════════╝

  🚀 Server:  http://${this.config.host}:${this.config.port}
  📊 Health:  http://${this.config.host}:${this.config.port}/api/health
  📝 Jobs:    http://${this.config.host}:${this.config.port}/api/jobs

  Press Ctrl+C to stop
        `);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Gracefully shut down
    console.log('\nShutting down server...');

    // Wait for active jobs to finish (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < timeout) {
      console.log(`Waiting for ${this.activeJobs.size} active jobs to finish...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      console.warn(`${this.activeJobs.size} jobs still active, forcing shutdown`);
    }

    console.log('Server stopped');
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}

/**
 * Start server from CLI
 */
const server = new PostDevServer({
  port: parseInt(process.env.PORT || '3001'),
});

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => server.stop());
process.on('SIGINT', () => server.stop());
