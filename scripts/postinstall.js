const fs = require('fs');
const path = require('path');

const srcBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const destDir = path.join(__dirname, 'bin');
const destBinary = path.join(destDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcBinary)) {
    fs.copyFileSync(srcBinary, destBinary);
    fs.chmodSync(destBinary, 0o755);
    console.log(`✅ yt-dlp binary copied to bin/`);
} else {
    console.warn(`⚠️  yt-dlp binary not found at ${srcBinary}. Run: npx youtube-dl-exec`);
}
