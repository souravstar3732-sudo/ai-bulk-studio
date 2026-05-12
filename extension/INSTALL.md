# Install Guide

## Chrome / Chromium (Desktop)

1. Download or clone the `extension` folder (or unzip `extension.zip`).
2. Open `chrome://extensions`.
3. Toggle **Developer mode** ON (top right).
4. Click **Load unpacked** and select the `extension` folder.
5. Pin **Grok Bulk Studio** to the toolbar.
6. Click the icon → **Open Side Panel**.

## Android — Quetta / Kiwi Browser

> Standard Chrome on Android does not support extensions. Use a Chromium browser that does, e.g. **Quetta Browser**, **Kiwi Browser**, or **Mises**.

1. In the Chromium browser open the Extensions page (`chrome://extensions` or via menu → Extensions).
2. Enable **Developer mode**.
3. Tap **+ (from .zip)** and select `extension.zip` — **or** **Load unpacked** with the unzipped folder.
4. Open the new tab menu and tap the Grok Bulk Studio icon.
5. The side panel may not exist on mobile; if so the extension page opens in a tab — same UI.

### Mobile tips

- Some mobile builds do not support download sub-folders. The extension auto-falls back to flat filenames in the default Downloads folder.
- Multi-Tab mode default is **2 workers** (mobile-safe). Use **Smart Concurrency** to test what your device can handle.
- Enable **Mobile Lightweight** in Settings to keep the Edit pipeline at canvas-only.

## First-time setup

1. Open `https://grok.com/imagine` and log in normally.
2. Back in the extension → **Generate** tab → tap **Validate Selectors**.
3. If it says ✗ Missing → tap **Diagnose Page** to see what's actually on your Grok page → tap **Open Calibration**.
4. For each role (especially `promptInput` and `generateButton`): tap **Pick**, switch to the Grok tab, click the matching element, return → **Test** (should say FOUND) → **Save All**.
5. Go back to the side panel and try **Start Bulk** with a few prompts.

## Uninstall

`chrome://extensions` → **Remove**.
