#!/usr/bin/env node

/**
 * Install git hooks for automatic version syncing
 */

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', '.git', 'hooks');
const PRE_COMMIT_HOOK = path.join(HOOKS_DIR, 'pre-commit');

const preCommitScript = `#!/bin/sh
# Auto-sync versions before commit

echo "🔄 Syncing versions..."
npm run sync-versions --silent

# Add any changed package.json files
git add */package.json 2>/dev/null || true

echo "✅ Versions synced"
`;

// Check if .git directory exists
if (!fs.existsSync(HOOKS_DIR)) {
  console.log('⚠️  .git/hooks directory not found. Skipping hook installation.');
  console.log('   (This is normal if you\'re not in a git repository)');
  process.exit(0);
}

// Write pre-commit hook
fs.writeFileSync(PRE_COMMIT_HOOK, preCommitScript, { mode: 0o755 });
console.log('✅ Installed git pre-commit hook for automatic version syncing');
