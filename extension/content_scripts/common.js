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
    if (tag === "textarea" || tag === "input") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value") ||
                     Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (setter && setter.set) setter.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    } else return false;
    return true;
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
    getSelectors, fingerprintEl, hashString, notifyBg, watchLayout, findByContains
  };
})();
