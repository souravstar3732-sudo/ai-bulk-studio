# Testing Checklist (Grok-only build)

## A. Install & boot
- [ ] Loads with no console errors on `chrome://extensions` (Service worker → inspect).
- [ ] Popup opens; **Open Side Panel** works (or opens sidepanel page on mobile).
- [ ] Side panel shows 4 tabs: Generate / Download / Edit / Settings.
- [ ] Mobile (Quetta/Kiwi): all buttons large, no overflow at 360 px.

## B. Reachability
- [ ] On a non-Grok tab: tap **Validate Selectors** → extension opens or focuses a Grok tab, waits for load, then reports either ✓ found selectors OR a clear "calibrate" message. No "Receiving end" error.
- [ ] **Diagnose Page** dumps textareas/buttons/file inputs/videos with selectors.

## C. Generation
1. **Grok Native Bulk** — paste 5 prompts → Start Bulk → either pre-flight pauses with calibration banner (default selectors miss) OR submits all 5 to Grok. After calibration, retry → multiple generations begin.
2. **Manual capture** — generate manually in Grok, then Download tab → Scan Current Page → finished media captured & downloaded.
3. **Image-to-video mapping** — Type=Image→Video, upload 2 images + 2 prompts → Prompt 1 with image 1, Prompt 2 with image 2.
4. **Batch splitter** — 100 prompts, batch 50 → 2 batches; filenames `001`–`100`.
5. **Recovery** — refresh the Grok tab mid-batch → reopen side panel → active project preserved → Resume continues.
6. **Duplicate warning** — paste 5 prompts with 2 identical → `gDupCount` shows 1.
7. **Dry Run** — submits no actual generations; tracker stays pending.

## D. Calibration
- [ ] **Open Calibration** → pick prompt input → Test FOUND → Save All.
- [ ] **Reset Calibration** restores default selectors.
- [ ] Export/import calibration JSON works.

## E. Edit
- [ ] Pick 3 videos → Preset 9:16, Zoom 5%, Sharpen Low → Export Batch → 3 files `<project>_edited_001.webm`…`_003.webm` saved.

## F. Robustness
- [ ] Login screen detected on Grok → extension auto-pauses with reason.
- [ ] CAPTCHA detected → auto-pauses.
- [ ] Quota / upgrade screen → auto-pauses.
- [ ] Rate limit → auto-pauses.
- [ ] Layout change (selector missing > 10 s) → warns + pauses + suggests recalibration.

## G. Data
- [ ] Project Export → JSON. Import restores prompts + tracker.
- [ ] Download Log Export → CSV.
- [ ] Logs Export → text file. Clear Logs empties the store.
