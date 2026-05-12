# Grok Bulk Studio

A Manifest V3 Chrome/Chromium extension that lets you **bulk generate, bulk download, and batch edit** AI videos/images from **Grok Imagine**.

Built for both **Chrome desktop** and **Android Chromium (Quetta / Kiwi)** — mobile-first side panel UI, large buttons, no complex dashboard.

> Grok-only build. Google Flow / Veo is intentionally out of scope here — a separate Flow extension can be built on the same architecture.
>
> This tool automates only the visible website UI **after you are logged in** to Grok. It does **not** bypass login, CAPTCHA, rate limits, quota, subscription, moderation, or any platform safeguard. It does not remove or hide watermarks. It does not post to social media. It does not create fake accounts.

---

## Quick Start (60 seconds)

1. Install (see `INSTALL.md`).
2. Open `https://grok.com/imagine` and log in.
3. Click the extension icon → **Open Side Panel**.
4. **Generate** tab → choose Type + Method + Batch → paste prompts (1 per line) → **Start Bulk**.
5. **Download** tab → **Scan Current Page** / **Scan All Grok Tabs** to capture finished results, or let auto-download handle it.
6. **Edit** tab → pick videos → choose preset (9:16 / 1:1 / 16:9) → **Export Batch**.

If the first run says **"selectors not found"**, tap **Diagnose Page** then **Open Calibration** and bind the prompt input + generate button to the real elements on your Grok page.

---

## What's inside

- `manifest.json` — Manifest V3, side panel, content scripts, downloads, scripting; Grok host permissions only.
- `background/service_worker.js` — orchestration, project state, result-card tracker, downloads, calibration store, diagnose/validate helpers.
- `content_scripts/grok.js` (+ `common.js`) — Grok adapter: bulk paste / sequential insertion (3-strategy React-safe input writer), heuristic auto-find, result scanning, layout watcher, block detection.
- `sidepanel/` — 4-tab UI (Generate / Download / Edit / Settings) with Validate Selectors / Diagnose Page / Open Calibration helpers.
- `popup/` — quick status + open side panel.
- `pages/calibration.*` — click-to-select calibrator with import/export.
- `lib/` — storage, project, tracker, downloader, selectors, editor (Canvas + MediaRecorder), logger.
- `icons/` — bundled PNGs.

---

## Modes

- **Native Bulk (default)** — paste 2–50 prompts; inserts all into the platform bulk area if available, otherwise rapidly queues sequential submissions in the same tab.
- **Multi-Tab** — opens multiple Grok tabs and feeds one prompt or small batch into each.
- **Hybrid** — multiple tabs each running a native bulk batch (e.g. 2 × 25 = 50).
- **Auto Mode Router** — picks the right method based on batch size.

## Smart features

- **Pre-flight check** — before sending a single prompt, the side panel validates that the prompt input and generate button are reachable on Grok. If not, it stops and shows a one-tap "Calibrate now" banner.
- **Diagnose Page** — dumps every visible textarea, contenteditable, button, file input, video on the active Grok page with the exact CSS selector for each. Fastest way to see *what's actually there*.
- **Validate Selectors** — quick check that the calibrated prompt input + generate button are findable.
- **Heuristic auto-find** — when calibrated selectors miss, the extension scores candidate elements (placeholder/aria/testid/size/proximity) to pick a likely prompt input and generate button automatically.
- **React-safe input** — 3 insertion strategies (native value setter → execCommand insertText → InputEvent) with read-back verification.
- Site Health Detector (login/CAPTCHA/quota/moderation/rate-limit pause + warn).
- Result Card Tracker with stable SHA-1 fingerprints (URL+dimensions).
- Image-to-prompt mapping (prompt 1 ↔ image 1).
- Batch splitter (100 prompts ÷ batch 50 → 2 batches, numbering 001–100).
- Resume engine; tab recovery; layout change watcher.
- Duplicate prompt warning, dedup-by-fingerprint downloads.
- Project backup/restore (JSON export/import).
- Debug Report (export logs).

## Edit features

- Presets: Vertical 9:16, Square 1:1, Landscape 16:9, Custom
- Auto centre crop with light zoom (none / 3% / 5% / 8%)
- Trim start/end, Brightness, Contrast, Sharpen (low / medium)
- Optional text overlay, simple border, fade in/out
- Batch export, naming `<project>_edited_001.webm` …
- Preserves originals; lightweight Canvas + MediaRecorder (no FFmpeg.wasm bundling) so it works on mobile.

---

## File naming

- Generated downloads: `<project>_grok_<method>_001.<ext>`
- Edited exports:      `<project>_edited_001.webm`
- Folders (when supported): `AI_Content_Hub/Grok/<Project>/`, `AI_Content_Hub/Edited/<Project>/`
- If Android mobile blocks sub-folders, the extension transparently retries flat into the default Downloads folder.

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save projects, settings, calibration, logs |
| `tabs` | Discover/open Grok tabs, track per-tab state |
| `scripting` | Inject calibration picker + content scripts on demand |
| `downloads` | Save generated and edited files |
| `sidePanel` | Render the main 4-tab UI |
| `activeTab` | Operate on the currently open Grok tab |
| `alarms` | Periodic polling and timeouts |
| `notifications` | Optional status pings |
| `unlimitedStorage` | Project history can be large |
| Hosts: `grok.com`, `*.grok.com`, `x.com/i/grok*`, `x.com/grok*` | Inject the bulk/scan content scripts |

The extension **only injects** into Grok domains. It cannot read or run on other sites.

---

See `INSTALL.md`, `TESTING_CHECKLIST.md`, `TROUBLESHOOTING.md`, `PRIVACY.md`, `CHANGELOG.md`.
