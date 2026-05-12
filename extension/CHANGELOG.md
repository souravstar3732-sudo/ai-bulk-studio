# Changelog

## 1.0.1 — 2026-01-12 (hot-fix)

### Fixed
- **Critical**: `Cannot read properties of undefined (reading 'forceNew')` crash on first Start Bulk after extension load. Root cause: side panel sent project fields flat in `payload` but the service worker read `payload.project` (undefined). Now `Project.upsertActive` handles `undefined` defensively and the service worker passes `payload` correctly.
- Pump no longer silently marks every prompt as FAILED when the content script can't find the prompt input / generate button. It now **pauses** and surfaces a "Calibration required" banner that opens the right calibration page in one tap.

### Improved
- Default Grok selectors now include `[data-testid="imagine-prompt-input"]` and `[data-testid="submit-button"]` first, with broader fallbacks for newer Grok UI patterns.
- Default Flow selectors include start/end frame data-testid patterns.
- Selectors carry a `_version` field. On extension update, stored selectors auto-migrate to the latest defaults if the version differs (unless you've already calibrated manually).
- Side panel listens for `PAUSE_REASON: needs_calibration` and `LAYOUT_CHANGE` and shows an inline amber banner with a "Calibrate now" button.
- Starting a new Bulk run hides any prior calibration banner.

## 1.0.0 — 2026-01

Initial release.

### Added
- Manifest V3 extension with side panel + popup
- Grok Imagine and Google Flow/Veo adapters (content scripts)
- Generation: Native Bulk, Multi-Tab, Hybrid (Auto Router)
- Generation types: Text→Video, Text→Image, Image→Video, Start+End Frame, Prompt+Image
- Result Card Tracker with fingerprints, status state machine
- Auto-Download with rename + folder organisation (with flat fallback for mobile)
- Manual Capture: Scan Current Page / All Grok / All Flow tabs
- Project system: create / save / load / delete / export / import
- Calibration: click-to-select picker with per-platform store + import/export
- Settings: defaults, delays, retries, workers, mobile lightweight, logs
- Editor: presets, zoom, sharpen, brightness/contrast, trim, fade, border, overlay, batch
- Logs with export
- Layout change watcher, block detectors (login/captcha/quota/moderation/rate-limit)
- Duplicate prompt warning, dedup-by-fingerprint downloads
- Smart Concurrency probe (mobile-safe defaults)
- Documentation: README, INSTALL, TESTING_CHECKLIST, TROUBLESHOOTING, PRIVACY, CHANGELOG
