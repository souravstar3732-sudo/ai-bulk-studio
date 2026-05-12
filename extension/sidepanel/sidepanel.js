// sidepanel/sidepanel.js — main UI controller
// Communicates with background service worker via chrome.runtime.sendMessage.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ===== Tabs =====
const tabBtns = $$(".tab");
const panels = {
  generate: $("#tab-generate"),
  download: $("#tab-download"),
  edit:     $("#tab-edit"),
  settings: $("#tab-settings")
};
tabBtns.forEach(b => b.addEventListener("click", () => {
  tabBtns.forEach(x => x.classList.toggle("active", x === b));
  const name = b.dataset.tab;
  Object.entries(panels).forEach(([k,p]) => p.classList.toggle("active", k === name));
  if (name === "download") refreshTracker();
  if (name === "settings") loadSettings();
}));

// ===== Helpers =====
function send(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (resp) => resolve(resp || { ok: false }));
  });
}
function statusLine(id, text, kind = "info") {
  const el = $(id);
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] ${text}\n` + el.textContent;
  $("#bottomLog").textContent = text;
}

// ===== File → dataURL helper =====
function fileToObj(f) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res({ name: f.name, type: f.type, dataUrl: r.result });
    r.readAsDataURL(f);
  });
}

// ============== GENERATE TAB ==============
const gPlatform = $("#gPlatform");
const gType     = $("#gType");
const gMethod   = $("#gMethod");
const gBatch    = $("#gBatch");
const gProject  = $("#gProject");
const gPrompts  = $("#gPrompts");
const gPromptCount = $("#gPromptCount");
const gDupCount = $("#gDupCount");
const gStartImages = $("#gStartImages");
const gEndImages   = $("#gEndImages");
const mappingPreview = $("#mappingPreview");

gPrompts.addEventListener("input", updateMapping);
gStartImages.addEventListener("change", updateMapping);
gEndImages.addEventListener("change", updateMapping);

function getPromptsArr() {
  return gPrompts.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}
function updateMapping() {
  const list = getPromptsArr();
  gPromptCount.textContent = list.length;
  const seen = new Set(); let dups = 0;
  list.forEach(p => { const k = p.toLowerCase(); if (seen.has(k)) dups++; seen.add(k); });
  gDupCount.textContent = dups;

  // Preview map
  mappingPreview.innerHTML = "";
  const starts = Array.from(gStartImages.files || []);
  const ends   = Array.from(gEndImages.files || []);
  list.slice(0, 60).forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "map-row";
    const s = starts[i], e = ends[i];
    const sUrl = s ? URL.createObjectURL(s) : "";
    const eUrl = e ? URL.createObjectURL(e) : "";
    row.innerHTML = `
      <span class="num">${String(i+1).padStart(3,"0")}</span>
      <div class="thumb" style="background-image:url('${sUrl}')"></div>
      <div class="ptext" title="${p.replace(/"/g,'&quot;')}">${p}</div>
      <div class="thumb" style="background-image:url('${eUrl}')"></div>
    `;
    mappingPreview.appendChild(row);
  });
}

async function startBulk({ dryRun = false } = {}) {
  // Hide any prior calibration banner — user is starting a fresh attempt
  const banner = document.getElementById("calBanner");
  if (banner) banner.style.display = "none";

  const prompts = getPromptsArr();
  if (!prompts.length) { statusLine("#genStatus", "No prompts."); return; }
  const batchVal = gBatch.value === "custom" ? Number(prompt("Custom batch size:") || 5) : Number(gBatch.value);
  const project = {
    name: gProject.value || "Untitled",
    platform: gPlatform.value,
    generationType: gType.value,
    method: gMethod.value,
    batchSize: batchVal,
    prompts
  };
  // Convert images to dataURLs
  const sFiles = Array.from(gStartImages.files || []);
  const eFiles = Array.from(gEndImages.files || []);
  const startImages = await Promise.all(sFiles.map(fileToObj));
  const endImages   = await Promise.all(eFiles.map(fileToObj));

  statusLine("#genStatus", `Starting ${prompts.length} prompts on ${project.platform} (${project.method}, batch ${batchVal})${dryRun ? " — DRY RUN" : ""}`);
  const res = await send("GEN_START", { payload: { ...project, prompts, startImages, endImages, dryRun, platform: project.platform } });
  if (!res.ok) statusLine("#genStatus", "ERR: " + res.error);
  else {
    statusLine("#genStatus", `OK. ${res.duplicates?.length || 0} duplicates flagged.`);
    if (res.duplicates?.length) {
      statusLine("#genStatus", "Duplicates: " + res.duplicates.map(d => `#${d.index}`).join(", "));
    }
    await refreshActiveProjectSelect();
  }
}

$("#btnStart").addEventListener("click", () => startBulk());
$("#btnDryRun").addEventListener("click", () => startBulk({ dryRun: true }));
$("#btnPause").addEventListener("click", async () => { await send("GEN_PAUSE"); statusLine("#genStatus","Paused."); });
$("#btnResume").addEventListener("click", async () => { await send("GEN_RESUME"); statusLine("#genStatus","Resumed."); });
$("#btnStop").addEventListener("click",   async () => { await send("GEN_STOP"); statusLine("#genStatus","Stopped."); });
$("#btnRetry").addEventListener("click",  async () => {
  const r = await send("GEN_RETRY_FAILED"); statusLine("#genStatus", r.ok ? `Re-queued ${r.count}` : "ERR: " + r.error);
});
$("#btnSaveProj").addEventListener("click", async () => {
  const st = await send("GET_STATUS");
  if (st.ok && st.project) {
    await send("PROJECT_SAVE", { project: st.project });
    statusLine("#genStatus", "Project saved.");
  }
});
$("#btnSmart").addEventListener("click", async () => {
  // Lightweight smart concurrency probe — just times PING_CS round trips to multiple tabs.
  statusLine("#genStatus", "Probing concurrency …");
  const start = Date.now();
  const r = await send("PING");
  statusLine("#genStatus", `Background round-trip: ${Date.now()-start}ms. Suggested workers: 2 (mobile-safe).`);
});

// ============== DOWNLOAD TAB ==============
$("#dlScanCurrent").addEventListener("click", async () => doScan({ scanAll: false }));
$("#dlScanGrok").addEventListener("click",    async () => doScan({ scanAll: true, platform: "grok" }));
$("#dlScanFlow").addEventListener("click",    async () => doScan({ scanAll: true, platform: "flow" }));
$("#dlFinished").addEventListener("click",    async () => {
  const st = await send("GET_STATUS"); if (!st.project) { statusLine("#dlStatus","No active project"); return; }
  const ready = (st.project.tracker || []).filter(t => t.status === "completed" && !t.downloaded);
  for (const r of ready) {
    await send("DOWNLOAD_FILE", { payload: { url: r.mediaUrl, name: `${st.project.name}_${st.project.platform}_${st.project.method}_${String(r.idx).padStart(3,"0")}.${(r.kind==="image"?"png":"mp4")}`, folder: `AI_Content_Hub/${st.project.platform==="flow"?"Flow":"Grok"}/${st.project.name}` } });
  }
  statusLine("#dlStatus", `Sent ${ready.length} downloads.`);
  refreshTracker();
});
$("#dlRetryMiss").addEventListener("click", async () => {
  const st = await send("GET_STATUS"); if (!st.project) return;
  let n = 0;
  for (const t of (st.project.tracker || [])) {
    if ((t.status === "missing" || t.status === "failed") && t.mediaUrl) {
      await send("DOWNLOAD_FILE", { payload: { url: t.mediaUrl, name: `${st.project.name}_retry_${String(t.idx).padStart(3,"0")}.mp4` } });
      n++;
    }
  }
  statusLine("#dlStatus", `Retried ${n} missing.`);
});
$("#dlExportLog").addEventListener("click", async () => {
  const r = await send("DOWNLOAD_LOG_EXPORT");
  if (r.ok) downloadAsFile(r.log, "download_log.csv", "text/csv");
});
$("#dlOpenFolder").addEventListener("click", async () => { await send("OPEN_DOWNLOADS"); });

async function doScan(opts) {
  statusLine("#dlStatus", `Scanning${opts.scanAll ? " all tabs" : " current page"} (${opts.platform || "any"}) …`);
  const r = await send("DOWNLOAD_SCAN", { payload: opts });
  if (!r.ok) statusLine("#dlStatus", "ERR: " + r.error);
  else statusLine("#dlStatus", `Found ${r.found} · downloaded ${r.downloaded} · tabs ${r.scanned}`);
  refreshTracker();
}

async function refreshTracker() {
  const st = await send("GET_STATUS");
  const el = $("#trackerList"); el.innerHTML = "";
  if (!st.project) return;
  const items = (st.project.tracker || []).slice(0, 200);
  for (const t of items) {
    const row = document.createElement("div");
    row.className = "tracker-row";
    row.innerHTML = `
      <span class="idx">${String(t.idx).padStart(3,"0")}</span>
      <span class="p" title="${(t.prompt||"").replace(/"/g,'&quot;')}">${t.prompt || "(no prompt)"}</span>
      <span class="st ${t.status||"pending"}">${t.status||"pending"}</span>
    `;
    el.appendChild(row);
  }
}

// ============== EDIT TAB ==============
import { Editor } from "../lib/editor.js";

let editor = new Editor($("#edCanvas"));
let edFiles = [];
$("#edFiles").addEventListener("change", e => {
  edFiles = Array.from(e.target.files || []);
  statusLine("#edStatus", `${edFiles.length} videos selected.`);
});
function gatherEditOpts() {
  return {
    preset:  $("#edPreset").value,
    zoom:    Number($("#edZoom").value),
    sharpen: $("#edSharpen").value,
    brightness: Number($("#edBrightness").value),
    contrast:   Number($("#edContrast").value),
    trimStart:  Number($("#edTrimStart").value),
    trimEnd:    Number($("#edTrimEnd").value),
    border:     Number($("#edBorder").value),
    fade:       Number($("#edFade").value),
    overlay:    $("#edOverlay").value || ""
  };
}
$("#edPreview").addEventListener("click", async () => {
  if (!edFiles[0]) { statusLine("#edStatus","Pick at least one video."); return; }
  statusLine("#edStatus", "Rendering preview…");
  try {
    await editor.preview(edFiles[0], gatherEditOpts());
    statusLine("#edStatus", "Preview rendered on canvas.");
  } catch (e) { statusLine("#edStatus", "ERR: " + e.message); }
});
$("#edExport").addEventListener("click", async () => {
  if (!edFiles.length) { statusLine("#edStatus","Pick videos first."); return; }
  const projName = ($("#edProject").value || "edited").trim();
  const opts = gatherEditOpts();
  for (let i = 0; i < edFiles.length; i++) {
    try {
      statusLine("#edStatus", `Encoding ${i+1}/${edFiles.length}: ${edFiles[i].name}`);
      const blob = await editor.export(edFiles[i], opts, (p) => {
        $("#bottomLog").textContent = `Encoding ${i+1}/${edFiles.length} — ${Math.round(p*100)}%`;
      });
      const name = `${projName}_edited_${String(i+1).padStart(3,"0")}.webm`;
      const url = URL.createObjectURL(blob);
      await new Promise(res => chrome.downloads.download({ url, filename: `AI_Content_Hub/Edited/${projName}/${name}`, conflictAction: "uniquify", saveAs: false }, (id) => {
        // Fallback to flat path if folder blocked
        if (chrome.runtime.lastError) {
          chrome.downloads.download({ url, filename: name, conflictAction: "uniquify", saveAs: false }, () => res());
        } else res();
      }));
    } catch (e) {
      statusLine("#edStatus", `ERR on ${edFiles[i].name}: ${e.message}`);
    }
  }
  statusLine("#edStatus", "Batch export complete.");
});
$("#edCancel").addEventListener("click", () => { editor.cancel(); statusLine("#edStatus", "Cancelled."); });
$("#edOpen").addEventListener("click", async () => { await send("OPEN_DOWNLOADS"); });

// ============== SETTINGS TAB ==============
async function loadSettings() {
  const { ok, settings } = await send("SETTINGS_GET");
  if (!ok) return;
  $("#sDefPlatform").value = settings.defaultPlatform;
  $("#sDefType").value     = settings.defaultType;
  $("#sDefMethod").value   = settings.defaultMethod;
  $("#sDefBatch").value    = settings.defaultBatch;
  $("#sDefProject").value  = settings.defaultProjectName;
  $("#sDelay").value       = settings.delayMs;
  $("#sTimeout").value     = settings.timeoutMs;
  $("#sRetries").value     = settings.retries;
  $("#sWorkers").value     = settings.workers;
  $("#sSmart").checked     = !!settings.smartConcurrency;
  $("#sAuto").checked      = !!settings.autoMode;
  $("#sDry").checked       = !!settings.dryRun;
  $("#sAutoDl").checked    = !!settings.autoDownload;
  $("#sRename").checked    = !!settings.renameFiles;
  $("#sDedup").checked     = !!settings.avoidDuplicates;
  $("#sScanAll").checked   = !!settings.scanAllTabs;
  $("#sMobile").checked    = !!settings.mobileLightweight;
  $("#sLogs").checked      = !!settings.logsEnabled;
}
$("#sSave").addEventListener("click", async () => {
  const settings = {
    defaultPlatform: $("#sDefPlatform").value,
    defaultType:     $("#sDefType").value,
    defaultMethod:   $("#sDefMethod").value,
    defaultBatch:    Number($("#sDefBatch").value)||5,
    defaultProjectName: $("#sDefProject").value,
    delayMs:    Number($("#sDelay").value)||1200,
    timeoutMs:  Number($("#sTimeout").value)||90000,
    retries:    Number($("#sRetries").value)||2,
    workers:    Number($("#sWorkers").value)||2,
    smartConcurrency: $("#sSmart").checked,
    autoMode:   $("#sAuto").checked,
    dryRun:     $("#sDry").checked,
    autoDownload: $("#sAutoDl").checked,
    renameFiles:  $("#sRename").checked,
    avoidDuplicates: $("#sDedup").checked,
    scanAllTabs:  $("#sScanAll").checked,
    mobileLightweight: $("#sMobile").checked,
    logsEnabled: $("#sLogs").checked
  };
  await send("SETTINGS_SET", { settings });
  statusLine("#sStatus", "Settings saved.");
});
$("#calOpenGrok").addEventListener("click", () => send("CALIBRATE_OPEN", { platform: "grok" }));
$("#calOpenFlow").addEventListener("click", () => send("CALIBRATE_OPEN", { platform: "flow" }));
$("#calReset").addEventListener("click", async () => { const r = await send("SELECTORS_RESET"); statusLine("#sStatus", r.ok ? "Calibration reset to defaults." : "ERR: " + r.error); });
$("#projExport").addEventListener("click", async () => {
  const r = await send("PROJECT_EXPORT");
  if (r.ok) downloadAsFile(r.json, "ai_bulk_studio_projects.json", "application/json");
});
$("#projImport").addEventListener("click", () => { $("#hiddenImport").click(); });
$("#hiddenImport").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const txt = await f.text();
  const r = await send("PROJECT_IMPORT", { json: txt });
  statusLine("#sStatus", r.ok ? `Imported ${r.count} projects.` : "ERR: " + r.error);
  await refreshActiveProjectSelect();
});
$("#logExport").addEventListener("click", async () => {
  const r = await send("LOG_GET");
  if (r.ok) {
    const lines = r.logs.map(l => `${new Date(l.t).toISOString()} [${l.level}] ${l.msg} ${l.extra?JSON.stringify(l.extra):""}`).join("\n");
    downloadAsFile(lines, "ai_bulk_studio_logs.txt", "text/plain");
  }
});
$("#logClear").addEventListener("click", async () => { await send("LOG_CLEAR"); statusLine("#sStatus","Logs cleared."); });

// ===== Active project selector =====
const projSel = $("#activeProject");
async function refreshActiveProjectSelect() {
  const r = await send("PROJECT_LIST");
  const st = await send("GET_STATUS");
  projSel.innerHTML = "";
  const optNew = document.createElement("option"); optNew.value = ""; optNew.textContent = "— Active project —"; projSel.appendChild(optNew);
  for (const p of (r.list || [])) {
    const o = document.createElement("option");
    o.value = p.id; o.textContent = `${p.name} · ${p.platform}`;
    if (st.project && st.project.id === p.id) o.selected = true;
    projSel.appendChild(o);
  }
}
projSel.addEventListener("change", async () => {
  if (!projSel.value) return;
  await send("PROJECT_LOAD", { id: projSel.value });
  refreshTracker();
});

// ===== Live updates from background =====
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TRACKER_UPDATE") refreshTracker();
  if (msg?.type === "GEN_DONE") statusLine("#genStatus", "Generation complete.");
  if (msg?.type === "DL_DONE") statusLine("#dlStatus", `Scan complete — ${msg.downloaded}/${msg.found} downloaded.`);
  if (msg?.type === "LAYOUT_CHANGE") {
    statusLine("#genStatus", `Layout change on ${msg.platform}. Please recalibrate.`);
    showCalibrationBanner(msg.platform, "The result area selector vanished. Recalibrate to fix.");
  }
  if (msg?.type === "PAUSE_REASON") {
    statusLine("#genStatus", `Paused: ${msg.reason} — ${msg.message||""}`);
    if (msg.reason === "needs_calibration" || msg.reason === "layout_change") {
      showCalibrationBanner(msg.platform, msg.message || "");
    }
  }
});

function showCalibrationBanner(platform, message) {
  const banner = document.getElementById("calBanner");
  const msgEl  = document.getElementById("calBannerMsg");
  const btn    = document.getElementById("calBannerBtn");
  if (!banner) return;
  msgEl.textContent = message || `Open Settings → Calibrate ${platform === "flow" ? "Flow" : "Grok"} to bind correct selectors.`;
  banner.style.display = "flex";
  btn.onclick = async () => {
    await send("CALIBRATE_OPEN", { platform: platform || "grok" });
    banner.style.display = "none";
  };
  // Auto switch to Generate tab so the user sees the banner
  tabBtns.forEach(x => x.classList.toggle("active", x.dataset.tab === "generate"));
  Object.entries(panels).forEach(([k,p]) => p.classList.toggle("active", k === "generate"));
}

// ===== Helpers =====
function downloadAsFile(text, name, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: name, saveAs: false, conflictAction: "uniquify" });
}

// Boot
(async function init() {
  await refreshActiveProjectSelect();
  await loadSettings();
  // Populate form defaults from settings
  const { settings } = await send("SETTINGS_GET");
  if (settings) {
    if (!gProject.value) gProject.value = settings.defaultProjectName || "MyProject";
    gPlatform.value = settings.defaultPlatform || "grok";
    gType.value     = settings.defaultType || "text_to_video";
    gMethod.value   = settings.defaultMethod || "auto";
    if (settings.defaultBatch) gBatch.value = String(settings.defaultBatch);
  }
  refreshTracker();
  statusLine("#genStatus", "Ready.");
})();
