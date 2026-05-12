// pages/calibration.js — Grok-only calibrator (v1.0.3)
const PLATFORM = "grok";
const ROLES = [
  "promptInput","bulkPromptArea","imageUpload","startImageUpload","endImageUpload",
  "generateButton","runAllButton","resultCardArea","videoArea","imageArea",
  "downloadButton","retryButton","errorArea"
];

const $ = (s)=>document.querySelector(s);
const rowsEl = $("#rows");
const statusEl = $("#status");

function log(msg, cls=""){
  const t = new Date().toLocaleTimeString();
  statusEl.innerHTML = `<div class="${cls}">[${t}] ${msg}</div>` + statusEl.innerHTML;
}

let selectors = {};

async function load() {
  const { selectors: s } = await chrome.runtime.sendMessage({ type: "SELECTORS_GET" });
  selectors = s || { grok: {} };
  render();
}

function currentMap() {
  selectors[PLATFORM] = selectors[PLATFORM] || {};
  return selectors[PLATFORM];
}

function render() {
  const cur = currentMap();
  rowsEl.innerHTML = "";
  for (const role of ROLES) {
    const div = document.createElement("div");
    div.className = "field-row";
    const v = cur[role];
    const display = Array.isArray(v) ? v.join("  |  ") : (v || "(unset)");
    div.innerHTML = `
      <label><b>${role}</b></label>
      <code title="${display}">${display}</code>
      <div class="actions">
        <button data-testid="cal-pick-${role}" data-role="${role}" data-act="pick">Pick</button>
        <button data-testid="cal-test-${role}" data-role="${role}" data-act="test">Test</button>
        <button data-testid="cal-clear-${role}" data-role="${role}" data-act="clear">Clear</button>
      </div>`;
    rowsEl.appendChild(div);
  }
}

async function getActiveGrokTab() {
  const tabs = await chrome.tabs.query({ url: ["*://grok.com/*","*://*.grok.com/*","*://x.com/i/grok*","*://x.com/grok*"] });
  if (!tabs.length) return await chrome.tabs.create({ url: "https://grok.com/imagine" });
  await chrome.tabs.update(tabs[0].id, { active: true });
  return tabs[0];
}

rowsEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const role = btn.dataset.role;
  const act  = btn.dataset.act;
  const cur  = currentMap();
  if (act === "clear") { delete cur[role]; render(); return; }
  const tab = await getActiveGrokTab();
  if (act === "pick") {
    log(`Pick on tab ${tab.id} for "${role}". Switch to grok.com and click the target element.`);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pickPicker,
      args: [role]
    }).then(async () => {
      const pollKey = "__pick_result__" + role;
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        const data = await chrome.storage.session.get([pollKey]);
        const r = data[pollKey];
        if (r) {
          clearInterval(poll);
          chrome.storage.session.remove([pollKey]);
          cur[role] = r.selector;
          log(`Captured for ${role}: ${r.selector}`, "ok");
          render();
        } else if (tries > 120) { clearInterval(poll); log("Timed out waiting for pick.", "bad"); }
      }, 500);
    }).catch(err => log("Inject failed: " + err.message, "bad"));
  } else if (act === "test") {
    const spec = cur[role];
    if (!spec) { log(`No selector for ${role}`, "warn"); return; }
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: testSelector,
      args: [spec]
    }).then(([res]) => {
      const ok = res?.result?.ok;
      log(`${role} → ${ok ? "FOUND" : "NOT FOUND"} (${res?.result?.tag || "-"})`, ok ? "ok" : "bad");
    }).catch(err => log("Test failed: " + err.message, "bad"));
  }
});

function pickPicker(role) {
  if (window.__picking) return;
  window.__picking = role;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const hint = document.createElement("div");
  hint.style.cssText = "position:fixed;top:12px;left:12px;background:#ffb020;color:#1a1208;padding:8px 12px;border-radius:8px;font:600 13px system-ui;z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,.4)";
  hint.textContent = `Click element to bind to "${role}" (Esc to cancel)`;
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  let hovered = null;
  const onMove = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== hovered) {
      if (hovered) hovered.style.outline = "";
      hovered = el;
      hovered.style.outline = "3px solid #ffb020";
    }
  };
  const cleanup = () => {
    if (hovered) hovered.style.outline = "";
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    window.__picking = null;
  };
  const onKey = (e) => { if (e.key === "Escape") { cleanup(); } };
  const onClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const sel = buildSelector(el);
    chrome.storage.session.set({ ["__pick_result__" + role]: { selector: sel } });
    cleanup();
  };
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);

  function buildSelector(el) {
    if (!el) return "";
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
    const aria = el.getAttribute("aria-label");
    if (aria) return `${el.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g,'\\"')}"]`;
    const cls = Array.from(el.classList).filter(c => !/^(hover|focus|active|js|is-|has-)/.test(c)).slice(0,2);
    let path = el.tagName.toLowerCase();
    if (cls.length) path += "." + cls.map(c => CSS.escape(c)).join(".");
    if (el.parentElement) {
      const sib = Array.from(el.parentElement.children).filter(s => s.tagName === el.tagName);
      if (sib.length > 1) path += `:nth-of-type(${sib.indexOf(el)+1})`;
    }
    return path;
  }
}

function testSelector(spec) {
  const list = Array.isArray(spec) ? spec : [spec];
  for (const sel of list) {
    try {
      const el = document.querySelector(sel);
      if (el) return { ok: true, tag: el.tagName, text: (el.innerText||"").slice(0,60) };
    } catch (e) {}
  }
  return { ok: false };
}

$("#saveAll").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "SELECTORS_SET", selectors });
  log(r && r.ok ? "Saved." : "Save failed", r && r.ok ? "ok" : "bad");
});
$("#resetAll").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "SELECTORS_RESET" });
  selectors = r.selectors; render(); log("Reset done.", "ok");
});
$("#exportSel").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(selectors, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: "grok_bulk_studio_calibration.json", saveAs: true });
});
$("#importSel").addEventListener("click", () => $("#impFile").click());
$("#impFile").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    selectors = JSON.parse(await f.text()); render(); log("Imported.", "ok");
  } catch (err) { log("Import failed: " + err.message, "bad"); }
});

load();
