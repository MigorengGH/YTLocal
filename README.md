# YTLocal

YTLocal is a sleek, modern desktop application that allows you to effortlessly download videos and audio from YouTube and other supported sites. Built with Electron and `youtube-dl-exec`, it provides a simple and intuitive graphical interface to download media in various formats and qualities directly to your local machine.

## Features

- **Beautiful Modern UI:** Dark-themed, glassmorphic UI with smooth animations.
- **Video & Audio Downloads:** Download full videos or extract just the audio (music).
- **Format Selection:** Choose from multiple qualities (e.g., Best, 1080p, 720p, 480p) or audio formats (MP3, M4A, WAV).
- **Custom Save Location:** Easily select where you want your downloaded files to be saved.
- **Live Progress Tracking:** Monitor your downloads with a visual progress bar and percentage indicator.

## How to use

1. Download the app for your platform from the Releases page.
2. Open the app.
3. Paste the URL of the video or audio you want to download.
4. Select whether you want Video or Music.
5. Choose your desired quality/format.
6. Click Download and wait for the process to finish!

## Development

If you'd like to run the app from source:

1. Clone this repository.
2. Run `npm install` to install the dependencies.
3. Run `npm start` to start the app locally.

## Packaging

To package the application into a standalone executable:

```bash
npm run dist
```

This will output the compiled binaries into the `dist/` directory.

## Technologies Used

- [Electron](https://www.electronjs.org/)
- [youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec)
- HTML/CSS/JavaScript
