const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // Only copy non-typescript assets
    const ext = path.extname(src);
    if (ext !== '.ts' && ext !== '.tsx') {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
      console.log(`Copied asset: ${src} -> ${dest}`);
    }
  }
}

const nodesSrc = path.join(__dirname, '..', 'nodes');
const nodesDest = path.join(__dirname, '..', 'dist', 'nodes');

copyRecursive(nodesSrc, nodesDest);
console.log('Asset copy finished successfully.');
