# Privacy Policy

**Effective:** 2026-01

**Grok Bulk Studio** ("the Extension") is a personal productivity tool that automates only the visible UI of websites you are already logged into.

## What the Extension does

- Injects content scripts on **Grok** (`grok.com`, `*.grok.com`, `x.com/i/grok*`, `x.com/grok*`) to read on-page elements (prompt input, generate button, media URLs, result cards).
- Stores **only on your device** (via `chrome.storage.local`): your projects, prompts, image previews you supplied, calibration selectors, settings, and logs.
- Uses `chrome.downloads` to save files to your Downloads folder.

## What the Extension does NOT do

- It does not transmit your prompts, images, projects, logs, or any data to any remote server.
- It does not contain analytics, telemetry, or third-party SDKs.
- It does not bypass authentication, CAPTCHA, quotas, paywalls, moderation, or watermarking.
- It does not access tabs other than the declared Grok hosts.
- It does not read your browsing history or cookies of unrelated sites.

## Data retention

All data is stored locally and can be deleted any time:
- **Settings → Clear Logs** removes the log store.
- **Settings → Reset Calibration** restores default selectors.
- **Remove** the extension from `chrome://extensions` to wipe all extension data.

## Third parties

The Extension communicates only with the websites you visit (Grok). Refer to Grok / xAI privacy policies for how they process your prompts and outputs.

## Contact

This is an unbranded personal-use tool. There is no support email; raise issues on the source repository.
