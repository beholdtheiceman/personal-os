// Personal OS Capture Extension — popup.js
// Reads the current tab's URL + title and opens the /share page in a popup window.
// No auth needed — it uses your existing browser session on personal-os-tau-red.vercel.app.

const APP_URL = "https://personal-os-tau-red.vercel.app";

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;

  const url   = tab.url   || "";
  const title = tab.title || "";

  // Populate the preview
  document.getElementById("tab-title").textContent = title || url || "Untitled";
  document.getElementById("tab-url").textContent   = url;

  document.getElementById("capture-btn").addEventListener("click", () => {
    const shareUrl =
      `${APP_URL}/share` +
      `?url=${encodeURIComponent(url)}` +
      `&title=${encodeURIComponent(title)}`;

    chrome.windows.create({
      url:    shareUrl,
      type:   "popup",
      width:  500,
      height: 620,
    });

    // Close the extension popup
    window.close();
  });
});
