const { ipcRenderer, clipboard } = require('electron');

// Add platform class to body for custom CSS rules (e.g. showing close/minimize buttons on Windows/Linux)
document.body.classList.add(`platform-${process.platform}`);

// Handle custom window controls
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
        ipcRenderer.send('minimize-window');
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        ipcRenderer.send('close-window');
    });
}

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
        if (opt.value === currentQuality) {
            btn.classList.add('selected');
        }
        btn.innerText = opt.label;
        btn.onclick = () => {
            currentQuality = opt.value;
            Array.from(qualityButtonsContainer.children).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        qualityButtonsContainer.appendChild(btn);
    });
}

// Initial populate
populateQualityButtons(false);

formatVideo.addEventListener('change', () => populateQualityButtons(false));
formatAudio.addEventListener('change', () => populateQualityButtons(true));

folderBtn.addEventListener('click', async () => {
    const path = await ipcRenderer.invoke('select-folder');
    if (path) {
        selectedFolder = path;
        const folderName = path.split(/[/\\]/).pop();
        folderPathDisplay.innerText = folderName;
        folderPathDisplay.title = path;
    }
});

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

if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
        const text = clipboard.readText();
        if (text) {
            urlInput.value = text.trim();
        }
    });
}

downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

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

    const embedThumbnailInput = document.getElementById('embed-thumbnail');
    const embedMetadataInput = document.getElementById('embed-metadata');
    embedThumbnailInput.disabled = true;
    embedMetadataInput.disabled = true;

    const embedThumbnail = embedThumbnailInput.checked;
    const embedMetadata = embedMetadataInput.checked;

    const result = await ipcRenderer.invoke('start-download', { 
        url, 
        format, 
        quality: currentQuality, 
        folder: selectedFolder,
        cookies,
        embedThumbnail,
        embedMetadata
    });

    if (result.success) {
        statusText.innerText = 'Download complete!';
        progressBar.style.width = '100%';
        statusPercent.innerText = '100%';
        clearSpeedEta();
    } else {
        statusText.innerText = `Error: ${result.error || 'Failed'}`;
        progressBar.style.backgroundColor = '#ff4444';
        statusPercent.innerText = '';
        clearSpeedEta();
    }

    urlInput.disabled = false;
    if (pasteBtn) pasteBtn.disabled = false;
    embedThumbnailInput.disabled = false;
    embedMetadataInput.disabled = false;
    
    setTimeout(() => {
        statusContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = 'var(--primary-color)';
        if(result.success) {
            urlInput.value = '';
        }
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

const updateBtn = document.getElementById('update-btn');
if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
        updateBtn.disabled = true;
        if (pasteBtn) pasteBtn.disabled = true;
        downloadBtn.style.display = 'none';
        statusContainer.classList.remove('hidden');
        statusText.innerText = 'Launching installer...';
        progressBar.style.width = '100%';
        statusPercent.innerText = '';
        
        // Wait 1 second to show the text to the user, then invoke update-app
        setTimeout(async () => {
            await ipcRenderer.invoke('update-app');
        }, 1000);
    });
}

// Auto-resize window based on content
const container = document.querySelector('.container');
if (container) {
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver(() => {
        const height = container.scrollHeight;
        if (height !== lastHeight) {
            lastHeight = height;
            ipcRenderer.send('resize-window', height);
        }
    });
    resizeObserver.observe(container);
}

// Hide safari option on non-macOS platforms
if (process.platform !== 'darwin') {
    const safariOpt = document.querySelector('#cookies-select option[value="safari"]');
    if (safariOpt) safariOpt.remove();
}

// ── Speed & ETA Indicators ──────────────────────────────────────────────
const speedText = document.getElementById('speed-text');
const etaText = document.getElementById('eta-text');

ipcRenderer.on('download-speed', (event, speed) => {
    if (speedText) speedText.innerText = `↓ ${speed}`;
});

ipcRenderer.on('download-eta', (event, eta) => {
    if (etaText) etaText.innerText = `ETA ${eta}`;
});

// Clear speed/ETA when download finishes or is cancelled
function clearSpeedEta() {
    if (speedText) speedText.innerText = '';
    if (etaText) etaText.innerText = '';
}

// Patch into existing download completion flow
const originalDownloadClick = downloadBtn.onclick;
downloadBtn.addEventListener('click', () => {
    clearSpeedEta();
});

// ── Settings Panel Toggle ──────────────────────────────────────────────
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');

if (settingsBtn && settingsOverlay) {
    settingsBtn.addEventListener('click', () => {
        settingsOverlay.classList.remove('hidden');
    });
}

if (settingsCloseBtn && settingsOverlay) {
    settingsCloseBtn.addEventListener('click', () => {
        settingsOverlay.classList.add('hidden');
    });
}

if (settingsOverlay) {
    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    });
}





