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
        height: 620,
        resizable: false,
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

ipcMain.handle('start-download', async (event, { urls, format, quality, folder, cookies, embedThumbnail, embedMetadata, writeSubs, subLangs, speedLimit }) => {
    const downloadsFolder = folder || path.join(os.homedir(), 'Downloads');
    const ytDlpPath = getYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);

    const args = [
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-args', 'generic:impersonate',
        '--js-runtimes', `node:${process.execPath}`,
        '--ffmpeg-location', ffmpegDir,
        '-o', path.join(downloadsFolder, '%(title)s.%(ext)s'),
        '--newline',
    ];

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
    } else {
        const formatMap = {
            'best':  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
            '4k':    'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best',
            '1440':  'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best',
            '1080':  'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best',
            '720':   'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
            '480':   'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best',
        };
        args.push('-f', formatMap[quality] || formatMap['best']);
        args.push('--merge-output-format', 'mp4');
    }

    args.push(...urls);

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

ipcMain.handle('get-video-info', async (event, url) => {
    const ytDlpPath = getYtDlpPath();
    const isPlaylist = url.includes('list=');
    const args = ['--dump-json', '--no-warnings', '--extractor-args', 'generic:impersonate'];
    if (isPlaylist) {
        args.push('--flat-playlist');
    } else {
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
                if (isPlaylist && lines.length > 1) {
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
