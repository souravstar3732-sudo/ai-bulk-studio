// AI Bulk Studio — Background Service Worker (Manifest V3, ES module)
// Orchestrates: projects, prompts/result tracker, downloads, tab fanout,
// content-script command bus, calibration store, logs, recovery.

import { Storage }   from "../lib/storage.js";
import { Logger }    from "../lib/logger.js";
import { Project }   from "../lib/project.js";
import { Tracker }   from "../lib/tracker.js";
import { Downloader } from "../lib/downloader.js";
import { DEFAULT_SELECTORS } from "../lib/selectors.js";

// ---------- Boot ----------
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

chrome.runtime.onInstalled.addListener(async () => {
  await Storage.initDefaults({
    settings: {
      defaultPlatform: "grok",
      defaultType: "text_to_video",
      defaultMethod: "auto",
      defaultBatch: 5,
      defaultProjectName: "MyProject",
      delayMs: 1200,
      timeoutMs: 90000,
      retries: 2,
      workers: 2,
      smartConcurrency: true,
      autoMode: true,
      dryRun: false,
      autoDownload: true,
      renameFiles: true,
      avoidDuplicates: true,
      scanAllTabs: true,
      editPreset: "9:16",
      editZoom: 5,
      editSharpen: "low",
      mobileLightweight: true,
      logsEnabled: true
    },
    selectors: DEFAULT_SELECTORS,
    projects: {},
    activeProjectId: null,
    logs: []
  });
  Logger.info("Installed v1.0.0");
  // Enable side panel auto-open on action click on supported Chrome
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {}
});

// ---------- Message Router ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const t = msg?.type;
      switch (t) {
        case "GET_STATUS": {
          const proj = await Project.getActive();
          const counts = proj ? Tracker.counts(proj.tracker || []) : {};
          sendResponse({ ok: true, project: proj, counts });
          break;
        }
        case "PROJECT_LIST":
          sendResponse({ ok: true, list: await Project.list() }); break;
        case "PROJECT_CREATE":
          sendResponse({ ok: true, project: await Project.create(msg.payload) }); break;
        case "PROJECT_LOAD":
          sendResponse({ ok: true, project: await Project.load(msg.id) }); break;
        case "PROJECT_SAVE":
          sendResponse({ ok: true, project: await Project.save(msg.project) }); break;
        case "PROJECT_DELETE":
          sendResponse({ ok: true, removed: await Project.remove(msg.id) }); break;
        case "PROJECT_EXPORT":
          sendResponse({ ok: true, json: await Project.exportAll() }); break;
        case "PROJECT_IMPORT":
          sendResponse({ ok: true, count: await Project.importAll(msg.json) }); break;

        case "SETTINGS_GET":
          sendResponse({ ok: true, settings: (await Storage.get(["settings"])).settings }); break;
        case "SETTINGS_SET":
          await Storage.merge("settings", msg.settings);
          sendResponse({ ok: true }); break;

        case "SELECTORS_GET":
          sendResponse({ ok: true, selectors: (await Storage.get(["selectors"])).selectors }); break;
        case "SELECTORS_SET":
          await Storage.merge("selectors", msg.selectors);
          sendResponse({ ok: true }); break;
        case "SELECTORS_RESET":
          await Storage.set({ selectors: DEFAULT_SELECTORS });
          sendResponse({ ok: true, selectors: DEFAULT_SELECTORS }); break;

        case "GEN_START":
          sendResponse(await startGeneration(msg.payload)); break;
        case "GEN_PAUSE":
          state.paused = true; sendResponse({ ok: true }); break;
        case "GEN_RESUME":
          state.paused = false; sendResponse({ ok: true }); pump(); break;
        case "GEN_STOP":
          state.stopped = true; state.paused = false;
          sendResponse({ ok: true }); break;
        case "GEN_RETRY_FAILED":
          sendResponse(await retryFailed()); break;

        case "DOWNLOAD_SCAN":
          sendResponse(await scanAndDownload(msg.payload || {})); break;
        case "DOWNLOAD_FILE":
          sendResponse(await Downloader.downloadOne(msg.payload)); break;
        case "DOWNLOAD_LOG_EXPORT":
          sendResponse({ ok: true, log: await Project.exportDownloadLog() }); break;
        case "OPEN_DOWNLOADS":
          chrome.downloads.showDefaultFolder();
          sendResponse({ ok: true }); break;

        case "LOG_GET":
          sendResponse({ ok: true, logs: (await Storage.get(["logs"])).logs || [] }); break;
        case "LOG_CLEAR":
          await Storage.set({ logs: [] }); sendResponse({ ok: true }); break;

        case "OPEN_TAB":
          chrome.tabs.create({ url: msg.url, active: !!msg.active });
          sendResponse({ ok: true }); break;

        case "CALIBRATE_OPEN":
          chrome.tabs.create({ url: chrome.runtime.getURL("pages/calibration.html") + "?platform=" + (msg.platform || "grok") });
          sendResponse({ ok: true }); break;

        case "CS_REPORT":
          // Content scripts report card statuses, layout changes, errors
          await handleCsReport(msg.payload, sender);
          sendResponse({ ok: true }); break;

        case "PING":
          sendResponse({ ok: true, pong: Date.now() }); break;

        default:
          sendResponse({ ok: false, error: "Unknown message type: " + t });
      }
    } catch (e) {
      Logger.error("router", e);
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // async
});

// ---------- Generation State Machine ----------
const state = {
  running: false,
  paused: false,
  stopped: false,
  projectId: null,
  currentBatch: 0,
  workerTabs: []
};

async function startGeneration(payload) {
  // payload: { project, prompts, method, batchSize, generationType, startImages?, endImages?, dryRun? }
  const project = await Project.upsertActive(payload.project);
  state.running = true; state.paused = false; state.stopped = false;
  state.projectId = project.id;

  // Build tracker entries (one per prompt) — preserve order
  const prompts = (payload.prompts || []).map(s => (s || "").trim()).filter(Boolean);
  if (!prompts.length) return { ok: false, error: "No prompts provided." };

  // Duplicate warning
  const seen = new Set();
  const dups = [];
  prompts.forEach((p, i) => {
    const k = p.toLowerCase();
    if (seen.has(k)) dups.push({ index: i + 1, prompt: p });
    seen.add(k);
  });

  project.tracker = Tracker.buildEntries(prompts, payload);
  project.method = payload.method || project.method || "auto";
  project.generationType = payload.generationType || project.generationType || "text_to_video";
  project.batchSize = payload.batchSize || project.batchSize || 5;
  project.platform = payload.platform || project.platform || "grok";
  project.startImages = payload.startImages || [];
  project.endImages   = payload.endImages   || [];
  project.updatedAt = Date.now();

  await Project.save(project);
  Logger.info(`Generation start: project=${project.name} platform=${project.platform} method=${project.method} batch=${project.batchSize} prompts=${prompts.length}`);

  // Run pump (non-blocking) — sendResponse must return quickly.
  pump().catch(e => Logger.error("pump", e));
  return { ok: true, projectId: project.id, duplicates: dups, dryRun: !!payload.dryRun };
}

async function pump() {
  if (state.paused || state.stopped) return;
  const project = await Project.getActive();
  if (!project) return;

  const settings = (await Storage.get(["settings"])).settings;
  const method = autoRouteMethod(project, settings);
  Logger.info("Generation pump: method=" + method);

  const remaining = (project.tracker || []).filter(t => t.status === "pending");
  if (!remaining.length) {
    Logger.info("All prompts processed.");
    state.running = false;
    notifyUi({ type: "GEN_DONE" });
    return;
  }

  const batchSize = Math.min(project.batchSize || 5, 50);
  const batch = remaining.slice(0, batchSize);

  // Find or create platform tab
  const tab = await ensurePlatformTab(project.platform);

  // Wait until content script ready
  await waitForCs(tab.id, project.platform, 25000);

  // Dispatch batch to content script
  const csRes = await safeSendCs(tab.id, {
    type: "RUN_BATCH",
    payload: {
      mode: method, // "native", "multitab", "hybrid"
      generationType: project.generationType,
      prompts: batch.map(b => ({ idx: b.idx, prompt: b.prompt })),
      startImages: project.startImages,
      endImages: project.endImages,
      dryRun: !!settings.dryRun
    }
  }, 60000);

  if (!csRes || !csRes.ok) {
    // Mark as failed for this batch and retry per-item via multi-tab fallback
    Logger.warn("Native batch failed; falling back per-prompt: " + (csRes && csRes.error));
    for (const item of batch) {
      Tracker.update(project.tracker, item.idx, { status: "failed", error: (csRes && csRes.error) || "batch dispatch failed" });
    }
    await Project.save(project);
  } else {
    // CS reports per-card statuses via CS_REPORT. Optimistically mark submitted.
    for (const item of batch) {
      Tracker.update(project.tracker, item.idx, { status: "submitted", tabId: tab.id });
    }
    await Project.save(project);
  }

  // Wait small delay then continue if more
  if (state.paused || state.stopped) return;
  await sleep(settings.delayMs || 1200);
  pump();
}

function autoRouteMethod(project, settings) {
  const m = (project.method || "auto").toLowerCase();
  if (m !== "auto") return m;
  if (!settings.autoMode) return "native";
  // Default heuristics: native is most reliable when supported
  if ((project.batchSize || 5) <= 5) return "native";
  if ((project.batchSize || 5) <= 25) return "native";
  return "hybrid";
}

async function retryFailed() {
  const project = await Project.getActive();
  if (!project) return { ok: false, error: "no active project" };
  let count = 0;
  for (const t of project.tracker) {
    if (t.status === "failed" || t.status === "missing") {
      t.status = "pending"; t.error = null; count++;
    }
  }
  await Project.save(project);
  Logger.info(`Retry failed: ${count} prompts re-queued`);
  pump();
  return { ok: true, count };
}

// ---------- Tabs & Content Script Helpers ----------
async function ensurePlatformTab(platform) {
  const urlMatch = platform === "flow" ? "*://labs.google/*" : "*://grok.com/*";
  const tabs = await chrome.tabs.query({ url: urlMatch });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    return tabs[0];
  }
  const url = platform === "flow" ? "https://labs.google/flow" : "https://grok.com/imagine";
  return await chrome.tabs.create({ url, active: true });
}

function safeSendCs(tabId, msg, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; resolve({ ok: false, error: "cs timeout" }); } }, timeoutMs);
    try {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        if (done) return;
        done = true; clearTimeout(to);
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: false, error: "no response" });
        }
      });
    } catch (e) {
      if (!done) { done = true; clearTimeout(to); resolve({ ok: false, error: String(e) }); }
    }
  });
}

async function waitForCs(tabId, platform, maxMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await safeSendCs(tabId, { type: "PING_CS" }, 1500);
    if (r && r.ok) return true;
    await sleep(800);
  }
  return false;
}

// ---------- Content Script Reports ----------
async function handleCsReport(payload, sender) {
  // payload: { kind: 'card_update'|'layout_change'|'login_required'|'captcha'|'quota'|'moderation'|'rate_limit'|'error', items?, message? }
  const project = await Project.getActive();
  if (!project) return;
  const kind = payload?.kind;
  if (kind === "card_update" && Array.isArray(payload.items)) {
    for (const it of payload.items) {
      Tracker.update(project.tracker, it.idx, {
        status: it.status,
        cardId: it.cardId,
        mediaUrl: it.mediaUrl,
        thumb: it.thumb,
        fingerprint: it.fingerprint,
        error: it.error || null,
        updatedAt: Date.now()
      });
    }
    await Project.save(project);
    notifyUi({ type: "TRACKER_UPDATE" });
    // Auto-download finished
    const settings = (await Storage.get(["settings"])).settings;
    if (settings.autoDownload) {
      const ready = project.tracker.filter(t => t.status === "completed" && t.mediaUrl && !t.downloaded);
      for (const r of ready) {
        await Downloader.downloadOne({
          url: r.mediaUrl,
          name: Downloader.buildName(project, r),
          folder: Downloader.buildFolder(project)
        });
        r.downloaded = true; r.status = "downloaded";
        Tracker.update(project.tracker, r.idx, r);
      }
      await Project.save(project);
    }
  } else if (kind === "layout_change") {
    Logger.warn("Layout change detected: " + payload.message);
    notifyUi({ type: "LAYOUT_CHANGE", message: payload.message, platform: payload.platform });
    state.paused = true;
  } else if (["login_required","captcha","quota","moderation","rate_limit","error"].includes(kind)) {
    Logger.warn(kind + ": " + (payload.message || ""));
    state.paused = true;
    notifyUi({ type: "PAUSE_REASON", reason: kind, message: payload.message });
  }
}

// ---------- Download Scan ----------
async function scanAndDownload(opts) {
  const platform = opts.platform || "all";
  const scanAll  = opts.scanAll !== false;
  const tabs = await collectTargetTabs(platform, scanAll);
  if (!tabs.length) return { ok: false, error: "No matching tabs open." };
  let found = 0, downloaded = 0;
  const project = await Project.getActive();
  for (const tab of tabs) {
    await waitForCs(tab.id, detectPlat(tab.url), 8000);
    const r = await safeSendCs(tab.id, { type: "SCAN_RESULTS", payload: { project: project } }, 30000);
    if (r && r.ok && Array.isArray(r.items)) {
      found += r.items.length;
      for (const it of r.items) {
        if (!it.mediaUrl) continue;
        const dup = project && project.tracker.some(t => t.fingerprint && t.fingerprint === it.fingerprint && t.downloaded);
        if (dup) continue;
        const name = Downloader.buildName(project, it);
        const dl = await Downloader.downloadOne({
          url: it.mediaUrl,
          name,
          folder: Downloader.buildFolder(project)
        });
        if (dl.ok) downloaded++;
        if (project) {
          // Best-effort attach to a free tracker entry if idx exists
          const matchIdx = it.idx ?? null;
          if (matchIdx != null) {
            Tracker.update(project.tracker, matchIdx, {
              status: "downloaded", downloaded: true,
              fingerprint: it.fingerprint, mediaUrl: it.mediaUrl
            });
          } else {
            project.tracker.push({
              idx: project.tracker.length + 1,
              prompt: it.prompt || "(manual capture)",
              status: "downloaded",
              fingerprint: it.fingerprint,
              mediaUrl: it.mediaUrl,
              downloaded: true,
              capturedManually: true,
              updatedAt: Date.now()
            });
          }
        }
      }
      if (project) await Project.save(project);
    }
  }
  notifyUi({ type: "DL_DONE", found, downloaded });
  return { ok: true, found, downloaded, scanned: tabs.length };
}

async function collectTargetTabs(platform, scanAll) {
  if (!scanAll) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? [tab] : [];
  }
  if (platform === "grok") return chrome.tabs.query({ url: ["*://grok.com/*","*://*.grok.com/*"] });
  if (platform === "flow") return chrome.tabs.query({ url: ["*://labs.google/*","*://flow.google.com/*"] });
  // all
  const g = await chrome.tabs.query({ url: ["*://grok.com/*","*://*.grok.com/*"] });
  const f = await chrome.tabs.query({ url: ["*://labs.google/*","*://flow.google.com/*"] });
  return [...g, ...f];
}

function detectPlat(url){ if(!url) return "grok"; if(url.includes("grok")) return "grok"; if(url.includes("labs.google")||url.includes("flow.google")) return "flow"; return "grok"; }

// ---------- UI notifier ----------
function notifyUi(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// ---------- Utils ----------
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
