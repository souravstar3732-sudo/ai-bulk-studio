# PRD — AI Bulk Generator Downloader Editor (Chrome MV3 Extension)

## Original problem statement
Build a complete working Manifest V3 Chrome/Chromium extension called **AI Bulk Generator Downloader Editor**. Purpose: bulk generate, bulk download, and batch edit AI videos/images from Grok Imagine and Google Flow/Veo. UI must be simple, mobile-friendly, large buttons, no complex dashboard, with four sections: Generate, Download, Edit, Settings. Includes calibration system, logs, project system, and downloadable ZIP package. Only automates visible website UI after the user is logged in — no bypass of auth/CAPTCHA/quota/moderation/watermark.

## Architecture
- **Manifest V3** + service worker (ES module)
- **Side panel** (4 tabs) + **popup** (quick status)
- **Content scripts** per platform: `grok.js`, `flow.js` + shared `common.js`
- **lib/** modules: storage, project, tracker, downloader, selectors, logger, editor (canvas + MediaRecorder)
- **Calibration page** with click-to-select picker (chrome.scripting + isolated world)
- Storage: `chrome.storage.local` (projects, settings, calibration, logs) + `chrome.storage.session` (picker bridge)

## User personas
- Solo content creator on **Android Chromium (Quetta/Kiwi)** doing bulk generations
- Desktop user on Chrome wanting headless-like bulk pipelines for Grok and Flow

## Core requirements (static)
- 4 sections only: Generate / Download / Edit / Settings
- Mobile-first, large tap targets, dark theme + amber accent (no purple slop)
- Native Bulk / Multi-Tab / Hybrid modes with Auto Router
- Result Card Tracker preserving prompt#↔card#↔file# order with fingerprint dedup
- Project system, calibration, logs, ZIP delivery
- Never bypass platform safeguards or watermarks

## Implemented (2026-01-12)
- ✅ Manifest V3 with side panel, content scripts, downloads, scripting, storage, alarms
- ✅ Background service worker: GEN/DOWNLOAD/SETTINGS/SELECTORS/PROJECT/LOG routers, auto-router, pump loop, CS report handler, layout watcher, block detection bridge
- ✅ Content scripts (Grok + Flow): native bulk attempt, sequential fallback, image attachments (start/end), result card scanning, fingerprinting, block detection (login/CAPTCHA/quota/moderation/rate-limit), polling reporter
- ✅ Side panel UI (vanilla JS, mobile-friendly, large buttons) covering all 4 tabs, all spec'd controls and buttons with data-testid attributes
- ✅ Calibration page: click-to-select picker with element outline + element fingerprint; test/clear/save/reset/import/export
- ✅ Editor: Canvas + MediaRecorder pipeline — preset crop, zoom, sharpen (convolution), brightness/contrast (canvas filter), trim, border, fade, text overlay, batch export, preview
- ✅ Project system: create/save/load/delete/export/import; auto active project
- ✅ Tracker: state machine (pending→submitted→generating→completed→downloaded plus failed/missing/skipped) with fingerprint
- ✅ Downloader: rename `<project>_<platform>_<method>_NNN.<ext>`, folder organization `AI_Content_Hub/<Plat>/<Project>/`, flat fallback for mobile, dedup
- ✅ Logger ring buffer with export
- ✅ Documentation: README, INSTALL, TESTING_CHECKLIST, TROUBLESHOOTING, PRIVACY, CHANGELOG
- ✅ Icons (16/32/48/128) generated programmatically
- ✅ ZIP at `/app/extension.zip` (52 KB)
- ✅ Lint clean; static UI screenshot validated all 4 tabs render correctly at 420 px mobile width

## Acceptance tests (must be verified by user after `Load unpacked`)
Refer to `extension/TESTING_CHECKLIST.md`. The extension cannot be fully end-to-end tested in this sandbox because it requires a real Chrome/Chromium instance loading via `chrome://extensions` and a logged-in Grok/Flow session — both of which only the user can provide.

## Prioritized backlog
**P1**
- [ ] Real-world calibration tuning after first run on live Grok and Flow UIs (selectors may need adjustment)
- [ ] Smart Concurrency: extend probe to measure real generation throughput per platform and persist optimal worker count

**P2**
- [ ] Optional FFmpeg.wasm desktop-enhanced edit mode (MP4 H.264 output) for power users
- [ ] IndexedDB-backed project store for very large prompt lists / image sets

**P3**
- [ ] Notifications when a long batch completes (uses `notifications` permission already declared)
- [ ] Cloud-free shareable project file format with prompt + image bundle

## Next tasks
1. User loads `extension/` via `chrome://extensions` → Load unpacked, or installs `extension.zip` on Quetta/Kiwi.
2. User runs 13 acceptance tests from `TESTING_CHECKLIST.md`.
3. Iterate on calibration selectors per real-world Grok/Flow DOM.
