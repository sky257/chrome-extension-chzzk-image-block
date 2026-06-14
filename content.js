const STORAGE_KEY = "hideChzzkImages";
const CLASS_NAME = "chzzk-image-blocker-enabled";
const STYLE_ID = "chzzk-image-blocker-style";

const BLOCKING_CSS = `
html.${CLASS_NAME} img,
html.${CLASS_NAME} picture,
html.${CLASS_NAME} source,
html.${CLASS_NAME} svg image,
html.${CLASS_NAME} canvas {
  opacity: 0 !important;
}

html.${CLASS_NAME} * {
  background-image: none !important;
}

html.${CLASS_NAME} video[poster] {
  background-image: none !important;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BLOCKING_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function setImageBlocking(enabled) {
  ensureStyle();
  document.documentElement.classList.toggle(CLASS_NAME, Boolean(enabled));
}

chrome.storage.local.get({ [STORAGE_KEY]: true }, (items) => {
  setImageBlocking(items[STORAGE_KEY]);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) return;
  setImageBlocking(changes[STORAGE_KEY].newValue);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SET_CHZZK_IMAGE_BLOCKING") return;

  setImageBlocking(message.enabled);
  sendResponse({ ok: true });
});
