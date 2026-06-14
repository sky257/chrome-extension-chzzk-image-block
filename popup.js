const STORAGE_KEY = "hideChzzkImages";

const toggle = document.getElementById("toggle");
const statusText = document.getElementById("status");

function updateStatus(enabled) {
  statusText.textContent = enabled ? "숨김 켜짐" : "숨김 꺼짐";
}

async function notifyActiveTab(enabled) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://chzzk.naver.com/")) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "SET_CHZZK_IMAGE_BLOCKING",
      enabled
    });
  } catch {
    // The content script may not be ready on a just-opened tab. Storage still applies.
  }
}

chrome.storage.local.get({ [STORAGE_KEY]: true }, (items) => {
  const enabled = Boolean(items[STORAGE_KEY]);
  toggle.checked = enabled;
  updateStatus(enabled);
});

toggle.addEventListener("change", async () => {
  const enabled = toggle.checked;
  await chrome.storage.local.set({ [STORAGE_KEY]: enabled });
  updateStatus(enabled);
  await notifyActiveTab(enabled);
});
