// lib/logger.js — append-only ring log persisted via chrome.storage.local
import { Storage } from "./storage.js";

const MAX = 1000;

async function push(level, msg, extra) {
  try {
    const { logs = [], settings = {} } = await Storage.get(["logs","settings"]);
    if (settings && settings.logsEnabled === false) return;
    const entry = { t: Date.now(), level, msg: String(msg), extra: extra || null };
    logs.push(entry);
    if (logs.length > MAX) logs.splice(0, logs.length - MAX);
    await Storage.set({ logs });
  } catch (e) { /* swallow */ }
  // Also echo to console for service worker debugging
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`[BulkStudio][${level}]`, msg, extra || "");
}

export const Logger = {
  info: (m, e) => push("info", m, e),
  warn: (m, e) => push("warn", m, e),
  error: (m, e) => push("error", m, e)
};
