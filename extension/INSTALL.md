# Install Guide

## Chrome / Chromium (Desktop)

1. Download or clone the `extension` folder (or unzip `extension.zip`).
2. Open `chrome://extensions`.
3. Toggle **Developer mode** ON (top right).
4. Click **Load unpacked** and select the `extension` folder.
5. Pin **AI Bulk Studio** to the toolbar.
6. Click the icon → **Open Side Panel**.

## Android — Quetta / Kiwi Browser

> Standard Chrome on Android does not support extensions. Use a Chromium browser that does, e.g. **Quetta Browser**, **Kiwi Browser**, or **Mises**. Behaviour and limits are browser-specific; not all chrome APIs are equally well supported.

1. In the Chromium browser open the **Extensions** page (e.g. `chrome://extensions` or via the menu → Extensions).
2. Enable **Developer mode**.
3. Tap **+ (from .zip)** and select `extension.zip` — **or** **Load unpacked** and select the unzipped folder.
4. Open the new tab menu and tap the AI Bulk Studio icon.
5. The side panel may not exist on mobile; if so the extension page opens in a tab — same UI.

### Mobile tips

- Some mobile builds do not support download sub-folders. The extension auto-falls back to flat filenames in the default Downloads folder.
- Multi-Tab mode default is **2 workers** (mobile-safe). Use **Smart Concurrency** to test what your device can handle.
- Enable **Mobile Lightweight** in Settings to keep the Edit pipeline at canvas-only.

## First-time setup

1. Open **Grok Imagine** (`https://grok.com/imagine`) or **Google Flow/Veo** (`https://labs.google/flow`) and log in normally.
2. Return to the extension → **Settings** → **Calibrate Grok** / **Calibrate Flow**.
3. For each role (prompt input, generate button, etc.), click **Pick** then click the actual element on the page.
4. **Test** verifies the selector is found. **Save All** stores it.
5. If the platform UI changes later, the extension auto-pauses and warns "Layout change — recalibrate".

## Uninstall

`chrome://extensions` → **Remove**.
