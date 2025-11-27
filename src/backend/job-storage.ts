/**
 * File-based Job Storage System
 * Simple persistence layer for POSTDEV jobs (v0)
 * Can be migrated to database later
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'complete'
  | 'failed';

export interface Job {
  id: string;
  figmaUrl: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number; // 0-100
  currentPhase?: string;
  error?: string;
  result?: {
    bundlePath?: string;
    screenshots?: {
      figma?: string;
      generated?: string;
      diff?: string;
    };
    metadata?: {
      buildStatus: string;
      visualScore: number;
      processingTime: number;
      fileCount: number;
    };
    warnings?: string[];
    manualReviewRequired?: string[];
  };
}

export interface CreateJobOptions {
  figmaUrl: string;
}

export interface UpdateJobOptions {
  status?: JobStatus;
  progress?: number;
  currentPhase?: string;
  error?: string;
  result?: Job['result'];
}

export class JobStorage {
  private jobsDir: string;
  private maxJobs: number;

  constructor(options?: { jobsDir?: string; maxJobs?: number }) {
    this.jobsDir = options?.jobsDir || path.join(process.cwd(), 'jobs');
    this.maxJobs = options?.maxJobs || 100; // Keep last 100 jobs
  }

  /**
   * Initialize storage (create directories)
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.jobsDir, { recursive: true });
  }

  /**
   * Create a new job
   */
  async createJob(options: CreateJobOptions): Promise<Job> {
    const id = this.generateJobId();
    const now = new Date().toISOString();

    const job: Job = {
      id,
      figmaUrl: options.figmaUrl,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      progress: 0,
    };

    // Create job directory
    const jobDir = this.getJobDir(id);
    await fs.mkdir(jobDir, { recursive: true });

    // Save job metadata
    await this.saveJob(job);

    return job;
  }

  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<Job | null> {
    try {
      const metadataPath = this.getMetadataPath(id);
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as Job;
    } catch {
      return null;
    }
  }

  /**
   * Update a job
   */
  async updateJob(id: string, updates: UpdateJobOptions): Promise<Job | null> {
    const job = await this.getJob(id);
    if (!job) return null;

    const now = new Date().toISOString();
    const updatedJob: Job = {
      ...job,
      ...updates,
      updatedAt: now,
    };

    // Update timestamps based on status changes
    if (updates.status === 'processing' && !job.startedAt) {
      updatedJob.startedAt = now;
    }

    if ((updates.status === 'complete' || updates.status === 'failed') && !job.completedAt) {
      updatedJob.completedAt = now;
    }

    await this.saveJob(updatedJob);
    return updatedJob;
  }

  /**
   * List all jobs
   */
  async listJobs(options?: {
    status?: JobStatus;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> {
    try {
      const dirs = await fs.readdir(this.jobsDir);
      const jobs: Job[] = [];

      for (const dir of dirs) {
        const metadataPath = path.join(this.jobsDir, dir, 'metadata.json');
        try {
          const content = await fs.readFile(metadataPath, 'utf-8');
          const job = JSON.parse(content) as Job;

          // Filter by status if provided
          if (options?.status && job.status !== options.status) {
            continue;
          }

          jobs.push(job);
        } catch {
          // Skip invalid jobs
        }
      }

      // Sort by createdAt (newest first)
      jobs.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply pagination
      const offset = options?.offset || 0;
      const limit = options?.limit || 50;
      return jobs.slice(offset, offset + limit);
    } catch {
      return [];
    }
  }

  /**
   * Delete a job and all its files
   */
  async deleteJob(id: string): Promise<boolean> {
    try {
      const jobDir = this.getJobDir(id);
      await fs.rm(jobDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old jobs (keep only maxJobs most recent)
   */
  async cleanup(): Promise<number> {
    const jobs = await this.listJobs();

    if (jobs.length <= this.maxJobs) {
      return 0;
    }

    const jobsToDelete = jobs.slice(this.maxJobs);
    let deletedCount = 0;

    for (const job of jobsToDelete) {
      const success = await this.deleteJob(job.id);
      if (success) deletedCount++;
    }

    return deletedCount;
  }

  /**
   * Save bundle zip to job directory
   */
  async saveBundleZip(jobId: string, bundleZip: Buffer): Promise<string> {
    const bundlePath = path.join(this.getJobDir(jobId), 'bundle.zip');
    await fs.writeFile(bundlePath, bundleZip);
    return bundlePath;
  }

  /**
   * Save screenshot to job directory
   */
  async saveScreenshot(
    jobId: string,
    type: 'figma' | 'generated' | 'diff',
    imageBuffer: Buffer
  ): Promise<string> {
    const screenshotPath = path.join(
      this.getJobDir(jobId),
      `screenshot-${type}.png`
    );
    await fs.writeFile(screenshotPath, imageBuffer);
    return screenshotPath;
  }

  /**
   * Get bundle zip path
   */
  getBundlePath(jobId: string): string {
    return path.join(this.getJobDir(jobId), 'bundle.zip');
  }

  /**
   * Check if bundle exists
   */
  async bundleExists(jobId: string): Promise<boolean> {
    try {
      await fs.access(this.getBundlePath(jobId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get job output directory
   */
  getJobOutputDir(jobId: string): string {
    return path.join(this.getJobDir(jobId), 'output');
  }

  /**
   * Private helpers
   */

  private async saveJob(job: Job): Promise<void> {
    const metadataPath = this.getMetadataPath(job.id);
    await fs.writeFile(metadataPath, JSON.stringify(job, null, 2));
  }

  private getJobDir(id: string): string {
    return path.join(this.jobsDir, id);
  }

  private getMetadataPath(id: string): string {
    return path.join(this.getJobDir(id), 'metadata.json');
  }

  private generateJobId(): string {
    // Generate short, URL-safe ID (12 chars)
    return crypto.randomBytes(9).toString('base64url').substring(0, 12);
  }
}

/**
 * Singleton instance for easy import
 */
export const jobStorage = new JobStorage();
