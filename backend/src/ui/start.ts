#!/usr/bin/env node

/**
 * Start the Job Configuration UI Server
 */

import { config } from 'dotenv';
import { startDirectUIServer } from './server';
import { createLogger } from '../utils/logger';

// Load environment variables from .env file
config();

const logger = createLogger('ui/start');

async function main() {
  try {
    logger.info('Starting Job Configuration UI...');
    
    // Rebuild UI in dev mode
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Building UI...');
      const { spawnSync } = await import('child_process');
      const result = spawnSync('bun', ['run', 'build:ui'], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        throw new Error('UI build failed');
      }
      logger.info('UI build complete');
    }
    
    logger.info(`Using InstantDB App ID: ${process.env.INSTANT_APP_ID}`);
    logger.info('Secure API backend with server-side validation and admin client');
    await startDirectUIServer();
    logger.info('Job Configuration UI started successfully');
  } catch (error) {
    logger.error('Failed to start Job Configuration UI:', error);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});