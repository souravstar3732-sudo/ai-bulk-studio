# Testing Checklist

Run through each test before considering the extension ready for daily use. **Acceptance** = matches the spec's 13 acceptance tests.

## A. Install & boot
- [ ] Loads with no console errors on `chrome://extensions` (Service worker → inspect).
- [ ] Icon visible. Popup opens.
- [ ] Side panel opens. All 4 tabs visible: Generate / Download / Edit / Settings.
- [ ] Mobile (Quetta/Kiwi): all buttons large, no overflow on 360px width.

## B. Acceptance Tests (spec §FINAL)

1. **Grok Native Bulk** — Generate tab → Platform=Grok, Type=Text→Video, Method=Native, Batch=5, paste 5 prompts → Start Bulk → page receives all 5; multiple generations begin; result cards appear in the tracker. *Expected*: status moves pending → submitted → generating → completed.
2. **Grok Download** — On a Grok page with finished results → Download tab → Scan Current Page → files saved with `<project>_grok_<method>_001.mp4` ordering. Folder = `AI_Content_Hub/Grok/<Project>/` (or flat on mobile).
3. **Manual Grok Capture** — Generate manually in Grok (without extension) → Download tab → Scan Current Page → finished media is captured and downloaded. Tracker shows `capturedManually: true`.
4. **Flow/Veo Native Bulk** — same as test 1 with Platform=Flow.
5. **Flow/Veo Download** — same as test 2 with Platform=Flow.
6. **Manual Flow Capture** — same as test 3 with Platform=Flow.
7. **Image-to-video mapping** — Type=Image→Video, upload 2 images + 2 prompts → Prompt 1 generates with image 1, Prompt 2 with image 2. Verify in mapping preview.
8. **Batch splitter** — Paste 100 prompts, Batch=50 → background splits into 2 batches; final filenames span `001`–`100` continuously.
9. **Edit** — Edit tab → pick 3 videos → Preset 9:16, Zoom 5%, Sharpen Low → Export Batch → 3 files `<project>_edited_001.webm` … `_003.webm` saved.
10. **Recovery** — During a batch refresh the Grok tab → reopen the extension → active project still present, tracker statuses preserved, Resume continues remaining prompts.
11. **Calibration reset/test** — Settings → Reset Calibration → defaults loaded. Open calibration page → Pick on Grok prompt input → Test shows "FOUND".
12. **Dry Run** — Generate tab → Dry Run Test → submits no actual generations; tracker stays `pending`; status pane logs OK.
13. **Duplicate prompt warning** — Paste 5 prompts where 2 are identical → status pane and `gDupCount` show "1 duplicates"; the duplicate index is logged after Start Bulk.

## C. Robustness
- [ ] Login screen detected → extension auto-pauses and shows reason.
- [ ] CAPTCHA detected → auto-pauses.
- [ ] Quota / upgrade screen detected → auto-pauses.
- [ ] Rate limit text detected → auto-pauses.
- [ ] Layout change (selector missing > 10s) → warns + pauses + suggests recalibration.

## D. Performance (mobile Quetta)
- [ ] 50 prompts with 5 in batch native → completes without browser OOM.
- [ ] Edit Export 1 × 30s clip → completes in reasonable time (≤ video length × 3).

## E. Data
- [ ] Project Export → JSON file saved. Re-import restores prompts + tracker.
- [ ] Download Log Export → CSV with idx/prompt/status/filename/fingerprint/mediaUrl rows.
- [ ] Logs Export → text file. Clear Logs empties the log store.
