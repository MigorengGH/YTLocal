<div align="center">
  <img src="YTlocal.png" width="120" alt="YTLocal Logo"/>
  <h1>YTLocal</h1>
  <p><b>Download YouTube videos and audio — beautifully, locally, instantly.</b></p>

  [![GitHub release](https://img.shields.io/github/v/release/MigorengGH/YTLocal?style=flat-square&color=ff4444)](https://github.com/MigorengGH/YTLocal/releases)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue?style=flat-square)](https://github.com/MigorengGH/YTLocal/releases)
  [![Powered by yt-dlp](https://img.shields.io/badge/powered%20by-yt--dlp-ff0000?style=flat-square)](https://github.com/yt-dlp/yt-dlp)
</div>

---

## ✨ Features
- 🎬 **Video & Audio** — Download up to 4K video or extract high-quality MP3/WAV/M4A.
- 🗂️ **Batch Playlists** — Download entire YouTube playlists with a single click, or select specific videos.
- 🔄 **Always Up to Date** — One-click in-app updater for `yt-dlp` ensures downloads never break.
- ⚡ **Zero Setup** — Bundled with everything you need (FFmpeg, yt-dlp). No Python required.
- 🌑 **Sleek UI** — Glassmorphic dark mode with live progress bars.

---

## 📥 Install in One Click

**🍎 macOS (Apple Silicon)**
```bash
curl -fsSL "https://raw.githubusercontent.com/MigorengGH/YTLocal/main/install.sh" | bash
```
> *Fixes permissions and "damaged app" warnings automatically.*

**🪟 Windows (via powershell)**
```powershell
irm "https://raw.githubusercontent.com/MigorengGH/YTLocal/main/install.ps1" | iex
```
> *Bypasses SmartScreen warnings cleanly.*

*Prefer manual install? Grab the `.dmg`, `.exe` installer, or Portable `.zip` from the [Releases page](https://github.com/MigorengGH/YTLocal/releases).*

---

## 🚀 How to Use
1. **Paste** a YouTube URL.
2. **Choose** Video or Music & select your quality.
3. **Pick** a save folder (or use default Downloads).
4. **Hit Download!**
5. *(Optional)* Click **Update** to refresh `yt-dlp` if downloads ever fail.

---

## 🛠️ For Developers

Built with [Electron](https://www.electronjs.org/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), and Vanilla web tech. 

```bash
# Clone & run locally
git clone https://github.com/MigorengGH/YTLocal.git
cd YTLocal
npm install
npm start

# Build binaries (check dist/ folder)
npm run dist        # macOS
npm run dist:win    # Windows
```

---

<div align="center">
  <p><b>Created by Fahimi Amir | Powered by yt-dlp</b></p>
  <p><a href="https://github.com/MigorengGH/YTLocal/issues">Report a Bug</a> · <a href="https://github.com/MigorengGH/YTLocal/issues">Request a Feature</a></p>
</div>
