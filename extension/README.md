# AI Bulk Generator Downloader Editor

A Manifest V3 Chrome/Chromium extension that lets you **bulk generate, bulk download, and batch edit** AI videos/images from **Grok Imagine** and **Google Flow / Veo**.

Built for both **Chrome desktop** and **Android Chromium (Quetta/Kiwi)** — mobile-first side panel UI, large buttons, no complex dashboard.

> This tool automates only the visible website UI **after you are logged in**. It does **not** bypass login, CAPTCHA, rate limits, quota, subscription, moderation, or any platform safeguard. It does not remove or hide watermarks. It does not post to social media. It does not create fake accounts.

---

## Quick Start (60 seconds)

1. Install (see `INSTALL.md`).
2. Open Grok Imagine or Google Flow/Veo and log in normally.
3. Click the extension icon → **Open Side Panel**.
4. **Generate** tab → choose platform + type + method → paste prompts (1 per line) → **Start Bulk**.
5. **Download** tab → **Scan Current Page** to capture finished results, or let auto-download handle it.
6. **Edit** tab → pick videos → choose preset (9:16 / 1:1 / 16:9) → **Export Batch**.

---

## What's inside

- `manifest.json` — Manifest V3 declaration, side panel, content scripts, downloads, scripting.
- `background/service_worker.js` — orchestration, project state, result-card tracker, downloads, auto-router.
- `content_scripts/` — Grok + Flow adapters with calibrated selectors, layout watcher, block detection.
- `sidepanel/` — 4-tab UI (Generate / Download / Edit / Settings).
- `popup/` — quick status + open side panel.
- `pages/calibration.*` — click-to-select calibrator with per-platform store + import/export.
- `lib/` — storage, project, tracker, downloader, selectors, editor (Canvas + MediaRecorder), logger.
- `icons/` — bundled PNGs.

---

## Modes

- **Native Bulk (default)** — paste 2–50 prompts; inserts all into the platform bulk area if available, otherwise rapidly queues sequential submissions in the same tab.
- **Multi-Tab** — opens multiple platform tabs and feeds one prompt or small batch into each.
- **Hybrid** — multiple tabs each running a native bulk batch (e.g. 2 × 25 = 50).
- **Auto Mode Router** — picks the right method based on batch size and platform health.

## Smart features

- Site Health Detector (login/CAPTCHA/quota/moderation/rate-limit pause + warn)
- Result Card Tracker with stable fingerprints (URL+dimensions hashed)
- Image-to-prompt mapping guard (prompt 1 ↔ image 1)
- Batch splitter (100 prompts ÷ batch 50 → 2 batches, numbering 001–100)
- Resume engine (auto saves on every step; reopen after refresh/crash)
- Tab recovery (replaces stuck tabs in multi-tab mode)
- Layout change watcher (pauses + asks recalibration)
- Duplicate protection (warns on duplicate prompts, dedups downloads by fingerprint)
- Failed prompt analyzer + Auto Retry with smart delay
- Project backup/restore (export/import JSON)
- Debug Report (export logs as plain text)

## Edit features

- Presets: Vertical 9:16, Square 1:1, Landscape 16:9, Custom
- Auto centre crop with light zoom (none / 3% / 5% / 8%)
- Trim start/end, Brightness, Contrast, Sharpen (low / medium)
- Optional text overlay, simple border, fade in/out
- Batch export, naming `<project>_edited_001.webm` …
- Preserves originals; lightweight Canvas + MediaRecorder (no FFmpeg.wasm bundling) so it works on mobile.

---

## File naming

- Generated downloads: `<project>_<platform>_<method>_001.<ext>`
- Edited exports:      `<project>_edited_001.webm`
- Folders (when supported): `AI_Content_Hub/Grok/<Project>/`, `AI_Content_Hub/Flow/<Project>/`, `AI_Content_Hub/Edited/<Project>/`
- If Android mobile blocks sub-folders, the extension transparently retries flat into the default Downloads folder.

---

## Permissions explained

| Permission | Why |
|---|---|
| `storage` | Save projects, settings, calibration, logs |
| `tabs` | Discover/open Grok/Flow tabs, track per-tab state |
| `scripting` | Inject calibration picker + page actions on demand |
| `downloads` | Save generated and edited files |
| `sidePanel` | Render the main 4-tab UI |
| `activeTab` | Operate on the currently open Grok/Flow tab |
| `alarms` | Periodic polling and timeouts |
| `notifications` | Optional status pings |
| `unlimitedStorage` | Project history can be large |
| Host: grok.com, x.com, labs.google, flow.google.com | Inject the bulk/scan content scripts |

The extension **only injects** into Grok and Google Flow domains. It cannot read other sites.

---

## Build & install

See `INSTALL.md`.

## Test

See `TESTING_CHECKLIST.md`.

## Troubleshoot

See `TROUBLESHOOTING.md`.

## Privacy

See `PRIVACY.md`.

## Changelog

See `CHANGELOG.md`.
