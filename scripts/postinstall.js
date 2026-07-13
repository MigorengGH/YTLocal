const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// __dirname is /YTLocal/scripts, so go up one level to get project root
const rootDir = path.join(__dirname, '..');
const destDir = path.join(rootDir, 'bin');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Copy yt-dlp binary
const ytDlpName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpSrc = path.join(rootDir, 'node_modules', 'youtube-dl-exec', 'bin', ytDlpName);
const ytDlpDest = path.join(destDir, ytDlpName);

if (fs.existsSync(ytDlpSrc)) {
    fs.copyFileSync(ytDlpSrc, ytDlpDest);
    fs.chmodSync(ytDlpDest, 0o755);
    console.log(`✅ yt-dlp binary copied to bin/${ytDlpName}`);
} else {
    console.warn(`⚠️  yt-dlp binary not found at ${ytDlpSrc}`);
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

// Also download yt-dlp.exe for Windows cross-compilation (if on macOS and not present)
const winYtDlp = path.join(destDir, 'yt-dlp.exe');
if (!fs.existsSync(winYtDlp) && process.platform !== 'win32') {
    console.log('📥 Downloading yt-dlp.exe for Windows cross-compilation...');
    try {
        execSync(
            `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${winYtDlp}"`,
            { stdio: 'inherit' }
        );
        console.log('✅ yt-dlp.exe downloaded to bin/');
    } catch (e) {
        console.warn('⚠️  Could not download yt-dlp.exe:', e.message);
    }
}
