// lib/downloader.js — chrome.downloads with naming, folders, dedup.
function sanitize(name) {
  return (name || "").replace(/[\\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 80);
}
function extFromUrl(url, fallback) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-zA-Z0-9]{2,5})(?:$|\?)/);
    if (m) return m[1].toLowerCase();
  } catch (e) {}
  return fallback || "bin";
}

export const Downloader = {
  buildName(project, item) {
    const folder = sanitize(project?.saveFolder || project?.name || "project");
    const idx = String(item.idx || "").padStart(3, "0") || "000";
    let ext = "mp4";
    if (item.kind === "image") ext = "png";
    else if (item.mediaUrl) ext = extFromUrl(item.mediaUrl, item.kind === "image" ? "png" : "mp4");
    // If autoRename disabled, keep platform original filename when we can
    if (project && project.autoRename === false && item.mediaUrl) {
      try {
        const u = new URL(item.mediaUrl);
        const base = u.pathname.split("/").pop() || "";
        if (base) return sanitize(base);
      } catch (e) {}
    }
    return `${folder}_${idx}.${ext}`;
  },
  buildFolder(project) {
    const sub = sanitize(project?.saveFolder || project?.name || "grok-folder-1");
    return `AI_Content_Hub/Grok/${sub}`;
  },
  async downloadOne({ url, name, folder }) {
    if (!url) return { ok: false, error: "no url" };
    const filename = folder ? `${folder}/${name}` : name;
    try {
      const id = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url, filename, conflictAction: "uniquify", saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(downloadId);
        });
      });
      return { ok: true, id, filename };
    } catch (e) {
      // Mobile builds may reject sub-folders. Retry flat.
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
