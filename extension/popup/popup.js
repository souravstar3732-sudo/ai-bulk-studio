// Popup script — quick status and side panel opener (Grok-only build).
(async function init() {
  const $ = (id) => document.getElementById(id);

  $("openPanel").addEventListener("click", async () => {
    try {
      const win = await chrome.windows.getCurrent();
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: win.id });
      }
    } catch (e) {
      chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel/sidepanel.html") });
    }
    window.close();
  });

  $("openGrok").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://grok.com/imagine" });
  });

  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (res && res.ok) {
      $("proj").textContent = res.project?.name || "—";
      const c = res.counts || {};
      $("pending").textContent = c.pending || 0;
      $("completed").textContent = c.completed || 0;
      $("downloaded").textContent = c.downloaded || 0;
    }
  } catch (e) {}
})();
