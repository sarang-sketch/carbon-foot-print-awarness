/**
 * @fileoverview Repository size checker.
 * Ensures the project stays under the 10 MB submission limit.
 *
 * Usage: node scripts/check-size.mjs
 *
 * @module scripts/check-size
 * @license MIT
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const IGNORE = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);

/**
 * Recursively calculate directory size in bytes.
 * @param {string} dirPath - Directory to measure.
 * @returns {number} Total size in bytes.
 */
function getDirectorySize(dirPath) {
  let total = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        total += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          total += stat.size;
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return total;
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Run check
const totalBytes = getDirectorySize(ROOT);
const percentage = ((totalBytes / MAX_BYTES) * 100).toFixed(1);
const passed = totalBytes < MAX_BYTES;

console.log('\n📏 Repository Size Check');
console.log('─'.repeat(40));
console.log(`   Size:    ${formatBytes(totalBytes)}`);
console.log(`   Limit:   ${formatBytes(MAX_BYTES)}`);
console.log(`   Usage:   ${percentage}%`);
console.log(`   Status:  ${passed ? '✅ PASS' : '❌ FAIL — over limit!'}`);
console.log('');

if (!passed) {
  process.exit(1);
}
