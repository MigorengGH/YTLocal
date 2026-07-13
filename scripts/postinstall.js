const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// __dirname is /YTLocal/scripts, so go up one level to get project root
const rootDir = path.join(__dirname, '..');
const destDir = path.join(rootDir, 'bin');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Copy the platform-appropriate binary from youtube-dl-exec
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const srcBinary = path.join(rootDir, 'node_modules', 'youtube-dl-exec', 'bin', binaryName);
const destBinary = path.join(destDir, binaryName);

if (fs.existsSync(srcBinary)) {
    fs.copyFileSync(srcBinary, destBinary);
    fs.chmodSync(destBinary, 0o755);
    console.log(`✅ yt-dlp binary copied to bin/${binaryName}`);
} else {
    console.warn(`⚠️  yt-dlp binary not found at ${srcBinary}`);
}

// Also download yt-dlp.exe for Windows cross-compilation (if not already present)
const winBinary = path.join(destDir, 'yt-dlp.exe');
if (!fs.existsSync(winBinary) && process.platform !== 'win32') {
    console.log('📥 Downloading yt-dlp.exe for Windows cross-compilation...');
    try {
        execSync(
            `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${winBinary}"`,
            { stdio: 'inherit' }
        );
        console.log('✅ yt-dlp.exe downloaded to bin/');
    } catch (e) {
        console.warn('⚠️  Could not download yt-dlp.exe:', e.message);
    }
}
