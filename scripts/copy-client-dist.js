const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'client', 'dist');
const destDir = path.join(rootDir, 'dist');

if (!fs.existsSync(srcDir)) {
  console.error(`Client build output not found at ${srcDir}`);
  process.exit(1);
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });
console.log(`Copied client build to ${destDir}`);
