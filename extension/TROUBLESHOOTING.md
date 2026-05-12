# Troubleshooting

## "Prompt input not found" or "Generate button not found"
The platform UI has changed. **Settings → Calibrate <Platform> → Pick** the correct elements, **Test**, **Save All**.

## Side panel does not open on Android
Quetta/Kiwi may not implement `chrome.sidePanel`. The popup falls back to opening `sidepanel.html` in a normal tab — same UI.

## Downloads land in flat Downloads folder instead of `AI_Content_Hub/...`
Some mobile builds block sub-folders for security. The extension auto-falls back to flat filenames so files are never lost.

## "Layout change detected — please recalibrate"
A previously-working selector vanished for more than 10 seconds. The platform deployed UI changes. Use Calibrate to repair.

## Multi-Tab mode hangs
A child tab is stuck. The recovery routine will replace it after the timeout in Settings → Timeout (default 90 s). Increase if your network is slow.

## "login_required" / "captcha" / "quota" / "moderation" / "rate_limit"
The extension detected one of these states on the platform page. It pauses generation. Resolve the state in the page (log in, complete CAPTCHA, wait out the limit) and click **Resume**.

## Edit Export plays but the file won't open
Output is **WebM** (VP9/VP8). Most players support it; if a target app does not, transcode to MP4 with an offline converter — we deliberately avoid bundling FFmpeg.wasm (~30 MB) on mobile.

## Auto-download didn't fire
- Settings → **Auto-Download** must be checked.
- Some mobile builds require a foreground tap before downloads can start.
- Run **Download → Download Finished** manually.

## Logs are empty
Settings → **Enable Logs**. Logs auto-rotate at 1000 entries.

## Reset everything
`chrome://extensions` → **Details** → **Extension options** are not provided; instead use Settings → **Reset Calibration** and **Clear Logs**. To fully reset, **Remove** the extension and reload it.

## Service Worker keeps restarting
Manifest V3 service workers idle out after ~30 s. The extension stores state in `chrome.storage.local` and resumes on demand — this is normal.
