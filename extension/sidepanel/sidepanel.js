// sidepanel/sidepanel.js — Grok-only UI controller (v1.0.3)

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PLATFORM = "grok";

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
function statusLine(id, text) {
  const el = $(id);
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] ${text}\n` + el.textContent;
  $("#bottomLog").textContent = text;
}

function fileToObj(f) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res({ name: f.name, type: f.type, dataUrl: r.result });
    r.readAsDataURL(f);
  });
}

// ============== GENERATE ==============
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
  const banner = document.getElementById("calBanner");
  if (banner) banner.style.display = "none";

  const prompts = getPromptsArr();
  if (!prompts.length) { statusLine("#genStatus", "No prompts."); return; }

  // Pre-flight: verify required selectors are reachable on the Grok page
  statusLine("#genStatus", "Pre-flight: opening Grok tab if needed and verifying selectors …");
  const val = await send("VALIDATE_SELECTORS", { platform: PLATFORM });
  if (!val || !val.ok) {
    const miss = [];
    if (val && val.promptInput && !val.promptInput.found)  miss.push("prompt input");
    if (val && val.generateButton && !val.generateButton.found) miss.push("generate button");
    const reason = val && val.error ? val.error : (miss.join(", ") || "selectors not found");
    const msg = `Pre-flight failed: ${reason}. Click "Diagnose Page" or "Open Calibration" to fix.`;
    statusLine("#genStatus", msg);
    showCalibrationBanner(msg);
    return;
  }
  statusLine("#genStatus", `Pre-flight OK · prompt=${val.promptInput.selector} · gen=${val.generateButton.selector}`);

  const batchVal = gBatch.value === "custom" ? Number(prompt("Custom batch size:") || 5) : Number(gBatch.value);
  const project = {
    name: gProject.value || "Untitled",
    platform: PLATFORM,
    generationType: gType.value,
    method: gMethod.value,
    batchSize: batchVal,
    prompts
  };
  const sFiles = Array.from(gStartImages.files || []);
  const eFiles = Array.from(gEndImages.files || []);
  const startImages = await Promise.all(sFiles.map(fileToObj));
  const endImages   = await Promise.all(eFiles.map(fileToObj));

  statusLine("#genStatus", `Starting ${prompts.length} prompts on grok (${project.method}, batch ${batchVal})${dryRun ? " — DRY RUN" : ""}`);
  const res = await send("GEN_START", { payload: { ...project, prompts, startImages, endImages, dryRun, platform: PLATFORM } });
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
  statusLine("#genStatus", "Probing concurrency …");
  const start = Date.now();
  await send("PING");
  statusLine("#genStatus", `Background round-trip: ${Date.now()-start}ms. Suggested workers: 2 (mobile-safe).`);
});
$("#btnValidate").addEventListener("click", async () => {
  statusLine("#genStatus", "Validating selectors on grok …");
  const v = await send("VALIDATE_SELECTORS", { platform: PLATFORM });
  if (v && v.ok) {
    statusLine("#genStatus", `✓ All required selectors found.\n  prompt: ${v.promptInput.selector}\n  generate: ${v.generateButton.selector} (text="${v.generateButton.text||""}")`);
  } else {
    const miss = [];
    if (v && v.promptInput && !v.promptInput.found)  miss.push("prompt input");
    if (v && v.generateButton && !v.generateButton.found) miss.push("generate button");
    const reason = v && v.error ? v.error : (miss.join(", ") || "selectors");
    statusLine("#genStatus", "✗ Missing: " + reason + ". Open Calibration to bind them.");
    showCalibrationBanner("Validate Selectors failed: " + reason);
  }
});
$("#btnDiagnose").addEventListener("click", async () => {
  const out = $("#diagOutput");
  out.style.display = "block";
  out.textContent = "Diagnosing grok page …";
  const r = await send("DIAGNOSE_PAGE", { platform: PLATFORM });
  if (!r.ok) { out.textContent = "ERR: " + r.error; return; }
  const dom = r.dom;
  const fmt = (arr, name) => {
    if (!arr.length) return `\n${name}: (none)\n`;
    return `\n${name} (${arr.length}):\n` + arr.slice(0,15).map((e,i) =>
      `  ${i+1}. ${e.tag}${e.testid?` testid="${e.testid}"`:""}${e.aria?` aria="${e.aria}"`:""}${e.placeholder?` ph="${e.placeholder}"`:""}${e.text?` "${e.text.slice(0,40)}"`:""} [${e.w}x${e.h}${e.visible?"":" hidden"}]\n     → ${e.selector}`
    ).join("\n") + "\n";
  };
  out.textContent = `URL: ${r.url}\n` +
    fmt(dom.textareas.filter(x=>x.visible), "Textareas (visible)") +
    fmt(dom.contentEditables.filter(x=>x.visible), "ContentEditables (visible)") +
    fmt(dom.buttons.filter(x=>x.visible && x.text).slice(0,30), "Buttons with text (visible)") +
    fmt(dom.fileInputs, "File inputs") +
    fmt(dom.videos.filter(x=>x.visible), "Videos (visible)");
  statusLine("#genStatus", `Diagnose complete: ${dom.textareas.length} textareas, ${dom.buttons.length} buttons, ${dom.fileInputs.length} file inputs.`);
});
$("#btnCalibrate").addEventListener("click", async () => {
  await send("CALIBRATE_OPEN", { platform: PLATFORM });
});

// ============== DOWNLOAD ==============
$("#dlScanCurrent").addEventListener("click", () => doScan({ scanAll: false }));
$("#dlScanGrok").addEventListener("click",    () => doScan({ scanAll: true, platform: PLATFORM }));
$("#dlFinished").addEventListener("click",    async () => {
  const st = await send("GET_STATUS"); if (!st.project) { statusLine("#dlStatus","No active project"); return; }
  const ready = (st.project.tracker || []).filter(t => t.status === "completed" && !t.downloaded);
  for (const r of ready) {
    await send("DOWNLOAD_FILE", { payload: { url: r.mediaUrl, name: `${st.project.name}_grok_${st.project.method}_${String(r.idx).padStart(3,"0")}.${(r.kind==="image"?"png":"mp4")}`, folder: `AI_Content_Hub/Grok/${st.project.name}` } });
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
  statusLine("#dlStatus", `Scanning${opts.scanAll ? " all Grok tabs" : " current page"} …`);
  const r = await send("DOWNLOAD_SCAN", { payload: { ...opts, platform: PLATFORM } });
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

// ============== EDIT ==============
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
      await new Promise(res => chrome.downloads.download({ url, filename: `AI_Content_Hub/Edited/${projName}/${name}`, conflictAction: "uniquify", saveAs: false }, () => {
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

// ============== SETTINGS ==============
async function loadSettings() {
  const { ok, settings } = await send("SETTINGS_GET");
  if (!ok) return;
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
    defaultPlatform: PLATFORM,
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
$("#calOpenGrok").addEventListener("click", () => send("CALIBRATE_OPEN", { platform: PLATFORM }));
$("#calReset").addEventListener("click", async () => { const r = await send("SELECTORS_RESET"); statusLine("#sStatus", r.ok ? "Calibration reset to defaults." : "ERR: " + r.error); });
$("#projExport").addEventListener("click", async () => {
  const r = await send("PROJECT_EXPORT");
  if (r.ok) downloadAsFile(r.json, "grok_bulk_studio_projects.json", "application/json");
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
    downloadAsFile(lines, "grok_bulk_studio_logs.txt", "text/plain");
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
    o.value = p.id; o.textContent = p.name;
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
    statusLine("#genStatus", `Layout change on grok. Please recalibrate.`);
    showCalibrationBanner("The result area selector vanished. Recalibrate to fix.");
  }
  if (msg?.type === "PAUSE_REASON") {
    statusLine("#genStatus", `Paused: ${msg.reason} — ${msg.message||""}`);
    if (msg.reason === "needs_calibration" || msg.reason === "layout_change") {
      showCalibrationBanner(msg.message || "");
    }
  }
});

function showCalibrationBanner(message) {
  const banner = document.getElementById("calBanner");
  const msgEl  = document.getElementById("calBannerMsg");
  const btn    = document.getElementById("calBannerBtn");
  if (!banner) return;
  msgEl.textContent = message || "Open Settings → Calibrate Grok to bind correct selectors.";
  banner.style.display = "flex";
  btn.onclick = async () => {
    await send("CALIBRATE_OPEN", { platform: PLATFORM });
    banner.style.display = "none";
  };
  tabBtns.forEach(x => x.classList.toggle("active", x.dataset.tab === "generate"));
  Object.entries(panels).forEach(([k,p]) => p.classList.toggle("active", k === "generate"));
}

function downloadAsFile(text, name, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: name, saveAs: false, conflictAction: "uniquify" });
}

(async function init() {
  await refreshActiveProjectSelect();
  await loadSettings();
  const { settings } = await send("SETTINGS_GET");
  if (settings) {
    if (!gProject.value) gProject.value = settings.defaultProjectName || "MyProject";
    gType.value     = settings.defaultType || "text_to_video";
    gMethod.value   = settings.defaultMethod || "auto";
    if (settings.defaultBatch) gBatch.value = String(settings.defaultBatch);
  }
  refreshTracker();
  statusLine("#genStatus", "Ready.");
})();
