<div align="center">

<img src="YTlocal.png" width="120" alt="YTLocal Logo"/>

# YTLocal

**Download YouTube videos and audio — beautifully, locally, instantly.**

[![GitHub release](https://img.shields.io/github/v/release/MigorengGH/YTLocal?style=flat-square&color=ff4444)](https://github.com/MigorengGH/YTLocal/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue?style=flat-square)](https://github.com/MigorengGH/YTLocal/releases)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848f?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![yt-dlp](https://img.shields.io/badge/powered%20by-yt--dlp-ff0000?style=flat-square)](https://github.com/yt-dlp/yt-dlp)
[![License: ISC](https://img.shields.io/badge/license-ISC-green?style=flat-square)](LICENSE)

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎬 **Video Downloads** | Best, 4K, 1440p, 1080p, 720p, 480p |
| 🎵 **Audio Extraction** | MP3, M4A, WAV — high quality |
| 📁 **Custom Save Folder** | Pick any folder on your machine |
| 📊 **Live Progress Bar** | Real-time download progress |
| 🌑 **Dark UI** | Glassmorphic modern interface |
| ⚡ **Zero Setup** | No Python, no FFmpeg needed — everything bundled |

---

## 📥 Download & Install

> **Get the latest version from the [Releases page →](https://github.com/MigorengGH/YTLocal/releases)**

### 🍎 macOS (Apple Silicon)

**One-Click Install (Recommended)**
Since the app is not signed by Apple, manual installation can trigger a "damaged app" error. Use this terminal command to install the app and fix permissions automatically:
```bash
curl -fsSL https://raw.githubusercontent.com/MigorengGH/YTLocal/main/install.sh | bash
```

**Manual Install (Alternative)**
1. Download `YTLocal-x.x.x-arm64.dmg` from Releases
2. Open the `.dmg` and **drag YTLocal into Applications**
3. Open Terminal and run:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/YTLocal.app
   ```
4. Launch YTLocal from your Applications folder

> ⚠️ **Never run the app directly from the disk image.** Always drag it to Applications first.


### 🪟 Windows
1. Download `YTLocal Setup x.x.x.exe`
2. Run the installer
3. Launch YTLocal from the Start Menu or Desktop

---

## 🚀 How to Use

```
1. Paste a YouTube URL into the input field
2. Choose Video 🎬 or Music 🎵
3. Select your quality or format
4. Pick a save location (optional)
5. Hit Download and watch the progress bar!
```

---

## 🛠️ Run from Source

> If the packaged app doesn't work, you can run it directly from source. Requires [Node.js v18+](https://nodejs.org).

```bash
# Clone the repo
git clone https://github.com/MigorengGH/YTLocal.git
cd YTLocal

# Install dependencies (auto-downloads yt-dlp & ffmpeg)
npm install

# Launch the app
npm start
```

---

## 🔨 Build from Source

```bash
# macOS .dmg
npm run dist

# Windows .exe
npm run dist:win
```

Output is placed in the `dist/` folder.

---

## 🧰 Tech Stack

| Tool | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop app framework |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Video downloading engine |
| [ffmpeg](https://ffmpeg.org/) | Video/audio merging |
| [electron-builder](https://www.electron.build/) | Packaging & distribution |
| HTML / CSS / JS | UI |

---

<div align="center">

Made with ❤️ · [Report a Bug](https://github.com/MigorengGH/YTLocal/issues) · [Request a Feature](https://github.com/MigorengGH/YTLocal/issues)

</div>
