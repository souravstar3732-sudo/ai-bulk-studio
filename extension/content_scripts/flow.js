// content_scripts/flow.js — Google Flow / Veo adapter
(function () {
  if (window.__bulkStudioFlowLoaded) return;
  window.__bulkStudioFlowLoaded = true;

  const CS = window.BulkStudioCS;
  const PLATFORM = "flow";
  let SEL = {};
  let layoutOff = null;

  async function loadSelectors() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["selectors"], ({ selectors }) => {
        SEL = (selectors && selectors[PLATFORM]) || {};
        resolve();
      });
    });
  }
  loadSelectors();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.selectors) loadSelectors();
  });

  async function tryNativeBulk(items, opts) {
    const bulkArea = CS.resolveSelector(SEL.bulkPromptArea);
    if (bulkArea) {
      const joined = items.map((it, i) => `${i + 1}. ${it.prompt}`).join("\n");
      CS.fireInput(bulkArea, joined);
      await CS.sleep(300);
      const runAll = CS.resolveSelector(SEL.runAllButton) || CS.resolveSelector(SEL.generateButton);
      if (runAll) {
        if (!opts.dryRun) runAll.click();
        return { ok: true, mode: "native-bulk" };
      }
    }
    return await sequentialSubmissions(items, opts);
  }

  async function sequentialSubmissions(items, opts) {
    let ok = 0;
    for (const it of items) {
      const input = CS.resolveSelector(SEL.promptInput);
      if (!input) return { ok: false, error: "prompt input not found" };
      CS.fireInput(input, it.prompt);
      await CS.sleep(180);

      if (opts.generationType === "image_to_video" || opts.generationType === "prompt_image") {
        const start = opts.startImages?.[it.idx - 1];
        if (start) {
          const fileIn = CS.resolveSelector(SEL.startImageUpload) || CS.resolveSelector(SEL.imageUpload);
          if (fileIn) await CS.attachFileToInput(fileIn, start);
          await CS.sleep(200);
        }
      }
      if (opts.generationType === "start_end_video") {
        const start = opts.startImages?.[it.idx - 1];
        const end   = opts.endImages?.[it.idx - 1];
        if (start) {
          const s = CS.resolveSelector(SEL.startImageUpload) || CS.resolveSelector(SEL.imageUpload);
          if (s) await CS.attachFileToInput(s, start);
          await CS.sleep(150);
        }
        if (end) {
          const e = CS.resolveSelector(SEL.endImageUpload);
          if (e) await CS.attachFileToInput(e, end);
          await CS.sleep(150);
        }
      }
      const gen = CS.resolveSelector(SEL.generateButton);
      if (!gen) return { ok: false, error: "generate button not found" };
      if (!opts.dryRun) gen.click();
      ok++;
      await CS.sleep(900);
    }
    return { ok: true, mode: "sequential", submitted: ok };
  }

  function pickMediaUrl(el) {
    if (!el) return null;
    if (el.tagName === "VIDEO") return el.currentSrc || el.src || (el.querySelector("source")?.src);
    if (el.tagName === "IMG")   return el.currentSrc || el.src;
    const v = el.querySelector("video"); if (v) return v.currentSrc || v.src;
    const i = el.querySelector("img");   if (i) return i.currentSrc || i.src;
    return null;
  }

  async function scanResultCards() {
    const candidates = [
      ...CS.resolveAll(SEL.resultCardArea),
      ...CS.resolveAll(SEL.videoArea),
      ...CS.resolveAll(SEL.imageArea)
    ];
    const items = [];
    let idx = 0;
    for (const el of candidates) {
      if (!CS.isVisible(el)) continue;
      const url = pickMediaUrl(el);
      if (!url) continue;
      const fp = await CS.fingerprintEl(el);
      const isVideo = !!(el.tagName === "VIDEO" || el.querySelector?.("video"));
      const ready = isVideo
        ? !!(el.querySelector?.("video")?.duration || el.duration)
        : !!(el.complete || el.naturalWidth);
      items.push({
        idx: ++idx,
        kind: isVideo ? "video" : "image",
        mediaUrl: url,
        thumb: el.poster || (el.querySelector?.("img")?.src),
        fingerprint: fp,
        status: ready ? "completed" : "generating"
      });
    }
    return items;
  }

  function detectBlocks() {
    const text = document.body.innerText || "";
    if (/sign in|log in/i.test(text) && /google/i.test(text)) return "login_required";
    if (/captcha|verify you are human/i.test(text)) return "captcha";
    if (/quota|limit reached|out of credits|upgrade/i.test(text)) return "quota";
    if (/moderation|policy|not allowed/i.test(text)) return "moderation";
    if (/rate\s*limit|too many requests/i.test(text)) return "rate_limit";
    return null;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        const t = msg?.type;
        if (t === "PING_CS") { sendResponse({ ok: true, platform: PLATFORM }); return; }

        if (t === "RUN_BATCH") {
          const block = detectBlocks();
          if (block) { sendResponse({ ok: false, error: block });
            CS.notifyBg({ kind: block, platform: PLATFORM, message: "Detected " + block }); return; }
          const p = msg.payload || {};
          let res;
          if (p.mode === "native") res = await tryNativeBulk(p.prompts, p);
          else                     res = await sequentialSubmissions(p.prompts, p);
          if (layoutOff) layoutOff();
          layoutOff = CS.watchLayout((SEL.resultCardArea && (Array.isArray(SEL.resultCardArea) ? SEL.resultCardArea[0] : SEL.resultCardArea)) || "main", 10000, () => {
            CS.notifyBg({ kind: "layout_change", platform: PLATFORM, message: "Result area selector missing" });
          });
          pollResultsLoop(p.prompts);
          sendResponse(res);
          return;
        }

        if (t === "SCAN_RESULTS") {
          const items = await scanResultCards();
          sendResponse({ ok: true, items });
          return;
        }

        if (t === "DETECT_BLOCK") {
          sendResponse({ ok: true, block: detectBlocks() });
          return;
        }

        sendResponse({ ok: false, error: "unknown CS type: " + t });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  });

  let polling = null;
  function pollResultsLoop(promptsBatch) {
    if (polling) clearInterval(polling);
    const promptIdxByOrder = (promptsBatch || []).map(p => p.idx);
    polling = setInterval(async () => {
      const items = await scanResultCards();
      const reportItems = items.map((it, i) => ({
        idx: promptIdxByOrder[i] ?? it.idx,
        cardId: it.idx,
        status: it.status,
        mediaUrl: it.mediaUrl,
        thumb: it.thumb,
        fingerprint: it.fingerprint
      }));
      if (reportItems.length) {
        CS.notifyBg({ kind: "card_update", platform: PLATFORM, items: reportItems });
      }
      const block = detectBlocks();
      if (block) {
        CS.notifyBg({ kind: block, platform: PLATFORM, message: "Detected " + block });
        clearInterval(polling); polling = null;
      }
    }, 3000);
    setTimeout(() => { if (polling) { clearInterval(polling); polling = null; } }, 8 * 60 * 1000);
  }
})();
