/**
 * Figma API Client
 * Handles all communication with the Figma REST API
 */

import axios, { AxiosInstance } from 'axios';
import type {
  FigmaFile,
  FigmaNodesResponse,
  FigmaImageResponse,
  FigmaNode,
} from '../types/figma.js';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export interface FigmaClientConfig {
  accessToken: string;
  timeout?: number;
}

export class FigmaClient {
  private client: AxiosInstance;

  constructor(config: FigmaClientConfig) {
    this.client = axios.create({
      baseURL: FIGMA_API_BASE,
      timeout: config.timeout || 30000,
      headers: {
        'X-Figma-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Extract file key from Figma URL
   */
  static extractFileKey(urlOrKey: string): string {
    // If it's already a key (no slashes), return as-is
    if (!urlOrKey.includes('/')) {
      return urlOrKey;
    }

    // Extract from URL patterns like:
    // https://www.figma.com/file/ABC123/FileName
    // https://www.figma.com/design/ABC123/FileName
    const patterns = [
      /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
      /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)\/[^?#]+/,
    ];

    for (const pattern of patterns) {
      const match = urlOrKey.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    throw new Error(`Invalid Figma URL or file key: ${urlOrKey}`);
  }

  /**
   * Extract node ID from Figma URL
   */
  static extractNodeId(url: string): string | undefined {
    // Extract node-id from URL query params
    const match = url.match(/node-id=([^&]+)/);
    if (match?.[1]) {
      // URL decode and convert URL format (e.g., "1-2") to Figma format (e.g., "1:2")
      return decodeURIComponent(match[1]).replace('-', ':');
    }
    return undefined;
  }

  /**
   * Get the full Figma file
   */
  async getFile(fileKey: string, depth?: number): Promise<FigmaFile> {
    const params: Record<string, string | number> = {};
    if (depth !== undefined) {
      params.depth = depth;
    }

    const response = await this.client.get<FigmaFile>(`/files/${fileKey}`, { params });
    return response.data;
  }

  /**
   * Get specific nodes from a Figma file
   */
  async getNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodesResponse> {
    const response = await this.client.get<FigmaNodesResponse>(`/files/${fileKey}/nodes`, {
      params: {
        ids: nodeIds.join(','),
      },
    });
    return response.data;
  }

  /**
   * Get a single node from a Figma file
   */
  async getNode(fileKey: string, nodeId: string): Promise<FigmaNode | null> {
    const response = await this.getNodes(fileKey, [nodeId]);
    const nodeData = response.nodes[nodeId];
    return nodeData?.document || null;
  }

  /**
   * Get images for specific nodes
   */
  async getImages(
    fileKey: string,
    nodeIds: string[],
    options?: {
      scale?: number;
      format?: 'jpg' | 'png' | 'svg' | 'pdf';
    }
  ): Promise<FigmaImageResponse> {
    const response = await this.client.get<FigmaImageResponse>(`/images/${fileKey}`, {
      params: {
        ids: nodeIds.join(','),
        scale: options?.scale || 2,
        format: options?.format || 'png',
      },
    });
    return response.data;
  }

  /**
   * Get a single image URL for a node
   */
  async getImageUrl(
    fileKey: string,
    nodeId: string,
    options?: {
      scale?: number;
      format?: 'jpg' | 'png' | 'svg' | 'pdf';
    }
  ): Promise<string | null> {
    const response = await this.getImages(fileKey, [nodeId], options);
    return response.images[nodeId] || null;
  }

  /**
   * Download image from URL
   */
  async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  /**
   * Get file components
   */
  async getComponents(fileKey: string): Promise<FigmaFile['components']> {
    const file = await this.getFile(fileKey, 1);
    return file.components;
  }

  /**
   * Get file styles
   */
  async getStyles(fileKey: string): Promise<FigmaFile['styles']> {
    const file = await this.getFile(fileKey, 1);
    return file.styles;
  }

  /**
   * Test connection with the API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/me');
      return true;
    } catch {
      return false;
    }
  }
}
