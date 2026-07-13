# YTLocal

YTLocal is a sleek, modern desktop application that allows you to effortlessly download videos and audio from YouTube and other supported sites. Built with Electron and `yt-dlp`, it provides a simple and intuitive graphical interface to download media in various formats and qualities directly to your local machine.

## Features

- **Beautiful Modern UI:** Dark-themed, glassmorphic UI with smooth animations.
- **Video & Audio Downloads:** Download full videos or extract just the audio (music).
- **Format Selection:** Choose from multiple qualities (e.g., Best, 1080p, 720p, 480p) or audio formats (MP3, M4A, WAV).
- **Custom Save Location:** Easily select where you want your downloaded files to be saved.
- **Live Progress Tracking:** Monitor your downloads with a visual progress bar and percentage indicator.

---

## 📦 Install the App (Recommended)

1. Go to the [Releases](https://github.com/MigorengGH/YTLocal/releases) page and download the file for your platform.
2. **macOS** → Download `YTLocal-x.x.x-arm64.dmg`
   - Open the `.dmg` file
   - **Drag YTLocal into your Applications folder** ← important!
   - Open it from Applications (not from the disk image)
3. **Windows** → Download `YTLocal Setup x.x.x.exe`
   - Run the installer and follow the steps
   - Launch YTLocal from the Start Menu or Desktop

> ⚠️ **macOS users:** Do NOT run the app directly from the `.dmg` disk image — always drag it to Applications first or it will fail to start.

> 🔒 **macOS "damaged app" or "unidentified developer" error?**
> This happens because the app is not signed with an Apple certificate. To fix it, open **Terminal** and run:
> ```bash
> xattr -cr /Applications/YTLocal.app
> ```
> Then try opening it again. If macOS still blocks it, go to **System Settings → Privacy & Security** and click **"Open Anyway"**.

---

## 🛠️ Run Locally from Source (if the package doesn't work)

If the packaged app isn't working on your machine, you can run it directly from source. You will need [Node.js](https://nodejs.org) installed (v18 or later recommended).

```bash
# 1. Clone the repository
git clone https://github.com/MigorengGH/YTLocal.git
cd YTLocal

# 2. Install dependencies (this also downloads the yt-dlp binary automatically)
npm install

# 3. Run the app
npm start
```

That's it — the app window will open and everything works the same as the packaged version.

---

## 🔨 Build from Source (create your own .dmg / .exe)

```bash
# macOS
npm run dist

# Windows
npm run dist:win
```

Output files will be placed in the `dist/` folder.

---

## Technologies Used

- [Electron](https://www.electronjs.org/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- HTML/CSS/JavaScript
