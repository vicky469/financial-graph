#!/usr/bin/env node

/**
 * Sync versions from shared/versions.json to frontend and backend package.json files
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const VERSIONS_FILE = path.join(ROOT_DIR, 'shared', 'versions.json');
const FRONTEND_PACKAGE = path.join(ROOT_DIR, 'frontend', 'package.json');
const BACKEND_PACKAGE = path.join(ROOT_DIR, 'backend', 'package.json');
const SHARED_PACKAGE = path.join(ROOT_DIR, 'shared', 'package.json');

const versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));

function updatePackageJson(packagePath, projectName) {
  if (!fs.existsSync(packagePath)) return;

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  let updated = false;

  if (pkg.version !== versions.app.version) {
    pkg.version = versions.app.version;
    updated = true;
  }

  if (JSON.stringify(pkg.engines) !== JSON.stringify(versions.engines)) {
    pkg.engines = versions.engines;
    updated = true;
  }

  ['dependencies', 'devDependencies'].forEach(depType => {
    if (!pkg[depType]) return;
    Object.keys(versions[depType] || {}).forEach(dep => {
      if (pkg[depType][dep] && pkg[depType][dep] !== versions[depType][dep]) {
        pkg[depType][dep] = versions[depType][dep];
        updated = true;
      }
    });
  });

  if (updated) {
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`✓ Synced ${projectName}`);
  }
}

updatePackageJson(FRONTEND_PACKAGE, 'Frontend');
updatePackageJson(BACKEND_PACKAGE, 'Backend');
updatePackageJson(SHARED_PACKAGE, 'Shared');
