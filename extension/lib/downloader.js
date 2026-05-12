// lib/downloader.js — chrome.downloads with naming, folders, dedup.
import { Storage } from "./storage.js";

function sanitize(name) {
  return (name || "").replace(/[\\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 80);
}

function extFromUrl(url, fallback) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const m = path.match(/\.([a-zA-Z0-9]{2,5})(?:$|\?)/);
    if (m) return m[1].toLowerCase();
  } catch (e) {}
  return fallback || "bin";
}

export const Downloader = {
  buildName(project, item) {
    const proj = sanitize(project?.name || "project");
    const platform = sanitize(project?.platform || "ai");
    const method = sanitize(project?.method || "native");
    const idx = String(item.idx || "").padStart(3, "0") || "000";
    let ext = "mp4";
    if (item.kind === "image") ext = "png";
    else if (item.mediaUrl) ext = extFromUrl(item.mediaUrl, item.kind === "image" ? "png" : "mp4");
    return `${proj}_${platform}_${method}_${idx}.${ext}`;
  },
  buildFolder(project) {
    if (!project) return "AI_Content_Hub";
    const platform = project.platform === "flow" ? "Flow" : "Grok";
    return `AI_Content_Hub/${platform}/${sanitize(project.name || "Project")}`;
  },
  async downloadOne({ url, name, folder }) {
    if (!url) return { ok: false, error: "no url" };
    const filename = folder ? `${folder}/${name}` : name;
    try {
      const id = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url,
          filename,
          conflictAction: "uniquify",
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(downloadId);
        });
      });
      return { ok: true, id, filename };
    } catch (e) {
      // Some mobile builds reject sub-folders. Retry flat.
      try {
        const id2 = await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url, filename: name, conflictAction: "uniquify", saveAs: false
          }, (dlid) => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(dlid));
        });
        return { ok: true, id: id2, filename: name, flat: true };
      } catch (e2) {
        return { ok: false, error: String(e2 && e2.message || e2) };
      }
    }
  }
};
