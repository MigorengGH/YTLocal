const { ipcRenderer, clipboard } = require('electron');

// Add platform class to body for custom CSS rules
document.body.classList.add(`platform-${process.platform}`);

const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

if (minimizeBtn) minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));

const urlInput = document.getElementById('url-input');
const pasteBtn = document.getElementById('paste-btn');
const formatVideo = document.getElementById('format-video');
const formatAudio = document.getElementById('format-audio');
const qualityButtonsContainer = document.getElementById('quality-buttons');
const folderBtn = document.getElementById('folder-btn');
const folderPathDisplay = document.getElementById('folder-path');
const downloadBtn = document.getElementById('download-btn');
const cancelBtn = document.getElementById('cancel-btn');
const statusContainer = document.getElementById('status-container');
const statusText = document.getElementById('status-text');
const statusPercent = document.getElementById('status-percent');
const progressBar = document.getElementById('progress-bar');
const speedText = document.getElementById('speed-text');
const etaText = document.getElementById('eta-text');

let selectedFolder = null;
let currentQuality = 'best';

const videoOptions = [
    { value: 'best', label: 'Best' },
    { value: '4k', label: '4K' },
    { value: '1440', label: '1440p' },
    { value: '1080', label: '1080p' },
    { value: '720', label: '720p' },
    { value: '480', label: '480p' }
];

const audioOptions = [
    { value: 'mp3', label: 'MP3' },
    { value: 'm4a', label: 'M4A' },
    { value: 'wav', label: 'WAV' }
];

function populateQualityButtons(isAudio) {
    qualityButtonsContainer.innerHTML = '';
    const options = isAudio ? audioOptions : videoOptions;
    
    if (!options.find(o => o.value === currentQuality)) {
        currentQuality = options[0].value;
    }

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quality-btn';
        if (opt.value === currentQuality) btn.classList.add('selected');
        btn.innerText = opt.label;
        btn.onclick = () => {
            currentQuality = opt.value;
            Array.from(qualityButtonsContainer.children).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        qualityButtonsContainer.appendChild(btn);
    });
}

populateQualityButtons(false);
formatVideo.addEventListener('change', () => populateQualityButtons(false));
formatAudio.addEventListener('change', () => populateQualityButtons(true));

folderBtn.addEventListener('click', async () => {
    const path = await ipcRenderer.invoke('select-folder');
    if (path) {
        selectedFolder = path;
        folderPathDisplay.innerText = path.split(/[/\\]/).pop();
        folderPathDisplay.title = path;
    }
});

// ── Video Info / Playlist preview ──
let fetchTimer;
let currentPlaylistItems = [];

urlInput.addEventListener('input', () => {
    clearTimeout(fetchTimer);
    const url = urlInput.value.trim();
    const previewContainer = document.getElementById('video-preview-container');
    const playlistContainer = document.getElementById('playlist-container');

    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
        previewContainer.classList.add('hidden');
        playlistContainer.classList.add('hidden');
        return;
    }
    
    fetchTimer = setTimeout(async () => {
        const result = await ipcRenderer.invoke('get-video-info', url);
        if (result.success) {
            if (result.isPlaylist) {
                previewContainer.classList.remove('hidden');
                playlistContainer.classList.remove('hidden');
                currentPlaylistItems = result.items;
                renderPlaylist(result.items);
                
                const first = result.items[0] || {};
                document.getElementById('preview-thumbnail').src = first.thumbnails?.[0]?.url || first.thumbnail || 'YTlocal.png';
                document.getElementById('preview-title').innerText = first.playlist_title || 'Batch Download';
                document.getElementById('preview-channel').innerText = first.playlist_uploader || first.uploader || '';
                document.getElementById('preview-duration').innerText = `${result.items.length} items`;
            } else {
                playlistContainer.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                document.getElementById('preview-thumbnail').src = result.info.thumbnail || 'YTlocal.png';
                document.getElementById('preview-title').innerText = result.info.title || 'Unknown Title';
                document.getElementById('preview-channel').innerText = result.info.uploader || 'Unknown Channel';
                const dur = result.info.duration ? new Date(result.info.duration * 1000).toISOString().substr(11, 8).replace(/^00:/, '') : '';
                document.getElementById('preview-duration').innerText = dur;
            }
        }
    }, 500);
});

function renderPlaylist(items) {
    const container = document.getElementById('playlist-items');
    container.innerHTML = '';
    document.getElementById('playlist-count').innerText = `${items.length} items`;
    items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        const dur = item.duration ? new Date(item.duration * 1000).toISOString().substr(11, 8).replace(/^00:/, '') : '';
        div.innerHTML = `
            <input type="checkbox" class="playlist-item-check" data-url="${item.url}" checked>
            <span class="playlist-item-title">${item.title}</span>
            <span class="playlist-item-duration">${dur}</span>
        `;
        container.appendChild(div);
    });
}

function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

document.getElementById('playlist-select-all').addEventListener('change', (e) => {
    const checks = document.querySelectorAll('.playlist-item-check');
    checks.forEach(c => c.checked = e.target.checked);
});

// ── Status & Progress ──
ipcRenderer.on('update-status', (event, message) => {
    if (message === 'Ready' || message.includes('failed')) {
        statusContainer.classList.add('hidden');
    } else {
        statusContainer.classList.remove('hidden');
        statusText.innerText = message;
        statusPercent.innerText = '';
    }
});

ipcRenderer.on('download-progress', (event, percent) => {
    progressBar.style.width = `${percent}%`;
    statusPercent.innerText = `${percent.toFixed(1)}%`;
});

ipcRenderer.on('download-log', (event, text) => {
    if(text.includes('Destination:') || text.includes('Extracting')) {
        statusText.innerText = text.replace(/\[.*?\]/, '').trim();
    }
});

ipcRenderer.on('download-speed', (event, speed) => speedText && (speedText.innerText = `↓ ${speed}`));
ipcRenderer.on('download-eta', (event, eta) => etaText && (etaText.innerText = `ETA ${eta}`));

function clearSpeedEta() {
    if (speedText) speedText.innerText = '';
    if (etaText) etaText.innerText = '';
}

// ── Download Trigger ──
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    let urls = [];
    if (!document.getElementById('playlist-container').classList.contains('hidden')) {
        const checks = document.querySelectorAll('.playlist-item-check:checked');
        urls = Array.from(checks).map(c => c.dataset.url);
    } else {
        urls = [url];
    }
    
    if (urls.length === 0) return;

    const format = formatVideo.checked ? 'video' : 'audio';
    const cookiesSelect = document.getElementById('cookies-select');
    const cookies = cookiesSelect ? cookiesSelect.value : 'none';

    downloadBtn.style.display = 'none';
    cancelBtn.style.display = 'block';
    urlInput.disabled = true;
    if (pasteBtn) pasteBtn.disabled = true;
    statusContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    statusPercent.innerText = '0%';
    statusText.innerText = 'Starting download...';
    clearSpeedEta();

    const embedThumbnail = document.getElementById('embed-thumbnail').checked;
    const embedMetadata = document.getElementById('embed-metadata').checked;
    const writeSubs = document.getElementById('write-subs')?.checked || false;
    const subLangs = document.getElementById('sub-langs')?.value || '';
    const speedLimit = document.getElementById('speed-limit')?.value || 'unlimited';

    const result = await ipcRenderer.invoke('start-download', { 
        urls, format, quality: currentQuality, folder: selectedFolder, cookies,
        embedThumbnail, embedMetadata, writeSubs, subLangs, speedLimit
    });

    if (result.success) {
        statusText.innerText = 'Download complete!';
        progressBar.style.width = '100%';
        statusPercent.innerText = '100%';
        
    } else {
        statusText.innerText = `Error: ${result.error || 'Failed'}`;
        progressBar.style.backgroundColor = '#ff4444';
        statusPercent.innerText = '';
    }
    clearSpeedEta();

    urlInput.disabled = false;
    if (pasteBtn) pasteBtn.disabled = false;
    
    setTimeout(() => {
        statusContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = 'var(--primary-color)';
        if(result.success) urlInput.value = '';
        cancelBtn.style.display = 'none';
        downloadBtn.style.display = 'block';
    }, 4000);
});

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        ipcRenderer.invoke('cancel-download');
        statusText.innerText = 'Cancelling...';
        clearSpeedEta();
    });
}

// ── Overlays ──
function setupOverlay(btnId, overlayId, closeBtnId) {
    const btn = document.getElementById(btnId);
    const overlay = document.getElementById(overlayId);
    const closeBtn = document.getElementById(closeBtnId);
    if (!btn || !overlay || !closeBtn) return;
    
    btn.addEventListener('click', () => {
        overlay.classList.remove('hidden');
        if (overlayId === 'history-overlay') loadHistory();
    });
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
}

setupOverlay('settings-btn', 'settings-overlay', 'settings-close-btn');
// ── Clipboard Manual Paste ──
if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
        const text = clipboard.readText();
        if (text) {
            urlInput.value = text.trim();
            urlInput.dispatchEvent(new Event('input'));
        }
    });
}

// Update
const updateBtn = document.getElementById('update-btn');
if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
        updateBtn.disabled = true;
        downloadBtn.style.display = 'none';
        statusContainer.classList.remove('hidden');
        statusText.innerText = 'Launching installer...';
        progressBar.style.width = '100%';
        statusPercent.innerText = '';
        setTimeout(async () => await ipcRenderer.invoke('update-app'), 1000);
    });
}

// Auto-resize
const container = document.querySelector('.container');
if (container) {
    let lastHeight = 0;
    new ResizeObserver(() => {
        const height = container.scrollHeight;
        if (height !== lastHeight) {
            lastHeight = height;
            ipcRenderer.send('resize-window', height);
        }
    }).observe(container);
}

if (process.platform !== 'darwin') {
    const safariOpt = document.querySelector('#cookies-select option[value="safari"]');
    if (safariOpt) safariOpt.remove();
}
