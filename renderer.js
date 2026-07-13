const { ipcRenderer } = require('electron');

const urlInput = document.getElementById('url-input');
const formatVideo = document.getElementById('format-video');
const formatAudio = document.getElementById('format-audio');
const qualityButtonsContainer = document.getElementById('quality-buttons');
const folderBtn = document.getElementById('folder-btn');
const folderPathDisplay = document.getElementById('folder-path');
const downloadBtn = document.getElementById('download-btn');
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

downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    const format = formatVideo.checked ? 'video' : 'audio';

    downloadBtn.disabled = true;
    urlInput.disabled = true;
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

    downloadBtn.disabled = false;
    urlInput.disabled = false;
    
    setTimeout(() => {
        if(result.success) {
            statusContainer.classList.add('hidden');
            progressBar.style.width = '0%';
            urlInput.value = '';
        } else {
            progressBar.style.backgroundColor = 'var(--primary-color)';
        }
    }, 4000);
});
