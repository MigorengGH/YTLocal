const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// __dirname is /YTLocal/scripts, go up one level to project root
const rootDir = path.join(__dirname, '..');
const destDir = path.join(rootDir, 'bin');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Download self-contained yt-dlp binaries directly from GitHub releases
// These are fully bundled with Python — no system dependencies needed
const downloads = [];

if (process.platform !== 'win32') {
    // macOS/Linux: download yt-dlp_macos (self-contained, no Python required)
    downloads.push({
        url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
        dest: path.join(destDir, 'yt-dlp'),
        label: 'yt-dlp (macOS self-contained)'
    });
}

// Always include yt-dlp.exe for Windows cross-compilation
downloads.push({
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    dest: path.join(destDir, 'yt-dlp.exe'),
    label: 'yt-dlp.exe (Windows)'
});

for (const { url, dest, label } of downloads) {
    if (fs.existsSync(dest)) {
        console.log(`✅ ${label} already exists, skipping download`);
        continue;
    }
    console.log(`📥 Downloading ${label}...`);
    try {
        execSync(`curl -L "${url}" -o "${dest}"`, { stdio: 'inherit' });
        fs.chmodSync(dest, 0o755);
        console.log(`✅ ${label} ready`);
    } catch (e) {
        console.warn(`⚠️  Failed to download ${label}:`, e.message);
    }
}

// Copy ffmpeg binary from ffmpeg-static
try {
    const ffmpegStaticPath = require('ffmpeg-static');
    const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffmpegDest = path.join(destDir, ffmpegName);
    fs.copyFileSync(ffmpegStaticPath, ffmpegDest);
    fs.chmodSync(ffmpegDest, 0o755);
    console.log(`✅ ffmpeg binary copied to bin/${ffmpegName}`);
} catch (e) {
    console.warn('⚠️  Could not copy ffmpeg:', e.message);
}
