// content_scripts/common.js — shared helpers loaded before platform adapters.
// Classic content script (not ES module). Exposes window.BulkStudioCS.

(function () {
  if (window.BulkStudioCS) return;

  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const $  = (sel, root = document) => (root || document).querySelector(sel);

  // jQuery-style :contains() polyfill using XPath
  function findByContains(root, tag, text) {
    const x = `.//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})]`;
    const r = document.evaluate(x, root || document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const out = [];
    for (let i = 0; i < r.snapshotLength; i++) out.push(r.snapshotItem(i));
    return out;
  }

  function tryQuery(selector, root = document) {
    if (!selector) return null;
    // Custom syntax handling: button:contains("Run All")
    const containsMatch = /^([a-zA-Z*]+):contains\("([^"]+)"\)$/.exec(selector);
    if (containsMatch) {
      const [, tag, text] = containsMatch;
      const els = findByContains(root, tag === "*" ? "*" : tag, text);
      return els[0] || null;
    }
    try {
      return (root || document).querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function resolveSelector(spec, root = document) {
    if (!spec) return null;
    const list = Array.isArray(spec) ? spec : [spec];
    for (const sel of list) {
      const el = tryQuery(sel, root);
      if (el) return el;
    }
    return null;
  }

  function resolveAll(spec, root = document) {
    if (!spec) return [];
    const list = Array.isArray(spec) ? spec : [spec];
    const out = [];
    for (const sel of list) {
      const containsMatch = /^([a-zA-Z*]+):contains\("([^"]+)"\)$/.exec(sel);
      if (containsMatch) {
        const [, tag, text] = containsMatch;
        out.push(...findByContains(root, tag === "*" ? "*" : tag, text));
      } else {
        try { out.push(...$$(sel, root)); } catch (e) {}
      }
    }
    return Array.from(new Set(out));
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    return true;
  }

  function fireInput(el, value) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    el.focus();
    // Attempt 1: native value setter + input/change events (works with most React inputs)
    if (tag === "textarea" || tag === "input") {
      try {
        const proto = tag === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value");
        if (setter && setter.set) setter.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {
        el.value = value;
      }
      // Verify it stuck
      if (el.value === value) return true;
      // Attempt 2: execCommand insertText (works for some React inputs that ignore .value)
      try {
        el.focus();
        if (document.execCommand) {
          // Select all then replace
          el.select && el.select();
          document.execCommand("insertText", false, value);
        }
      } catch (e) {}
      if (el.value === value || (el.value && el.value.length >= Math.min(value.length, 10))) return true;
      // Attempt 3: dispatch beforeinput + input with inputType
      try {
        el.value = "";
        el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
        el.value = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {}
      return el.value === value;
    } else if (el.isContentEditable) {
      el.focus();
      try {
        // Select existing content
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        if (document.execCommand) {
          document.execCommand("insertText", false, value);
        } else {
          el.textContent = value;
        }
      } catch (e) {
        el.textContent = value;
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return (el.textContent || "").indexOf(value) !== -1 || (el.innerText || "").indexOf(value) !== -1;
    }
    return false;
  }

  async function attachFileToInput(input, fileObj) {
    if (!input) return false;
    let blob = fileObj && (fileObj.blob || fileObj.dataUrl);
    if (typeof blob === "string" && blob.startsWith("data:")) {
      const r = await fetch(blob); blob = await r.blob();
    }
    if (!(blob instanceof Blob) && fileObj && fileObj.url) {
      const r = await fetch(fileObj.url); blob = await r.blob();
    }
    if (!(blob instanceof Blob)) return false;
    const name = fileObj.name || "upload.png";
    const file = new File([blob], name, { type: blob.type || "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitFor(cb, { timeout = 30000, interval = 400 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { const v = await cb(); if (v) return v; } catch (e) {}
      await sleep(interval);
    }
    return null;
  }

  function getSelectors(platform, store) {
    const sel = (store && store[platform]) || {};
    return sel;
  }

  // Result Card fingerprint: stable hash of media src + dimensions if available.
  async function fingerprintEl(el) {
    if (!el) return null;
    let src = null;
    if (el.tagName === "VIDEO") {
      src = el.currentSrc || el.src || (el.querySelector("source")?.src);
    } else if (el.tagName === "IMG") {
      src = el.currentSrc || el.src;
    } else {
      const v = el.querySelector("video");
      const i = el.querySelector("img");
      src = (v && (v.currentSrc || v.src)) || (i && (i.currentSrc || i.src));
    }
    if (!src) return null;
    const w = el.naturalWidth || el.videoWidth || el.clientWidth || 0;
    const h = el.naturalHeight || el.videoHeight || el.clientHeight || 0;
    const raw = src + "|" + w + "x" + h;
    return await hashString(raw);
  }

  async function hashString(s) {
    try {
      const data = new TextEncoder().encode(s);
      const buf = await crypto.subtle.digest("SHA-1", data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,16);
    } catch (e) { return String(s).slice(0,16); }
  }

  function notifyBg(payload) {
    return new Promise((resolve) => {
      try { chrome.runtime.sendMessage({ type: "CS_REPORT", payload }, (r) => resolve(r)); }
      catch (e) { resolve({ ok: false }); }
    });
  }

  // Lightweight DOM observer to detect layout changes that break selectors
  function watchLayout(rootSelector, missingFor = 8000, onMissing) {
    let lastSeen = Date.now();
    const obs = new MutationObserver(() => {
      try {
        if (tryQuery(rootSelector)) lastSeen = Date.now();
      } catch (e) {}
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const id = setInterval(() => {
      if (Date.now() - lastSeen > missingFor) {
        clearInterval(id); obs.disconnect();
        try { onMissing && onMissing(); } catch (e) {}
      }
    }, 1500);
    return () => { clearInterval(id); obs.disconnect(); };
  }

  window.BulkStudioCS = {
    $, $$, tryQuery, resolveSelector, resolveAll, isVisible,
    fireInput, attachFileToInput, sleep, waitFor,
    getSelectors, fingerprintEl, hashString, notifyBg, watchLayout, findByContains,
    diagnose, heuristicFindPromptInput, heuristicFindGenerateButton, buildSelectorFor
  };

  // --- DOM diagnosis: list candidate elements that look like prompt / button / upload
  function diagnose() {
    const cand = {
      textareas: [],
      inputs: [],
      contentEditables: [],
      buttons: [],
      fileInputs: [],
      videos: [],
      images: []
    };
    const describe = (el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id || null,
        cls: Array.from(el.classList).slice(0, 5).join(" "),
        testid: el.getAttribute("data-testid") || null,
        aria: el.getAttribute("aria-label") || null,
        placeholder: el.getAttribute("placeholder") || null,
        type: el.getAttribute("type") || null,
        name: el.getAttribute("name") || null,
        accept: el.getAttribute("accept") || null,
        role: el.getAttribute("role") || null,
        text: (el.innerText || el.textContent || "").trim().slice(0, 80),
        w: Math.round(r.width), h: Math.round(r.height),
        visible: isVisible(el),
        selector: buildSelectorFor(el)
      };
    };
    document.querySelectorAll("textarea").forEach(el => cand.textareas.push(describe(el)));
    document.querySelectorAll('input:not([type="file"])').forEach(el => cand.inputs.push(describe(el)));
    document.querySelectorAll('[contenteditable="true"], [contenteditable=""]').forEach(el => cand.contentEditables.push(describe(el)));
    document.querySelectorAll("button, [role='button']").forEach(el => cand.buttons.push(describe(el)));
    document.querySelectorAll('input[type="file"]').forEach(el => cand.fileInputs.push(describe(el)));
    document.querySelectorAll("video").forEach(el => cand.videos.push(describe(el)));
    document.querySelectorAll("img").forEach((el, i) => { if (i < 50) cand.images.push(describe(el)); });
    return cand;
  }

  function heuristicFindPromptInput() {
    // Prefer visible textarea with placeholder containing "prompt"/"imagine"/"describe"
    const all = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"]'));
    const visible = all.filter(isVisible);
    const scored = visible.map(el => {
      const p = (el.getAttribute("placeholder") || "").toLowerCase();
      const a = (el.getAttribute("aria-label") || "").toLowerCase();
      const id = (el.getAttribute("data-testid") || "").toLowerCase();
      let s = 0;
      if (/imagine|prompt|describe/.test(p)) s += 5;
      if (/imagine|prompt|describe/.test(a)) s += 4;
      if (/imagine|prompt/.test(id)) s += 6;
      const r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 30) s += 2;
      if (el.tagName === "TEXTAREA") s += 1;
      return { el, s };
    }).sort((a,b) => b.s - a.s);
    return scored[0]?.el || null;
  }

  function heuristicFindGenerateButton(promptEl) {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isVisible);
    const scored = buttons.map(el => {
      const t = (el.innerText || "").trim().toLowerCase();
      const a = (el.getAttribute("aria-label") || "").toLowerCase();
      const id = (el.getAttribute("data-testid") || "").toLowerCase();
      let s = 0;
      if (/^generate|^create|^submit|^run|^imagine|^make/.test(t)) s += 5;
      if (/generate|create|submit|run all/.test(a)) s += 4;
      if (/submit|generate|create|imagine/.test(id)) s += 6;
      // Often the generate button is near the prompt input
      if (promptEl) {
        const r1 = promptEl.getBoundingClientRect();
        const r2 = el.getBoundingClientRect();
        const dist = Math.hypot(r1.left - r2.left, r1.top - r2.top);
        if (dist < 600) s += 2;
        if (dist < 200) s += 2;
      }
      // type=submit boost
      if ((el.getAttribute("type") || "").toLowerCase() === "submit") s += 3;
      return { el, s };
    }).sort((a,b) => b.s - a.s);
    return scored[0]?.el || null;
  }

  function buildSelectorFor(el) {
    if (!el) return "";
    if (el.getAttribute && el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) return `${el.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g,'\\"')}"]`;
    const cls = Array.from(el.classList || []).filter(c => !/^(hover|focus|active|js|is-|has-)/.test(c)).slice(0,2);
    let path = el.tagName.toLowerCase();
    if (cls.length) path += "." + cls.map(c => CSS.escape(c)).join(".");
    if (el.parentElement) {
      const sib = Array.from(el.parentElement.children).filter(s => s.tagName === el.tagName);
      if (sib.length > 1) path += `:nth-of-type(${sib.indexOf(el)+1})`;
    }
    return path;
  }
})();
