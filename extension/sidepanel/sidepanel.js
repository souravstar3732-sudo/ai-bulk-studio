// sidepanel/sidepanel.js — Grok Bulk Studio v1.1.0 (Control / Setting / Debug Logs)
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const send = (type, payload) =>
  new Promise((resolve) => chrome.runtime.sendMessage({ type, ...payload }, (r) => resolve(r || { ok: false })));

const PLATFORM = "grok";

// ============ Tabs ============
const tabBtns = $$(".tab");
const panels  = {
  control: $("#tab-control"),
  setting: $("#tab-setting"),
  logs:    $("#tab-logs")
};
const bottomBar = $("#bottomBar");
tabBtns.forEach(b => b.addEventListener("click", () => {
  tabBtns.forEach(x => x.classList.toggle("active", x === b));
  const name = b.dataset.tab;
  Object.entries(panels).forEach(([k,p]) => p.classList.toggle("active", k === name));
  bottomBar.style.display = name === "control" ? "flex" : "none";
  if (name === "setting") loadSettings();
  if (name === "logs")    refreshLogs();
}));

function logLine(id, text) {
  const el = $(id); if (!el) return;
  const t = new Date().toLocaleTimeString();
  el.textContent = `[${t}] ${text}\n` + el.textContent;
}

// ============ Mode pills ============
let currentMode = "text_to_video";
const modeBtns = $$(".mode-pill");
modeBtns.forEach(b => b.addEventListener("click", () => {
  modeBtns.forEach(x => x.classList.toggle("active", x === b));
  currentMode = b.dataset.mode;
  toggleImageInputs();
}));
function toggleImageInputs() {
  const needsStart = ["start_end_video","image_to_image","ingredients_to_video"].includes(currentMode);
  const needsEnd   = currentMode === "start_end_video";
  $("#imageInputs").style.display = needsStart ? "grid" : "none";
  $("#endImagesCard").style.display = needsEnd ? "" : "none";
}

// ============ Prompts area ============
const promptsEl    = $("#prompts");
const promptCount  = $("#promptCount");
const dupCount     = $("#dupCount");
function getPromptsArr() {
  // Blank-line separated paragraphs OR fallback to per-line
  const raw = promptsEl.value;
  const paras = raw.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  if (paras.length > 1) return paras;
  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}
function updateCounts() {
  const list = getPromptsArr();
  promptCount.textContent = list.length;
  const seen = new Set(); let dups = 0;
  list.forEach(p => { const k = p.toLowerCase(); if (seen.has(k)) dups++; seen.add(k); });
  dupCount.textContent = dups;
}
promptsEl.addEventListener("input", updateCounts);

// ============ Upload handlers ============
$("#uploadTxt").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const txt = await f.text();
  promptsEl.value = txt;
  updateCounts();
  logLine("#controlStatus", `Loaded ${f.name} (${txt.length} chars)`);
});
$("#uploadXlsx").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const isCsv = /\.csv$/i.test(f.name);
  if (!isCsv) {
    logLine("#controlStatus", "xlsx parsing not bundled in this build — convert to .csv (or .txt) please.");
    return;
  }
  const txt = await f.text();
  // Simple CSV: take first column, ignore quotes basic case
  const lines = txt.split(/\r?\n/).map(l => {
    const m = l.match(/^"((?:[^"]|"")*)"/);
    return (m ? m[1].replace(/""/g,'"') : l.split(",")[0] || "").trim();
  }).filter(Boolean);
  promptsEl.value = lines.join("\n\n");
  updateCounts();
  logLine("#controlStatus", `Loaded ${lines.length} prompts from CSV`);
});

// ============ Retries stepper ============
$("#retriesMinus").addEventListener("click", () => {
  const i = $("#setRetries"); i.value = Math.max(1, (Number(i.value)||1) - 1);
});
$("#retriesPlus").addEventListener("click", () => {
  const i = $("#setRetries"); i.value = Math.min(20, (Number(i.value)||1) + 1);
});

// ============ Top: Open Grok / Guide ============
$("#openGrok").addEventListener("click", () => chrome.tabs.create({ url: "https://grok.com/imagine" }));
$("#openGuide").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("README.md") }));

// ============ Calibration banner ============
function showCalibrationBanner(msg) {
  const banner = $("#calBanner");
  const m = $("#calBannerMsg");
  if (!banner) return;
  if (msg) m.textContent = msg;
  banner.style.display = "flex";
  $("#calBannerBtn").onclick = async () => {
    await send("CALIBRATE_OPEN", { platform: PLATFORM });
    banner.style.display = "none";
  };
  // Switch to Control if user is elsewhere
  tabBtns.forEach(x => x.classList.toggle("active", x.dataset.tab === "control"));
  Object.entries(panels).forEach(([k,p]) => p.classList.toggle("active", k === "control"));
  bottomBar.style.display = "flex";
}

// ============ File → dataUrl ============
function fileToObj(f) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res({ name: f.name, type: f.type, dataUrl: r.result });
    r.readAsDataURL(f);
  });
}

// ============ Run ============
$("#btnRun").addEventListener("click", () => runBulk());
$("#btnClear").addEventListener("click", () => { promptsEl.value = ""; updateCounts(); logLine("#controlStatus", "Cleared."); });
$("#btnReport").addEventListener("click", async () => {
  const r = await send("LOG_GET");
  if (r.ok) {
    const lines = r.logs.map(l => `${new Date(l.t).toISOString()} [${l.level}] ${l.msg} ${l.extra?JSON.stringify(l.extra):""}`).join("\n");
    downloadAsFile(lines, "grok_bulk_studio_report.txt", "text/plain");
  }
  logLine("#controlStatus", "Report exported.");
});

async function runBulk() {
  $("#calBanner").style.display = "none";
  const prompts = getPromptsArr();
  if (!prompts.length) { logLine("#controlStatus", "No prompts to run."); return; }

  logLine("#controlStatus", "Pre-flight: opening Grok and checking selectors …");
  const val = await send("VALIDATE_SELECTORS", { platform: PLATFORM });
  if (!val || !val.ok) {
    const miss = [];
    if (val && val.promptInput && !val.promptInput.found)  miss.push("prompt input");
    if (val && val.generateButton && !val.generateButton.found) miss.push("generate button");
    const reason = (val && val.error) || (miss.join(", ") || "selectors not found");
    logLine("#controlStatus", "✗ Pre-flight failed: " + reason);
    showCalibrationBanner(reason);
    return;
  }
  logLine("#controlStatus", `✓ Pre-flight OK · prompt=${val.promptInput.selector} · gen=${val.generateButton.selector}`);

  const settings = await collectSettings();
  const concurrent = Number($("#concurrent").value || 1);
  const dMin = Number($("#delayMin").value || 0);
  const dMax = Number($("#delayMax").value || 0);
  const folder = ($("#saveFolder").value || "grok-folder-1").trim();
  const outputsPerPrompt = Number($("#outputsPerPrompt").value || 1);
  const autoRename = $("#autoRename").checked;

  const sFiles = Array.from($("#startImages").files || []);
  const eFiles = Array.from($("#endImages").files || []);
  const startImages = await Promise.all(sFiles.map(fileToObj));
  const endImages   = await Promise.all(eFiles.map(fileToObj));

  const payload = {
    name: folder,
    platform: PLATFORM,
    generationType: currentMode,
    method: concurrent > 1 ? "multitab" : "native",
    batchSize: Math.max(1, Math.min(50, concurrent)),
    workers: concurrent,
    delayMinMs: Math.max(0, dMin * 1000),
    delayMaxMs: Math.max(dMin, dMax) * 1000,
    outputsPerPrompt,
    saveFolder: folder,
    autoRename,
    aspectRatio: settings.aspectRatio,
    videoOption: settings.videoOption,
    imageModel:  settings.imageModel,
    imageMode:   settings.imageMode,
    videoQuality: settings.videoQuality,
    imageQuality: settings.imageQuality,
    retries: settings.retries,
    prompts,
    startImages,
    endImages,
    dryRun: false
  };
  logLine("#controlStatus", `Running ${prompts.length} prompts · mode=${currentMode} · concurrent=${concurrent} · folder=${folder}`);
  const res = await send("GEN_START", { payload });
  if (!res.ok) logLine("#controlStatus", "ERR: " + res.error);
  else {
    logLine("#controlStatus", `OK. Project=${res.projectId}. Duplicates flagged: ${res.duplicates?.length || 0}`);
    refreshQueue();
    refreshActiveProjectSelect();
  }
}

// ============ Queue rendering ============
async function refreshQueue() {
  const st = await send("GET_STATUS");
  const list = $("#queueList");
  list.innerHTML = "";
  const tracker = st.project?.tracker || [];
  $("#queueCount").textContent = `${tracker.filter(t => ["pending","submitted","generating"].includes(t.status)).length} active`;
  tracker.slice(0, 200).forEach(t => {
    const row = document.createElement("div");
    row.className = "queue-row";
    row.innerHTML = `
      <span class="idx">${String(t.idx).padStart(3,"0")}</span>
      <span class="p" title="${(t.prompt||'').replace(/"/g,'&quot;')}">${t.prompt || '(no prompt)'}</span>
      <span class="st ${t.status||'pending'}">${t.status||'pending'}</span>`;
    list.appendChild(row);
  });
}

// ============ Settings ============
async function collectSettings() {
  return {
    aspectRatio:   $("#setAspect").value,
    videoOption:   $("#setVideoOpt").value,
    imageModel:    $("#setImageModel").value,
    imageMode:     $("#setImageMode").value,
    videoQuality:  $("#setVideoQuality").value,
    imageQuality:  $("#setImageQuality").value,
    retries:       Number($("#setRetries").value)||5,
    defaultMode:   $("#setDefaultMode").value
  };
}
async function loadSettings() {
  const { ok, settings } = await send("SETTINGS_GET");
  if (!ok || !settings) return;
  $("#setDefaultMode").value  = settings.defaultMode  || "text_to_video";
  $("#setImageModel").value   = settings.imageModel   || "quality";
  $("#setAspect").value       = settings.aspectRatio  || "9:16";
  $("#setVideoOpt").value     = settings.videoOption  || "10s";
  $("#setImageMode").value    = settings.imageMode    || "new_image";
  $("#setRetries").value      = settings.retries      || 5;
  $("#setVideoQuality").value = settings.videoQuality || "720p";
  $("#setImageQuality").value = settings.imageQuality || "1k";
}
$("#saveSettings").addEventListener("click", async () => {
  const s = await collectSettings();
  await send("SETTINGS_SET", { settings: s });
  logLine("#settingStatus", "Settings saved.");
});
$("#calOpen").addEventListener("click", () => send("CALIBRATE_OPEN", { platform: PLATFORM }));
$("#calReset").addEventListener("click", async () => {
  const r = await send("SELECTORS_RESET");
  logLine("#settingStatus", r.ok ? "Calibration reset." : "ERR: " + r.error);
});
$("#projExport").addEventListener("click", async () => {
  const r = await send("PROJECT_EXPORT");
  if (r.ok) downloadAsFile(r.json, "grok_bulk_studio_projects.json", "application/json");
});
$("#projImport").addEventListener("click", () => $("#hiddenImport").click());
$("#hiddenImport").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const r = await send("PROJECT_IMPORT", { json: await f.text() });
  logLine("#settingStatus", r.ok ? `Imported ${r.count} projects.` : "ERR: " + r.error);
  refreshActiveProjectSelect();
});

// ============ Debug Logs tab ============
$("#btnValidate").addEventListener("click", async () => {
  const v = await send("VALIDATE_SELECTORS", { platform: PLATFORM });
  const out = $("#diagOutput");
  if (v && v.ok) {
    out.textContent = `✓ Selectors found on grok\n  prompt: ${v.promptInput.selector}\n  generate: ${v.generateButton.selector} (text="${v.generateButton.text||''}")`;
  } else {
    const miss = [];
    if (v && v.promptInput && !v.promptInput.found)  miss.push("prompt input");
    if (v && v.generateButton && !v.generateButton.found) miss.push("generate button");
    out.textContent = "✗ " + ((v && v.error) || miss.join(", ") || "selectors not found");
  }
});
$("#btnDiagnose").addEventListener("click", async () => {
  const out = $("#diagOutput");
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
});
$("#btnRefreshLogs").addEventListener("click", refreshLogs);
$("#btnExportLogs").addEventListener("click", async () => {
  const r = await send("LOG_GET");
  if (r.ok) {
    const lines = r.logs.map(l => `${new Date(l.t).toISOString()} [${l.level}] ${l.msg} ${l.extra?JSON.stringify(l.extra):""}`).join("\n");
    downloadAsFile(lines, "grok_bulk_studio_logs.txt", "text/plain");
  }
});
$("#btnClearLogs").addEventListener("click", async () => { await send("LOG_CLEAR"); $("#logsView").textContent = ""; });

async function refreshLogs() {
  const r = await send("LOG_GET");
  if (!r.ok) return;
  $("#logsView").textContent = r.logs.slice().reverse()
    .map(l => `${new Date(l.t).toLocaleTimeString()} [${l.level}] ${l.msg}`)
    .join("\n");
}

// ============ Active project selector ============
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
  refreshQueue();
});

// ============ Live updates from BG ============
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TRACKER_UPDATE") refreshQueue();
  if (msg?.type === "GEN_DONE") logLine("#controlStatus", "Generation complete.");
  if (msg?.type === "DL_DONE") logLine("#controlStatus", `Downloads — ${msg.downloaded}/${msg.found}.`);
  if (msg?.type === "LAYOUT_CHANGE") showCalibrationBanner("Layout change on grok. Please recalibrate.");
  if (msg?.type === "PAUSE_REASON") {
    logLine("#controlStatus", `Paused: ${msg.reason} — ${msg.message||""}`);
    if (msg.reason === "needs_calibration" || msg.reason === "layout_change") {
      showCalibrationBanner(msg.message || "");
    }
  }
});

function downloadAsFile(text, name, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: name, saveAs: false, conflictAction: "uniquify" });
}

// ============ Boot ============
(async function init() {
  await refreshActiveProjectSelect();
  await loadSettings();
  toggleImageInputs();
  refreshQueue();
  logLine("#controlStatus", "Ready.");
})();
