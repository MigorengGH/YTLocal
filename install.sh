#!/bin/bash
set -e

REPO="MigorengGH/YTLocal"
APP_NAME="YTLocal"
INSTALL_DIR="/Applications"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        YTLocal Installer             ║"
echo "╚══════════════════════════════════════╝"
echo "  Created by Fahimi Amir | Powered by yt-dlp"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "✅ Detected: Apple Silicon (arm64)"
    ASSET_PATTERN="arm64.dmg"
else
    echo "✅ Detected: Intel Mac (x86_64)"
    ASSET_PATTERN="arm64.dmg"
fi

# Get latest release download URL
echo "📡 Fetching latest release..."
DMG_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" \
    | grep "browser_download_url" \
    | grep "$ASSET_PATTERN" \
    | cut -d '"' -f 4)

if [ -z "$DMG_URL" ]; then
    echo "❌ Could not find release. Visit: https://github.com/$REPO/releases"
    exit 1
fi

echo "📥 Downloading $APP_NAME..."
TMP_DMG="/tmp/YTLocal_install.dmg"
curl -L "$DMG_URL" -o "$TMP_DMG" --progress-bar

echo "📦 Mounting disk image..."
MOUNT_POINT=$(hdiutil attach "$TMP_DMG" -nobrowse -noautoopen | grep /Volumes | perl -pe 's/.*(\/Volumes\/.*)/\1/' | tr -d '\n')

# Ensure YTLocal is not running to avoid file lock/uninstall issues
if pgrep -x "YTLocal" > /dev/null; then
    echo "🛑 Closing running instances of YTLocal..."
    pkill -x "YTLocal" || true
    sleep 1
fi

echo "📂 Installing to $INSTALL_DIR..."

if [ -d "$INSTALL_DIR/$APP_NAME.app" ]; then
    echo "   Removing previous version..."
    rm -rf "$INSTALL_DIR/$APP_NAME.app"
fi

# Copy using a glob to handle any volume name variations (like /Volumes/YTLocal 1.0.0-arm64)
cp -R /Volumes/YTLocal*/$APP_NAME.app "$INSTALL_DIR/"

echo "🔓 Removing macOS quarantine..."
xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_NAME.app" 2>/dev/null || true

chmod +x "$INSTALL_DIR/$APP_NAME.app/Contents/MacOS/"* 2>/dev/null || true

echo "🔄 Updating yt-dlp core..."
"$INSTALL_DIR/$APP_NAME.app/Contents/Resources/bin/yt-dlp" -U || true

echo "💿 Cleaning up..."
hdiutil detach "$MOUNT_POINT" -quiet
rm -f "$TMP_DMG"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ YTLocal installed successfully!  ║"
echo "║  Open it from your Applications.    ║"
echo "╚══════════════════════════════════════╝"
echo ""
