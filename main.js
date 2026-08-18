const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn, execFileSync, exec, execFile } = require('child_process');
const ffmpegStaticPath = require('ffmpeg-static');

// Resolve yt-dlp binary:
// - Packaged: bundled in Resources/bin/
// - Dev: node_modules/youtube-dl-exec/bin/
function getYtDlpPath() {
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'bin', binaryName);
    }
    return path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', binaryName);
}

// Resolve ffmpeg binary:
// - Packaged: bundled in Resources/bin/
// - Dev: from ffmpeg-static package
function getFfmpegPath() {
    const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'bin', binaryName);
    }
    return ffmpegStaticPath;
}

// Ensure binaries have execute permissions AND are not quarantined by macOS
function ensureBinaryPermissions() {
    if (process.platform === 'win32') return;
    try {
        const binDir = path.join(process.resourcesPath, 'bin');
        if (fs.existsSync(binDir)) {
            const files = fs.readdirSync(binDir);
            files.forEach(file => {
                const filePath = path.join(binDir, file);
                // Fix execute permissions
                fs.chmodSync(filePath, 0o755);
                // Remove macOS quarantine attribute (silently ignore errors)
                try {
                    const { execFileSync } = require('child_process');
                    execFileSync('xattr', ['-rd', 'com.apple.quarantine', filePath]);
                } catch (e) { /* quarantine attribute may not exist, ignore */ }
            });
            console.log('✅ Binary permissions and quarantine fixed');
        }
    } catch (e) {
        console.error('Could not set binary permissions:', e.message);
    }
}

let mainWindow;
let currentDownloadProcess = null;
let currentDownloadFiles = [];
let lockedContentWidth = null;
function createWindow() {
    lockedContentWidth = null;
    const isMac = process.platform === 'darwin';
    mainWindow = new BrowserWindow({
        width: 380,
        height: 640,
        minWidth: 340,
        minHeight: 520,
        resizable: true,
        frame: isMac,
        titleBarStyle: isMac ? 'hidden' : 'default',
        icon: path.join(__dirname, 'YTlocal.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
    if (process.platform === 'darwin') {
        const image = nativeImage.createFromPath(path.join(__dirname, 'YTlocal.png'));
        app.dock.setIcon(image);
    }

    // Fix binary permissions on startup (important for packaged app)
    if (app.isPackaged) {
        ensureBinaryPermissions();
    }

    createWindow();



    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

const https = require('https');
const http = require('http');

// Clean and normalize URLs (e.g. stripping tracking/hydration parameters from TikTok/Instagram)
function cleanMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    let urlStr = rawUrl.trim();
    try {
        const u = new URL(urlStr);
        if (/(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|instagram\.com|instagr\.am)/i.test(u.hostname)) {
            u.search = '';
            u.hash = '';
            return u.toString();
        }
    } catch (_) {}
    return urlStr;
}

function formatTimeSlice(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const s = timeStr.trim();
    if (!s) return null;
    const parts = s.split(':').map(p => p.trim());
    if (parts.length === 1) {
        const secs = parseInt(parts[0], 10);
        if (isNaN(secs)) return null;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const sc = secs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
    } else if (parts.length === 2) {
        return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    } else if (parts.length === 3) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    }
    return s;
}

function isTikTokUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(url);
}

function isInstagramUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /(?:instagram\.com|instagr\.am)/i.test(url);
}

// Image downloader helper with optional ffmpeg format conversion
async function downloadImageDirect(imageUrl, destPath, targetExt, onProgress) {
    return new Promise((resolve, reject) => {
        function fetchAndSave(u) {
            const client = u.startsWith('https') ? https : http;
            const req = client.get(u, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchAndSave(res.headers.location);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} when downloading image`));
                }

                const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
                let downloaded = 0;

                const desiredExt = (targetExt && targetExt !== 'best') ? `.${targetExt}` : path.extname(destPath) || '.jpg';
                const finalPath = destPath.replace(/\.[^/.]+$/, "") + desiredExt;

                currentDownloadFiles.push(finalPath);

                const needsConvert = targetExt && targetExt !== 'best' && !destPath.toLowerCase().endsWith(`.${targetExt}`);
                const writeTarget = needsConvert ? `${finalPath}_tmp${path.extname(destPath) || '.jpg'}` : finalPath;
                if (needsConvert) currentDownloadFiles.push(writeTarget);

                const ws = fs.createWriteStream(writeTarget);

                res.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (totalBytes > 0 && onProgress) {
                        onProgress((downloaded / totalBytes) * 100);
                    }
                });

                res.pipe(ws);

                ws.on('finish', () => {
                    ws.close();
                    if (needsConvert) {
                        const ffmpegPath = getFfmpegPath();
                        execFile(ffmpegPath, ['-y', '-i', writeTarget, finalPath], (err) => {
                            try { fs.unlinkSync(writeTarget); } catch (_) {}
                            if (err) {
                                resolve({ success: true, file: writeTarget });
                            } else {
                                resolve({ success: true, file: finalPath });
                            }
                        });
                    } else {
                        resolve({ success: true, file: finalPath });
                    }
                });
            });

            req.on('error', (err) => {
                if (fs.existsSync(destPath)) {
                    try { fs.unlinkSync(destPath); } catch (_) {}
                }
                reject(err);
            });
        }

        fetchAndSave(imageUrl);
    });
}

// Direct TikTok & Story downloader (watermark-free, fast, bypasses web anti-bot)
async function downloadTikTokDirect(rawUrl, format, quality, folder, onProgress, onLog) {
    const cleanUrl = cleanMediaUrl(rawUrl);
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
    
    const response = await new Promise((resolve, reject) => {
        https.get(apiUrl, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });

    if (!response || response.code !== 0 || !response.data) {
        throw new Error(response?.msg || 'Failed to fetch TikTok stream');
    }

    const data = response.data;
    const isPhotoPost = cleanUrl.includes('/photo/') || (data.images && Array.isArray(data.images) && data.images.length > 0);
    const isAudio = format === 'audio';
    const isImage = format === 'image' || isPhotoPost;

    const rawTitle = data.title || (cleanUrl.includes('/story/') ? 'TikTok_Story' : (isPhotoPost ? 'TikTok_Photos' : `tiktok_${data.id || Date.now()}`));
    const sanitizedTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || `tiktok_${data.id}`;

    // Handle Image / Photo Slideshow mode
    if (isImage) {
        const images = data.images;
        if (images && Array.isArray(images) && images.length > 0) {
            const subfolder = path.join(folder, `${sanitizedTitle} [${data.id || Date.now()}]`);
            if (!fs.existsSync(subfolder)) fs.mkdirSync(subfolder, { recursive: true });
            
            for (let i = 0; i < images.length; i++) {
                const imgExt = (quality && quality !== 'best') ? quality : 'jpg';
                const imgPath = path.join(subfolder, `photo_${i + 1}.${imgExt}`);
                if (onLog) onLog(`[${i + 1}/${images.length}] Destination: ${imgPath}`);
                await downloadImageDirect(images[i], imgPath, quality, (p) => {
                    const totalP = ((i + (p / 100)) / images.length) * 100;
                    if (onProgress) onProgress(totalP);
                });
            }
            return { success: true, folder: subfolder };
        } else {
            const coverUrl = data.origin_cover || data.cover || data.ai_dynamic_cover;
            if (!coverUrl) throw new Error('No image found for this TikTok post');
            const imgExt = (quality && quality !== 'best') ? quality : 'jpg';
            const imgPath = path.join(folder, `${sanitizedTitle} [${data.id || Date.now()}].${imgExt}`);
            if (onLog) onLog(`Destination: ${imgPath}`);
            return await downloadImageDirect(coverUrl, imgPath, quality, onProgress);
        }
    }

    const mediaUrl = isAudio ? (data.music || data.play) : (data.play || data.wmplay);
    const ext = isAudio ? 'mp3' : 'mp4';
    const filename = `${sanitizedTitle} [${data.id || Date.now()}].${ext}`;
    const destPath = path.join(folder, filename);
    
    currentDownloadFiles.push(destPath);
    if (onLog) onLog(`Destination: ${destPath}`);

    return new Promise((resolve, reject) => {
        function downloadStream(streamUrl) {
            const client = streamUrl.startsWith('https') ? https : http;
            const req = client.get(streamUrl, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return downloadStream(res.headers.location);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP error ${res.statusCode}`));
                }

                const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
                let downloadedBytes = 0;
                let lastTime = Date.now();
                let lastBytes = 0;

                const fileStream = fs.createWriteStream(destPath);
                res.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (totalBytes > 0 && onProgress) {
                        const percent = (downloadedBytes / totalBytes) * 100;
                        onProgress(percent);

                        const now = Date.now();
                        if (now - lastTime >= 400) {
                            const speed = ((downloadedBytes - lastBytes) / ((now - lastTime) / 1000)) / (1024 * 1024);
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('download-speed', `${speed.toFixed(1)} MiB/s`);
                            }
                            lastTime = now;
                            lastBytes = downloadedBytes;
                        }
                    }
                });

                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve({ success: true, file: destPath });
                });
            });

            req.on('error', (err) => {
                if (fs.existsSync(destPath)) {
                    try { fs.unlinkSync(destPath); } catch (_) {}
                }
                reject(err);
            });
        }

        downloadStream(mediaUrl);
    });
}

ipcMain.handle('start-download', async (event, { urls, format, quality, folder, cookies, embedThumbnail, embedMetadata, writeSubs, subLangs, speedLimit, startTime, endTime }) => {
    const downloadsFolder = folder || path.join(os.homedir(), 'Downloads');

    // If downloading a single TikTok URL, try direct high-speed download first
    if (urls && urls.length === 1 && isTikTokUrl(urls[0])) {
        try {
            currentDownloadFiles = [];
            const res = await downloadTikTokDirect(
                urls[0],
                format,
                quality,
                downloadsFolder,
                (percent) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('download-progress', percent);
                    }
                },
                (log) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('download-log', log);
                    }
                }
            );

            // If trimming requested on direct TikTok video/audio download
            if ((startTime || endTime) && res?.file && fs.existsSync(res.file)) {
                const s = formatTimeSlice(startTime) || '00:00:00';
                const e = formatTimeSlice(endTime);
                const trimmedDest = res.file.replace(/\.([^/.]+)$/, '_trimmed.$1');
                const ffmpegPath = getFfmpegPath();
                const trimArgs = ['-y', '-ss', s];
                if (e) trimArgs.push('-to', e);
                trimArgs.push('-i', res.file, '-c', 'copy', trimmedDest);

                await new Promise((resolveTrim) => {
                    execFile(ffmpegPath, trimArgs, (trimErr) => {
                        if (!trimErr && fs.existsSync(trimmedDest)) {
                            try {
                                fs.unlinkSync(res.file);
                                fs.renameSync(trimmedDest, res.file);
                            } catch (_) {}
                        }
                        resolveTrim();
                    });
                });
            }

            return { success: true };
        } catch (directErr) {
            console.warn('Direct TikTok download failed, falling back to yt-dlp:', directErr.message);
        }
    }

    // Direct Image Download (YouTube Thumbnails or Direct Images)
    if (format === 'image' && urls && urls.length === 1) {
        const rawUrl = urls[0];
        const cleanUrl = cleanMediaUrl(rawUrl);

        // Check if YouTube URL to download maxres thumbnail
        const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (ytMatch) {
            const videoId = ytMatch[1];
            const imgExt = (quality && quality !== 'best') ? quality : 'jpg';
            const destPath = path.join(downloadsFolder, `youtube_${videoId}.${imgExt}`);
            try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('download-log', `Destination: ${destPath}`);
                }
                await downloadImageDirect(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, destPath, quality, (pct) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('download-progress', pct);
                    }
                });
                return { success: true };
            } catch (ytImgErr) {
                try {
                    await downloadImageDirect(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, destPath, quality);
                    return { success: true };
                } catch (_) {}
            }
        }

        // Check if direct image URL (.jpg, .jpeg, .png, .webp, .gif)
        if (/\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(cleanUrl)) {
            const urlPath = new URL(cleanUrl).pathname;
            const baseName = path.basename(urlPath) || `image_${Date.now()}.jpg`;
            const destPath = path.join(downloadsFolder, baseName);
            try {
                await downloadImageDirect(cleanUrl, destPath, quality, (pct) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('download-progress', pct);
                    }
                });
                return { success: true };
            } catch (e) {
                console.warn('Direct image download failed, trying yt-dlp:', e.message);
            }
        }
    }

    const ytDlpPath = getYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);

    const args = [
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com',
        '--js-runtimes', `node:${process.execPath}`,
        '--ffmpeg-location', ffmpegDir,
        '-o', path.join(downloadsFolder, '%(title).80s [%(id)s].%(ext)s'),
        '--newline',
    ];

    // Add time trimming section if specified
    const startFormatted = formatTimeSlice(startTime);
    const endFormatted = formatTimeSlice(endTime);
    if (startFormatted || endFormatted) {
        const sliceStr = `*${startFormatted || '00:00:00'}-${endFormatted || 'inf'}`;
        args.push('--download-sections', sliceStr);
        args.push('--force-keyframes-at-cuts');
    }

    if (embedThumbnail) args.push('--embed-thumbnail');
    if (embedMetadata) args.push('--embed-metadata');

    if (cookies && cookies !== 'none') {
        args.push('--cookies-from-browser', cookies);
    }

    if (writeSubs) {
        args.push('--write-subs');
        if (subLangs) args.push('--sub-langs', subLangs);
    }

    if (speedLimit && speedLimit !== 'unlimited') {
        args.push('--limit-rate', speedLimit);
    }

    if (format === 'audio') {
        args.push('--extract-audio');
        const fmt = (quality === 'mp3' || quality === 'm4a' || quality === 'wav') ? quality : 'mp3';
        args.push('--audio-format', fmt);
        args.push('--audio-quality', '0');
    } else if (format === 'image') {
        args.push('--write-thumbnail', '--skip-download');
        const imgExt = (quality && quality !== 'best') ? quality : 'jpg';
        args.push('--convert-thumbnails', imgExt);
    } else {
        const formatMap = {
            'best':  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
            '4k':    'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]/best',
            '1440':  'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]/best',
            '1080':  'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
            '720':   'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
            '480':   'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best',
        };
        args.push('-f', formatMap[quality] || formatMap['best']);
        args.push('--merge-output-format', 'mp4');
    }

    const cleanedUrls = (urls || []).map(cleanMediaUrl);
    args.push(...cleanedUrls);

    let stderrOutput = '';

    return new Promise((resolve) => {
        currentDownloadFiles = [];
        currentDownloadProcess = spawn(ytDlpPath, args, {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        });

        currentDownloadProcess.stdout.on('data', (data) => {
            const output = data.toString();
            
            const destMatch = output.match(/Destination:\s+(.+)/);
            if (destMatch && destMatch[1]) {
                currentDownloadFiles.push(destMatch[1].trim());
            }

            const progressMatch = output.match(/\[download\]\s+([\d\.]+)%/);
            if (progressMatch && progressMatch[1]) {
                const percent = parseFloat(progressMatch[1]);
                mainWindow.webContents.send('download-progress', percent);
            }

            // Parse speed and ETA from yt-dlp output
            const speedMatch = output.match(/at\s+([\d\.]+\s*[KMG]?i?B\/s)/);
            if (speedMatch && speedMatch[1]) {
                mainWindow.webContents.send('download-speed', speedMatch[1]);
            }
            const etaMatch = output.match(/ETA\s+([\d:]+)/);
            if (etaMatch && etaMatch[1]) {
                mainWindow.webContents.send('download-eta', etaMatch[1]);
            }

            mainWindow.webContents.send('download-log', output);
        });

        currentDownloadProcess.stderr.on('data', (data) => {
            const errText = data.toString();
            stderrOutput += errText;
            // Also forward stderr to renderer so user sees the real error
            mainWindow.webContents.send('download-log', errText);
            console.error(`stderr: ${errText}`);
        });

        currentDownloadProcess.on('close', (code) => {
            currentDownloadProcess = null;
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: stderrOutput || `yt-dlp exited with code ${code}` });
            }
        });

        currentDownloadProcess.on('error', (err) => {
            currentDownloadProcess = null;
            resolve({ success: false, error: err.message });
        });
    });
});

ipcMain.handle('cancel-download', () => {
    if (currentDownloadProcess) {
        currentDownloadProcess.kill('SIGINT');
        currentDownloadProcess = null;
        
        // Wait briefly for yt-dlp to close file handles, then delete
        setTimeout(() => {
            currentDownloadFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    try { fs.unlinkSync(file); } catch (e) {}
                }
                if (fs.existsSync(file + '.part')) {
                    try { fs.unlinkSync(file + '.part'); } catch (e) {}
                }
                if (fs.existsSync(file + '.ytdl')) {
                    try { fs.unlinkSync(file + '.ytdl'); } catch (e) {}
                }
            });
            currentDownloadFiles = [];
        }, 1500);

        return true;
    }
    return false;
});

ipcMain.on('resize-window', (event, height) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const [currentWidth, currentHeight] = mainWindow.getContentSize();
        if (lockedContentWidth === null) {
            lockedContentWidth = currentWidth;
        }
        
        let targetHeight = height;
        if (targetHeight > 750) targetHeight = 750;

        if (Math.abs(currentHeight - targetHeight) > 1) {
            mainWindow.setContentSize(lockedContentWidth, targetHeight, process.platform === 'darwin');
        }
    }
});

ipcMain.on('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
    }
});



ipcMain.on('close-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }
});

ipcMain.handle('update-app', () => {
    if (process.platform === 'win32') {
        const cmd = `cmd.exe /c start powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -Command "Start-Sleep -Seconds 2; Write-Host '🚀 Reinstalling YTLocal...'; irm 'https://raw.githubusercontent.com/MigorengGH/YTLocal/main/install.ps1' | iex"`;
        exec(cmd);
    } else if (process.platform === 'darwin') {
        const cmd = `osascript -e 'tell application "Terminal" to do script "sleep 2; echo \\"🚀 Reinstalling YTLocal...\\"; curl -fsSL \\"https://raw.githubusercontent.com/MigorengGH/YTLocal/main/install.sh\\" | bash"'`;
        exec(cmd);
    }
    
    // Graceful exit after brief timeout to ensure background task has spawned
    setTimeout(() => {
        app.quit();
    }, 500);
});

ipcMain.handle('get-video-info', async (event, input) => {
    const rawUrl = typeof input === 'string' ? input : (input?.url || '');
    const cookies = typeof input === 'object' ? input?.cookies : null;
    if (!rawUrl) return { success: false, error: 'No URL provided' };

    const url = cleanMediaUrl(rawUrl);

    // Fast direct metadata lookup for TikTok URLs
    if (isTikTokUrl(url)) {
        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const apiRes = await new Promise((resolve, reject) => {
                https.get(apiUrl, (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                    });
                }).on('error', reject);
            });

            if (apiRes && apiRes.code === 0 && apiRes.data) {
                const d = apiRes.data;
                const isStory = url.includes('/story/');
                const isPhoto = url.includes('/photo/') || (d.images && Array.isArray(d.images) && d.images.length > 0);
                const info = {
                    id: d.id,
                    title: d.title || (isStory ? 'TikTok Story' : (isPhoto ? 'TikTok Photo Album' : 'TikTok Video')),
                    uploader: d.author ? `${d.author.nickname || ''} (@${d.author.unique_id || ''})`.trim() : 'TikTok',
                    uploader_id: d.author?.unique_id,
                    thumbnail: d.cover || d.origin_cover,
                    duration: d.duration || 0,
                    url: url,
                };
                return { success: true, isPlaylist: false, info };
            }
        } catch (e) {
            console.warn('Direct TikTok info fetch failed, trying yt-dlp fallback:', e.message);
        }
    }

    // Fast instant metadata lookup for YouTube single videos (< 100ms)
    const ytMatch = !url.includes('list=') && url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (ytMatch) {
        try {
            const videoId = ytMatch[1];
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const oembedRes = await new Promise((resolve) => {
                https.get(oembedUrl, (res) => {
                    if (res.statusCode !== 200) return resolve(null);
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch (_) { resolve(null); }
                    });
                }).on('error', () => resolve(null));
            });

            if (oembedRes && oembedRes.title) {
                const info = {
                    id: videoId,
                    title: oembedRes.title,
                    uploader: oembedRes.author_name || 'YouTube',
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    duration: 0,
                    url: url
                };
                return { success: true, isPlaylist: false, info };
            }
        } catch (e) {
            console.warn('YouTube fast lookup failed, falling back to yt-dlp:', e.message);
        }
    }

    const ytDlpPath = getYtDlpPath();
    const isPlaylist = url.includes('list=') || url.includes('/playlist') || url.includes('/sets/');
    const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--js-runtimes', `node:${process.execPath}`,
        '--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com',
    ];

    if (cookies && cookies !== 'none') {
        args.push('--cookies-from-browser', cookies);
    }

    if (isPlaylist) {
        args.push('--flat-playlist');
    } else if (!isInstagramUrl(url)) {
        args.push('--no-playlist');
    }
    args.push(url);

    return new Promise((resolve) => {
        execFile(ytDlpPath, args, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: stderr || error.message });
                return;
            }
            try {
                const lines = stdout.trim().split('\n').filter(l => l.length > 0);
                if (lines.length > 1) {
                    const items = lines.map(line => JSON.parse(line));
                    resolve({ success: true, isPlaylist: true, items });
                } else if (lines.length > 0) {
                    const info = JSON.parse(lines[0]);
                    resolve({ success: true, isPlaylist: false, info });
                } else {
                    resolve({ success: false, error: 'Empty response' });
                }
            } catch (e) {
                resolve({ success: false, error: 'Failed to parse video info: ' + e.message });
            }
        });
    });
});

ipcMain.handle('open-file', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        shell.openPath(filePath);
        return true;
    }
    return false;
});

ipcMain.handle('show-in-folder', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
    }
    return false;
});
