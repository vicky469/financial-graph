/**
 * Cloudflare R2 Storage Utility
 * 
 * Provides S3-compatible storage operations for Cloudflare R2.
 * R2 is Cloudflare's object storage service with zero egress fees.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from './logger';

const logger = createLogger('utils/r2-storage');

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface UploadOptions {
  key: string;
  body: string | Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface DownloadOptions {
  key: string;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
}

/**
 * R2 Storage Client
 */
export class R2Storage {
  private client: S3Client;
  private bucket: string;

  constructor(config: R2Config) {
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    
    this.bucket = config.bucket;
    logger.info(`Initialized R2 storage client for bucket: ${this.bucket}`);
  }

  /**
   * Upload a file to R2
   */
  async upload(options: UploadOptions): Promise<{ success: boolean; url: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata,
      });

      await this.client.send(command);
      
      const url = `https://${this.bucket}/${options.key}`;
      logger.info(`Uploaded to R2: ${options.key}`);
      
      return { success: true, url };
    } catch (error) {
      logger.error(`Failed to upload to R2: ${options.key}`, error);
      throw error;
    }
  }

  /**
   * Download a file from R2
   */
  async download(options: DownloadOptions): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No body in response');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      logger.info(`Downloaded from R2: ${options.key} (${buffer.length} bytes)`);
      
      return buffer;
    } catch (error) {
      logger.error(`Failed to download from R2: ${options.key}`, error);
      throw error;
    }
  }

  /**
   * List files in R2
   */
  async list(options: ListOptions = {}): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: options.prefix,
        MaxKeys: options.maxKeys || 1000,
      });

      const response = await this.client.send(command);
      
      const files = (response.Contents || []).map(item => ({
        key: item.Key!,
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
      }));
      
      logger.info(`Listed ${files.length} files from R2 with prefix: ${options.prefix || '(none)'}`);
      
      return files;
    } catch (error) {
      logger.error(`Failed to list files from R2`, error);
      throw error;
    }
  }

  /**
   * Delete a file from R2
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      logger.info(`Deleted from R2: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete from R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get public URL for a file (if bucket has public access configured)
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucket}/${key}`;
  }

  /**
   * List all buckets in R2 account
   */
  async listBuckets(): Promise<Array<{ name: string; creationDate: Date }>> {
    try {
      const { ListBucketsCommand } = await import('@aws-sdk/client-s3');
      const command = new ListBucketsCommand({});
      const response = await this.client.send(command);
      
      const buckets = (response.Buckets || []).map(bucket => ({
        name: bucket.Name!,
        creationDate: bucket.CreationDate || new Date(),
      }));
      
      logger.info(`Listed ${buckets.length} R2 buckets`);
      return buckets;
    } catch (error) {
      logger.error('Failed to list R2 buckets', error);
      throw error;
    }
  }
}

/**
 * Create R2 storage client from environment variables
 * @param bucket - Optional bucket name. If not provided, uses R2_BUCKET from env or 'financial-graph-data'
 */
export function createR2Client(bucket?: string): R2Storage {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const defaultBucket = bucket || process.env.R2_BUCKET || 'financial-graph-data';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env');
  }

  return new R2Storage({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket: defaultBucket,
  });
}

/**
 * Helper to generate a key path within a bucket for job outputs
 * The bucket name itself comes from the job's destination.location field
 */
export function generateJobOutputKey(jobId: string, executionId: string, filename: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `jobs/${jobId}/executions/${executionId}/${timestamp}/${filename}`;
}

/**
 * Parse bucket name and key from a location string
 * Supports formats:
 * - "bucket-name" (just bucket, key will be generated)
 * - "bucket-name/path/to/file" (bucket + custom path)
 */
export function parseR2Location(location: string): { bucket: string; keyPrefix?: string } {
  const parts = location.split('/');
  const bucket = parts[0];
  const keyPrefix = parts.slice(1).join('/');
  
  return {
    bucket,
    keyPrefix: keyPrefix || undefined,
  };
}
