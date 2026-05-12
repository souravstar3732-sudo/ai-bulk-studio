# Troubleshooting

## "Could not establish connection. Receiving end does not exist."
The content script is not loaded on the tab the extension tried to talk to. Common causes and fixes:

1. **You're not on grok.com.** The extension only injects on Grok. Open `https://grok.com/imagine` first, then retry.
2. **Grok tab is still loading.** The new pre-flight (v1.0.3+) waits for `status: complete` and auto-injects the content script if needed. If it still fails, refresh the Grok tab and click **Validate Selectors** again.
3. **You're on a chrome://, edge://, or about: page.** Extensions cannot inject into browser-internal pages. Open Grok in a normal tab.

## "Pre-flight failed: selectors not found"
The default selectors don't match your version of Grok yet. Fix:
1. Side panel → **Diagnose Page** — see what's actually on the page (textareas, buttons, etc.) with copy-pasteable CSS selectors.
2. Side panel → **Open Calibration** → Pick + Test + Save All for at least `promptInput` and `generateButton`.

## "Prompt input not found" or "Generate button not found" mid-run
Grok deployed a UI change. Recalibrate via **Open Calibration**.

## Side panel does not open on Android
Quetta / Kiwi may not implement `chrome.sidePanel`. The popup falls back to opening `sidepanel.html` in a normal tab — same UI.

## Downloads land in flat Downloads folder instead of `AI_Content_Hub/...`
Some mobile builds block sub-folders for security. The extension auto-falls back to flat filenames so files are never lost.

## "login_required" / "captcha" / "quota" / "moderation" / "rate_limit"
The extension detected one of these on the Grok page. Resolve it in the Grok tab (log in, complete CAPTCHA, wait) and click **Resume**.

## Edit Export plays but the file won't open
Output is **WebM** (VP9/VP8). Most players support it; if a target app does not, transcode to MP4 with an offline converter — we avoid bundling FFmpeg.wasm (~30 MB) for mobile-friendliness.

## Auto-download didn't fire
- Settings → **Auto-Download** must be checked.
- Some mobile builds require a foreground tap before downloads can start.
- Run **Download → Download Finished** manually.

## Reset everything
Settings → **Reset Calibration** + **Clear Logs**. To fully reset, **Remove** the extension and reload it.

## Service Worker keeps restarting
Manifest V3 service workers idle out after ~30 s. State is stored in `chrome.storage.local` and resumed on demand — this is normal.
