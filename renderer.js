const { ipcRenderer, clipboard } = require('electron');

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

    downloadBtn.style.display = 'none';
    cancelBtn.style.display = 'block';
    urlInput.disabled = true;
    if (pasteBtn) pasteBtn.disabled = true;
    statusContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    statusPercent.innerText = '0%';
    statusText.innerText = 'Starting download...';

    const result = await ipcRenderer.invoke('start-download', { url, format, quality: currentQuality, folder: selectedFolder });

    if (result.success) {
        statusText.innerText = 'Download complete!';
        progressBar.style.width = '100%';
        statusPercent.innerText = '100%';
    } else {
        statusText.innerText = `Error: ${result.error || 'Failed'}`;
        progressBar.style.backgroundColor = '#ff4444';
        statusPercent.innerText = '';
    }

    urlInput.disabled = false;
    if (pasteBtn) pasteBtn.disabled = false;
    
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
    });
}

const updateBtn = document.getElementById('update-btn');
if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
        updateBtn.disabled = true;
        if (pasteBtn) pasteBtn.disabled = true;
        downloadBtn.style.display = 'none';
        statusContainer.classList.remove('hidden');
        statusText.innerText = 'Checking for updates...';
        progressBar.style.width = '50%';
        statusPercent.innerText = '';
        
        const result = await ipcRenderer.invoke('update-ytdlp');
        
        if (result.success) {
            statusText.innerText = result.output.includes('Up to date') ? 'yt-dlp is already up to date' : 'Update successful!';
            progressBar.style.backgroundColor = 'var(--primary-color)';
            progressBar.style.width = '100%';
        } else {
            statusText.innerText = `Update failed`;
            progressBar.style.backgroundColor = '#ff4444';
            progressBar.style.width = '100%';
            console.error('Update output:', result.output);
        }
        
        setTimeout(() => {
            statusContainer.classList.add('hidden');
            progressBar.style.width = '0%';
            progressBar.style.backgroundColor = 'var(--primary-color)';
            updateBtn.disabled = false;
            if (pasteBtn) pasteBtn.disabled = false;
            downloadBtn.style.display = 'block';
        }, 4000);
    });
}

// Auto-resize window based on content
const container = document.querySelector('.container');
if (container) {
    const resizeObserver = new ResizeObserver(() => {
        const height = container.scrollHeight;
        ipcRenderer.send('resize-window', height);
    });
    resizeObserver.observe(container);
}
