/**
 * Fetch Company Tickers from SEC
 * 
 * Downloads the latest company tickers and exchange data from SEC EDGAR.
 * Supports both local file storage and Cloudflare R2 object storage.
 * 
 * Usage:
 *   bun src/data_source/sec/scripts/fetch-company-tickers.ts
 *   bun src/data_source/sec/scripts/fetch-company-tickers.ts --storage=r2
 *   bun src/data_source/sec/scripts/fetch-company-tickers.ts --storage=local --output-dir=./custom-output
 */

import { createLogger } from '../../../utils/logger';
import { secClient } from '../../../integrations/sec';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger('sec/fetch-company-tickers');

const TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';

interface CompanyTickerData {
  fields: string[];
  data: Array<[number, string, string, string]>; // [cik, name, ticker, exchange]
}

interface FetchOptions {
  storage: 'local' | 'r2';
  outputDir?: string;
  r2Bucket?: string;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
}

/**
 * Fetch company tickers from SEC
 */
async function fetchCompanyTickers(): Promise<CompanyTickerData> {
  logger.info(`Fetching company tickers from ${TICKERS_URL}...`);
  
  try {
    const data = await secClient.getJSON<CompanyTickerData>(TICKERS_URL);
    logger.info(`Successfully fetched ${data.data.length.toLocaleString()} companies`);
    
    return data;
  } catch (error) {
    logger.error('Failed to fetch company tickers:', { error });
    throw error;
  }
}

/**
 * Save data to local file system
 */
async function saveToLocal(data: CompanyTickerData, outputDir: string): Promise<void> {
  const outputPath = path.resolve(outputDir);
  await fs.mkdir(outputPath, { recursive: true });
  
  const timestamp = new Date().toISOString().split('T')[0];
  const jsonFile = path.join(outputPath, `company_tickers_${timestamp}.json`);
  const csvFile = path.join(outputPath, `company_tickers_${timestamp}.csv`);
  
  // Save JSON
  await fs.writeFile(jsonFile, JSON.stringify(data, null, 2), 'utf-8');
  logger.info(`Saved JSON to ${jsonFile}`);
  
  // Convert to CSV
  const csvLines = [
    data.fields.join(','),
    ...data.data.map(row => row.map(cell => `"${cell}"`).join(','))
  ];
  await fs.writeFile(csvFile, csvLines.join('\n'), 'utf-8');
  logger.info(`Saved CSV to ${csvFile}`);
  
  // Also save as "latest" for easy access
  const latestJsonFile = path.join(outputPath, 'company_tickers_latest.json');
  const latestCsvFile = path.join(outputPath, 'company_tickers_latest.csv');
  await fs.writeFile(latestJsonFile, JSON.stringify(data, null, 2), 'utf-8');
  await fs.writeFile(latestCsvFile, csvLines.join('\n'), 'utf-8');
  logger.info('Saved latest versions');
}

/**
 * Save data to Cloudflare R2
 */
async function saveToR2(data: CompanyTickerData, options: FetchOptions): Promise<void> {
  const { r2Bucket, r2AccountId, r2AccessKeyId, r2SecretAccessKey } = options;
  
  if (!r2Bucket || !r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    throw new Error('Missing R2 credentials. Required: R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  }
  
  logger.info(`Uploading to R2 bucket: ${r2Bucket}...`);
  
  // R2 is S3-compatible, so we can use the AWS SDK
  // For now, we'll use fetch with S3-compatible API
  const timestamp = new Date().toISOString().split('T')[0];
  const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
  
  // Convert to CSV
  const csvLines = [
    data.fields.join(','),
    ...data.data.map(row => row.map(cell => `"${cell}"`).join(','))
  ];
  const csvContent = csvLines.join('\n');
  
  // Upload JSON
  const jsonKey = `sec/company_tickers/${timestamp}/company_tickers.json`;
  await uploadToR2(
    endpoint,
    r2Bucket,
    jsonKey,
    JSON.stringify(data, null, 2),
    'application/json',
    r2AccessKeyId,
    r2SecretAccessKey
  );
  logger.info(`Uploaded JSON to R2: ${jsonKey}`);
  
  // Upload CSV
  const csvKey = `sec/company_tickers/${timestamp}/company_tickers.csv`;
  await uploadToR2(
    endpoint,
    r2Bucket,
    csvKey,
    csvContent,
    'text/csv',
    r2AccessKeyId,
    r2SecretAccessKey
  );
  logger.info(`Uploaded CSV to R2: ${csvKey}`);
  
  // Upload as "latest" for easy access
  const latestJsonKey = 'sec/company_tickers/latest/company_tickers.json';
  const latestCsvKey = 'sec/company_tickers/latest/company_tickers.csv';
  await uploadToR2(endpoint, r2Bucket, latestJsonKey, JSON.stringify(data, null, 2), 'application/json', r2AccessKeyId, r2SecretAccessKey);
  await uploadToR2(endpoint, r2Bucket, latestCsvKey, csvContent, 'text/csv', r2AccessKeyId, r2SecretAccessKey);
  logger.info('Uploaded latest versions to R2');
}

/**
 * Upload file to R2 using AWS S3 SDK
 */
async function uploadToR2(
  endpoint: string,
  bucket: string,
  key: string,
  content: string,
  contentType: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<void> {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    }));
    
    logger.info(`Successfully uploaded to R2: ${bucket}/${key}`);
  } catch (error) {
    logger.error(`Failed to upload to R2: ${bucket}/${key}`, { error });
    throw error;
  }
}

/**
 * Main execution function
 */
export async function fetchAndStoreCompanyTickers(options: Partial<FetchOptions> = {}): Promise<{
  success: boolean;
  recordCount: number;
  storage: string;
  location: string;
}> {
  const opts: FetchOptions = {
    storage: options.storage || 'local',
    outputDir: options.outputDir || path.join(__dirname, '../output'),
    r2Bucket: options.r2Bucket || process.env.R2_BUCKET,
    r2AccountId: options.r2AccountId || process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: options.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: options.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY,
  };
  
  try {
    // Fetch data
    const data = await fetchCompanyTickers();
    
    // Store data
    if (opts.storage === 'r2') {
      await saveToR2(data, opts);
      return {
        success: true,
        recordCount: data.data.length,
        storage: 'r2',
        location: `${opts.r2Bucket}/sec/company_tickers/latest/`,
      };
    } else {
      await saveToLocal(data, opts.outputDir!);
      return {
        success: true,
        recordCount: data.data.length,
        storage: 'local',
        location: opts.outputDir!,
      };
    }
  } catch (error) {
    logger.error('Failed to fetch and store company tickers:', { error });
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const storage = args.find(arg => arg.startsWith('--storage='))?.split('=')[1] as 'local' | 'r2' || 'local';
  const outputDir = args.find(arg => arg.startsWith('--output-dir='))?.split('=')[1];
  
  fetchAndStoreCompanyTickers({ storage, outputDir })
    .then(result => {
      logger.info('Fetch completed successfully:', result);
      process.exit(0);
    })
    .catch(error => {
      logger.error('Fetch failed:', error);
      process.exit(1);
    });
}
