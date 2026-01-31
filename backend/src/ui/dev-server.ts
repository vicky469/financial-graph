#!/usr/bin/env bun
/**
 * Development server with UI hot reload
 * Runs both UI build watcher and server in parallel
 */

import { spawn } from 'child_process';
import { createLogger } from '../utils/logger';

const logger = createLogger('ui/dev-server');

// ANSI color codes
const colors = {
  ui: '\x1b[36m',    // Cyan for UI
  server: '\x1b[32m', // Green for server
  reset: '\x1b[0m',
};

function prefixLines(data: string, prefix: string, color: string): string {
  return data
    .split('\n')
    .filter(line => line.trim())
    .map(line => `${color}[${prefix}]${colors.reset} ${line}`)
    .join('\n');
}

async function main() {
  logger.info('Starting development server with UI hot reload...');

  // Build shared package first
  logger.info('Building shared package...');
  const sharedBuild = spawn('bun', ['run', 'build'], {
    cwd: '../shared',
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    sharedBuild.on('close', (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`Shared build failed with code ${code}`));
    });
  });

  logger.info('Shared package built successfully');

  // Start UI build watcher
  logger.info('Starting UI build watcher...');
  const uiWatcher = spawn('bun', ['run', 'build:ui:watch'], {
    cwd: process.cwd(),
  });

  uiWatcher.stdout?.on('data', (data) => {
    console.log(prefixLines(data.toString(), 'UI', colors.ui));
  });

  uiWatcher.stderr?.on('data', (data) => {
    console.error(prefixLines(data.toString(), 'UI', colors.ui));
  });

  uiWatcher.on('close', (code) => {
    if (code !== 0 && code !== null) {
      logger.error(`UI watcher exited with code ${code}`);
    }
  });

  // Wait a moment for initial UI build
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start the server with watch mode
  logger.info('Starting server...');
  const server = spawn('bun', ['--watch', 'src/ui/start.ts'], {
    cwd: process.cwd(),
  });

  server.stdout?.on('data', (data) => {
    console.log(prefixLines(data.toString(), 'SRV', colors.server));
  });

  server.stderr?.on('data', (data) => {
    console.error(prefixLines(data.toString(), 'SRV', colors.server));
  });

  server.on('close', (code) => {
    if (code !== 0 && code !== null) {
      logger.error(`Server exited with code ${code}`);
    }
  });

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    uiWatcher.kill('SIGTERM');
    server.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Development server ready! Press Ctrl+C to stop');
}

main().catch((error) => {
  logger.error('Failed to start development server:', error);
  process.exit(1);
});
