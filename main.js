const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const youtubedl = require('youtube-dl-exec');

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
    createWindow();

    // Auto-update yt-dlp on launch
    try {
        mainWindow.webContents.send('update-status', 'Updating YT-DLP engine...');
        await youtubedl.exec('', { update: true });
        mainWindow.webContents.send('update-status', 'Ready');
    } catch (e) {
        console.error('Update error:', e);
        mainWindow.webContents.send('update-status', 'Ready');
    }

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

    let args = {
        noCheckCertificates: true,
        noWarnings: true,
        output: path.join(downloadsFolder, '%(title)s.%(ext)s'),
    };

    if (format === 'audio') {
        args.extractAudio = true;
        if (quality === 'mp3') {
            args.audioFormat = 'mp3';
            args.audioQuality = 0;
        } else if (quality === 'm4a') {
            args.audioFormat = 'm4a';
            args.audioQuality = 0;
        } else if (quality === 'wav') {
            args.audioFormat = 'wav';
            args.audioQuality = 0;
        } else {
            args.audioFormat = 'mp3';
            args.audioQuality = 0;
        }
    } else {
        // Video
        if (quality === 'best') {
            args.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        } else if (quality === '4k') {
            args.format = 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]';
        } else if (quality === '1440') {
            args.format = 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440]';
        } else if (quality === '1080') {
            args.format = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]';
        } else if (quality === '720') {
            args.format = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]';
        } else if (quality === '480') {
            args.format = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]';
        } else {
            args.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        }
        args.mergeOutputFormat = 'mp4';
    }

    try {
        const subprocess = youtubedl.exec(url, args);

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
            console.error(`stderr: ${data}`);
        });

        return new Promise((resolve, reject) => {
            subprocess.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: `Process exited with code ${code}` });
                }
            });
            subprocess.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });
        });
    } catch (e) {
        return { success: false, error: e.message };
    }
});
