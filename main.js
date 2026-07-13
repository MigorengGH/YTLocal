const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
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

// Ensure binaries have execute permissions (they can be stripped when bundled)
function ensureBinaryPermissions() {
    if (process.platform === 'win32') return;
    try {
        const binDir = path.join(process.resourcesPath, 'bin');
        if (fs.existsSync(binDir)) {
            const files = fs.readdirSync(binDir);
            files.forEach(file => {
                const filePath = path.join(binDir, file);
                fs.chmodSync(filePath, 0o755);
            });
            console.log('✅ Binary permissions set');
        }
    } catch (e) {
        console.error('Could not set binary permissions:', e.message);
    }
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 560,
        resizable: false,
        titleBarStyle: 'hidden',
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

ipcMain.handle('start-download', async (event, { url, format, quality, folder }) => {
    const downloadsFolder = folder || path.join(os.homedir(), 'Downloads');
    const ytDlpPath = getYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);

    const args = [
        '--no-check-certificates',
        '--no-warnings',
        '--ffmpeg-location', ffmpegDir,
        '-o', path.join(downloadsFolder, '%(title)s.%(ext)s'),
        '--newline',
    ];

    if (format === 'audio') {
        args.push('--extract-audio');
        const fmt = (quality === 'mp3' || quality === 'm4a' || quality === 'wav') ? quality : 'mp3';
        args.push('--audio-format', fmt);
        args.push('--audio-quality', '0');
    } else {
        const formatMap = {
            'best':  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '4k':    'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]',
            '1440':  'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440]',
            '1080':  'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]',
            '720':   'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]',
            '480':   'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]',
        };
        args.push('-f', formatMap[quality] || formatMap['best']);
        args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    let stderrOutput = '';

    return new Promise((resolve) => {
        const subprocess = spawn(ytDlpPath, args);

        subprocess.stdout.on('data', (data) => {
            const output = data.toString();
            const progressMatch = output.match(/\[download\]\s+([\d\.]+)%/);
            if (progressMatch && progressMatch[1]) {
                const percent = parseFloat(progressMatch[1]);
                mainWindow.webContents.send('download-progress', percent);
            }
            mainWindow.webContents.send('download-log', output);
        });

        subprocess.stderr.on('data', (data) => {
            const errText = data.toString();
            stderrOutput += errText;
            // Also forward stderr to renderer so user sees the real error
            mainWindow.webContents.send('download-log', errText);
            console.error(`stderr: ${errText}`);
        });

        subprocess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: stderrOutput || `yt-dlp exited with code ${code}` });
            }
        });

        subprocess.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
});
