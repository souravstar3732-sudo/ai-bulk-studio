# Changelog

## 1.1.0 — 2026-01-12 (major UI overhaul)

### Changed
- **Full UI redesign** to match a focused 3-tab automation flow: **Control / Setting / Debug Logs**. Mint accent on dark ink. Mode pill buttons. Bottom action bar (Report Bug · Clear · Run). No more 4-tab layout, no Edit tab in this build.
- **Mode selection as pill buttons**: Text to Video · Frame to Video · Ingredients to Video · Text to Image · Image to Image.
- **Random Delay (min/max seconds)** between prompts replaces the fixed delay.
- **Concurrent Prompts** dropdown (1–4) drives the multi-tab worker count.
- **Outputs per Prompt** (1/2/4) — informs Grok of how many variations to make per prompt.
- **Save to folder** custom subfolder name (default `grok-folder-1`).
- **Auto change file name** toggle controls whether the downloader renames files or keeps the original Grok filename.
- **Upload .txt / .csv** prompt loaders (xlsx parsing not bundled; CSV first-column supported).
- **Prompt Queue** live section with active-count badge.
- **Debug Logs tab** consolidates Validate Selectors + Diagnose Page + log viewer + export.
- **Settings tab**: Default Mode, Image Model (Quality / Fast), Default Aspect Ratio (9:16 / 16:9 / 1:1), Default Video Option (6s / 10s / concat), Default Image Mode Option, Max Retries on Failure stepper (1–20), Auto Download Quality Video (480p / 720p / 1080p), Auto Download Quality Image (1k / 2k / 4k).

### Kept under the hood
- Pre-flight VALIDATE_SELECTORS check before every Run.
- Calibration page with click-to-select picker + import/export.
- Heuristic auto-find for prompt input + generate button.
- React-safe `fireInput` with 3 insertion strategies + read-back.
- Result Card Tracker with fingerprint dedup.
- Auto-download to `AI_Content_Hub/Grok/<saveFolder>/` (flat fallback on mobile).
- Project export/import.

## 1.0.3 — 2026-01-12

Grok-only build: removed Google Flow / Veo. Hardened `waitForCs` to auto-inject content scripts when needed.

## 1.0.2 — 2026-01-12

Added Diagnose Page / Validate Selectors / Pre-flight check / Heuristic auto-find. Hardened `fireInput` with 3 strategies + verification.

## 1.0.1 — 2026-01-12

Fixed `forceNew` crash. Pre-flight pauses with calibration banner instead of silent FAILED.

## 1.0.0 — 2026-01

Initial release.
