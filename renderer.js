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
const formatImage = document.getElementById('format-image');
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

const imageOptions = [
    { value: 'best', label: 'HD / Original' },
    { value: 'jpg', label: 'JPG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WEBP' }
];

function populateQualityButtons(mode) {
    qualityButtonsContainer.innerHTML = '';
    let options = videoOptions;
    if (mode === 'audio') options = audioOptions;
    else if (mode === 'image') options = imageOptions;
    
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

populateQualityButtons('video');
formatVideo.addEventListener('change', () => populateQualityButtons('video'));
formatAudio.addEventListener('change', () => populateQualityButtons('audio'));
if (formatImage) formatImage.addEventListener('change', () => populateQualityButtons('image'));

folderBtn.addEventListener('click', async () => {
    const path = await ipcRenderer.invoke('select-folder');
    if (path) {
        selectedFolder = path;
        folderPathDisplay.innerText = path.split(/[/\\]/).pop();
        folderPathDisplay.title = path;
    }
});

// ── Trim Controls ──
const trimToggleHeader = document.getElementById('trim-toggle-header');
const trimBody = document.getElementById('trim-body');
const trimIndicator = document.getElementById('trim-indicator');
const trimStartInput = document.getElementById('trim-start');
const trimEndInput = document.getElementById('trim-end');
const trimClearBtn = document.getElementById('trim-clear-btn');

function updateTrimState() {
    const s = trimStartInput ? trimStartInput.value.trim() : '';
    const e = trimEndInput ? trimEndInput.value.trim() : '';
    if (s || e) {
        if (trimIndicator) {
            trimIndicator.innerText = `${s || '00:00'} → ${e || 'End'}`;
            trimIndicator.classList.add('active');
        }
    } else {
        if (trimIndicator) {
            trimIndicator.innerText = 'Off';
            trimIndicator.classList.remove('active');
        }
    }
}

if (trimToggleHeader) {
    trimToggleHeader.addEventListener('click', () => {
        if (trimBody) trimBody.classList.toggle('hidden');
    });
}
if (trimStartInput) trimStartInput.addEventListener('input', updateTrimState);
if (trimEndInput) trimEndInput.addEventListener('input', updateTrimState);
if (trimClearBtn) {
    trimClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (trimStartInput) trimStartInput.value = '';
        if (trimEndInput) trimEndInput.value = '';
        updateTrimState();
    });
}

// ── Clipboard Auto-Detection ──
const autoPasteCheckbox = document.getElementById('auto-paste-clipboard');
let lastAutoPastedUrl = '';

function showClipboardToast(msg) {
    let toast = document.querySelector('.clipboard-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'clipboard-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

function checkClipboardForLinks() {
    if (autoPasteCheckbox && !autoPasteCheckbox.checked) return;
    try {
        const text = clipboard.readText().trim();
        if (!text || !isValidUrl(text)) return;
        if (text === lastAutoPastedUrl || text === urlInput.value.trim()) return;

        const isMediaLink = /(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|instagr\.am|vimeo\.com|twitter\.com|x\.com)/i.test(text);
        if (isMediaLink) {
            lastAutoPastedUrl = text;
            urlInput.value = text;
            urlInput.dispatchEvent(new Event('input'));
            showClipboardToast('Link detected from clipboard!');
        }
    } catch (_) {}
}

window.addEventListener('focus', checkClipboardForLinks);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkClipboardForLinks();
});

// ── Video Info / Playlist & Story preview ──
let fetchTimer;
let currentPlaylistItems = [];
let currentFetchUrl = '';

function isValidUrl(str) {
    if (!str) return false;
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isTikTokUrl(url) {
    return /(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(url);
}

function isTikTokStory(url) {
    return /tiktok\.com\/(?:@[\w.-]+\/)?story\//i.test(url);
}

function isTikTokPhoto(url) {
    return /tiktok\.com\/(?:@[\w.-]+\/)?photo\//i.test(url);
}

function isInstagramUrl(url) {
    return /(?:instagram\.com|instagr\.am)/i.test(url);
}

function isInstagramStory(url) {
    return /instagram\.com\/stories\//i.test(url);
}

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

urlInput.addEventListener('input', () => {
    clearTimeout(fetchTimer);
    const rawUrl = urlInput.value.trim();
    const url = cleanMediaUrl(rawUrl);
    currentFetchUrl = url;
    const previewContainer = document.getElementById('video-preview-container');
    const playlistContainer = document.getElementById('playlist-container');

    if (!url || !isValidUrl(url)) {
        previewContainer.classList.add('hidden');
        playlistContainer.classList.add('hidden');
        downloadBtn.disabled = false;
        downloadBtn.innerText = 'Download';
        return;
    }
    
    // Set immediate loading states
    const isPlaylist = url.includes('list=') || url.includes('/playlist') || url.includes('/sets/');
    const isStory = isTikTokStory(url) || isInstagramStory(url);
    const isPhoto = isTikTokPhoto(url) || /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(url);
    const isTikTok = isTikTokUrl(url);
    const isInstagram = isInstagramUrl(url);

    if (isPhoto && formatImage) {
        formatImage.checked = true;
        populateQualityButtons('image');
    }

    if (isPlaylist) {
        playlistContainer.classList.remove('hidden');
        previewContainer.classList.remove('hidden');
        
        const itemsContainer = document.getElementById('playlist-items');
        if (itemsContainer) {
            itemsContainer.innerHTML = `
                <div class="loading-placeholder" style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    <span>Loading playlist items...</span>
                </div>
            `;
        }
        document.getElementById('playlist-count').innerText = 'Loading...';
        
        document.getElementById('preview-thumbnail').src = 'YTlocal.png';
        document.getElementById('preview-title').innerText = 'Loading playlist details...';
        document.getElementById('preview-channel').innerText = '';
        document.getElementById('preview-duration').innerText = 'Playlist';
        
        downloadBtn.disabled = true;
        downloadBtn.innerText = 'Loading Playlist...';
    } else {
        playlistContainer.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        document.getElementById('preview-thumbnail').src = 'YTlocal.png';
        document.getElementById('preview-title').innerText = 'Loading video info...';
        document.getElementById('preview-channel').innerText = '';
        document.getElementById('preview-duration').innerText = '--:--';
        
        downloadBtn.disabled = true;
        downloadBtn.innerText = isStory ? 'Loading Story...' : (isInstagram ? 'Loading Instagram...' : (isTikTok ? 'Loading TikTok...' : 'Loading Video Info...'));
    }
    
    fetchTimer = setTimeout(async () => {
        const cookiesSelect = document.getElementById('cookies-select');
        const cookies = cookiesSelect ? cookiesSelect.value : 'none';
        const result = await ipcRenderer.invoke('get-video-info', { url, cookies });
        if (url !== currentFetchUrl) return;
        
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
                document.getElementById('preview-thumbnail').src = result.info.thumbnail || result.info.thumbnails?.[0]?.url || 'YTlocal.png';
                
                const defaultTitle = isStory ? 'Story' : (isInstagram ? 'Instagram Reel/Post' : (isTikTok ? 'TikTok Video' : 'Video'));
                document.getElementById('preview-title').innerText = result.info.title || result.info.description || defaultTitle;
                
                const channel = result.info.uploader || result.info.channel || result.info.creator || (result.info.uploader_id ? `@${result.info.uploader_id}` : (isInstagram ? 'Instagram' : (isTikTok ? 'TikTok' : 'Unknown Channel')));
                document.getElementById('preview-channel').innerText = channel;
                
                let dur = '';
                if (result.info.duration) {
                    dur = new Date(result.info.duration * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
                } else if (isStory) {
                    dur = 'Story';
                } else if (isPhoto) {
                    dur = 'Photos';
                }
                document.getElementById('preview-duration').innerText = dur;
            }
            downloadBtn.disabled = false;
            downloadBtn.innerText = 'Download';
        } else {
            previewContainer.classList.add('hidden');
            playlistContainer.classList.add('hidden');
            downloadBtn.disabled = false;
            downloadBtn.innerText = 'Download';
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

    let format = 'video';
    if (formatAudio && formatAudio.checked) format = 'audio';
    else if (formatImage && formatImage.checked) format = 'image';

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

    // Hide Chrome recommendation note to save space during active download
    const infoNotes = document.querySelector('.info-notes-container');
    if (infoNotes) infoNotes.style.display = 'none';

    const embedThumbnail = document.getElementById('embed-thumbnail').checked;
    const embedMetadata = document.getElementById('embed-metadata').checked;
    const writeSubs = document.getElementById('write-subs')?.checked || false;
    const subLangs = document.getElementById('sub-langs')?.value || '';
    const speedLimit = document.getElementById('speed-limit')?.value || 'unlimited';
    const startTime = trimStartInput ? trimStartInput.value.trim() : '';
    const endTime = trimEndInput ? trimEndInput.value.trim() : '';

    const result = await ipcRenderer.invoke('start-download', { 
        urls, format, quality: currentQuality, folder: selectedFolder, cookies,
        embedThumbnail, embedMetadata, writeSubs, subLangs, speedLimit,
        startTime, endTime
    });

    if (result.success) {
        statusText.innerText = 'Download complete!';
        progressBar.style.width = '100%';
        statusPercent.innerText = '100%';
        
        // Hide preview card and playlist card immediately, clear URL input and items
        const previewContainer = document.getElementById('video-preview-container');
        const playlistContainer = document.getElementById('playlist-container');
        if (previewContainer) previewContainer.classList.add('hidden');
        if (playlistContainer) playlistContainer.classList.add('hidden');
        urlInput.value = '';
        currentPlaylistItems = [];
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
        
        // Show Chrome recommendation note again
        if (infoNotes) infoNotes.style.display = '';
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

// Auto-resize window to fit content perfectly without dead empty space
function updateWindowHeight() {
    const container = document.querySelector('.container');
    if (!container) return;
    const titlebar = document.querySelector('.titlebar');
    const titlebarHeight = titlebar ? (titlebar.offsetHeight || 38) : 38;
    const height = Math.ceil(container.scrollHeight + titlebarHeight + 10);
    ipcRenderer.send('resize-window', height);
}

const container = document.querySelector('.container');
if (container) {
    new ResizeObserver(() => {
        updateWindowHeight();
    }).observe(container);
}
window.addEventListener('DOMContentLoaded', updateWindowHeight);
window.addEventListener('load', updateWindowHeight);

const cookiesSelectEl = document.getElementById('cookies-select');
if (cookiesSelectEl) {
    cookiesSelectEl.addEventListener('change', () => {
        if (urlInput.value.trim()) {
            urlInput.dispatchEvent(new Event('input'));
        }
    });
}

if (process.platform !== 'darwin') {
    const safariOpt = document.querySelector('#cookies-select option[value="safari"]');
    if (safariOpt) safariOpt.remove();
}
