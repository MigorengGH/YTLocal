const fs = require('fs');
const path = require('path');

// __dirname is /YTLocal/scripts, so go up one level to get project root
const rootDir = path.join(__dirname, '..');
const srcBinary = path.join(rootDir, 'node_modules', 'youtube-dl-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const destDir = path.join(rootDir, 'bin');
const destBinary = path.join(destDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcBinary)) {
    fs.copyFileSync(srcBinary, destBinary);
    fs.chmodSync(destBinary, 0o755);
    console.log(`✅ yt-dlp binary copied to bin/`);
} else {
    console.warn(`⚠️  yt-dlp binary not found at ${srcBinary}`);
}
