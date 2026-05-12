// Popup script — quick status and side panel opener.
(async function init() {
  const $ = (id) => document.getElementById(id);

  // Open the side panel for the current window
  $("openPanel").addEventListener("click", async () => {
    try {
      const win = await chrome.windows.getCurrent();
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: win.id });
      }
    } catch (e) {
      // Fallback: open the sidepanel page in a tab
      chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel/sidepanel.html") });
    }
    window.close();
  });

  $("openGrok").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://grok.com/imagine" });
  });
  $("openFlow").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://labs.google/flow" });
  });

  // Pull status from background
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (res && res.ok) {
      $("proj").textContent = res.project?.name || "—";
      $("plat").textContent = res.project?.platform || "—";
      const c = res.counts || {};
      $("pending").textContent = c.pending || 0;
      $("completed").textContent = c.completed || 0;
      $("downloaded").textContent = c.downloaded || 0;
    }
  } catch (e) {
    // background may not be ready
  }
})();
