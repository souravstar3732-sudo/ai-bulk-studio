# Changelog

## 1.0.3 — 2026-01-12

### Changed
- **Grok-only build.** Google Flow / Veo removed from this extension entirely (host permissions, content script, UI, settings, calibration, docs). A separate Flow build can be produced on the same architecture if requested.
- Extension renamed: **Grok Bulk Studio**.
- Manifest host permissions now: `grok.com`, `*.grok.com`, `x.com/i/grok*`, `x.com/grok*` only.
- Side panel platform selector removed; "Scan All Flow Tabs" and "Calibrate Flow" buttons removed.

### Fixed
- **"Could not establish connection. Receiving end does not exist."** — `waitForCs` now manually injects the content scripts via `chrome.scripting.executeScript` when the initial ping reports "Receiving end" (handles the case where the Grok tab is still loading or `run_at: document_idle` hasn't fired yet).
- `ensureGrokTab` waits for the Grok tab's `status: complete` before any CS messaging.

### Improved
- Pump pauses with a clear "Grok content script not reachable. Make sure you're at grok.com (logged in), then click Resume" if the CS still can't be reached after 25 s.
- Default Grok selectors widened with `imagine` data-testid and aria patterns.

## 1.0.2 — 2026-01-12

### Added
- **Diagnose Page**, **Validate Selectors**, **Open Calibration** buttons on the Generate tab.
- Pre-flight check before Start Bulk validates that prompt input + generate button exist.
- Heuristic auto-find for prompt input and generate button as last-resort fallback.

### Improved
- `fireInput` uses 3 strategies with read-back verification (native value setter, execCommand insertText, InputEvent).

## 1.0.1 — 2026-01-12

### Fixed
- `Cannot read properties of undefined (reading 'forceNew')` crash on first Start Bulk.
- Pump no longer silently marks every prompt FAILED on selector miss; pauses with calibration banner.

### Improved
- Stronger default Grok/Flow selectors with `_version` migration.
- Inline calibration banner with "Calibrate now" button.

## 1.0.0 — 2026-01

Initial release with both Grok and Flow adapters.
