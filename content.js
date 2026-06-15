const STORAGE_KEY = "hideChzzkImages";
const CLASS_NAME = "chzzk-image-blocker-enabled";
const STYLE_ID = "chzzk-image-blocker-style";
const HIGHLIGHT_CLASS_NAME = "chzzk-text-highlight";
const HIGHLIGHT_TEXT = "하이라이트";
const EXCLUDED_HIGHLIGHT_PREFIX = "2분 ";

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

html .${HIGHLIGHT_CLASS_NAME} {
  background: #7cff7c !important;
  color: black !important;
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

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;

  return Boolean(
    parent.closest(
      `.${HIGHLIGHT_CLASS_NAME}, script, style, noscript, textarea, input`
    )
  );
}

function getTextBeforeNode(node) {
  const root = document.body || document.documentElement;
  if (!root) return "";

  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    if (walker.currentNode === node) return text;

    if (!shouldSkipNode(walker.currentNode)) {
      text = (text + (walker.currentNode.nodeValue || "")).slice(
        -EXCLUDED_HIGHLIGHT_PREFIX.length
      );
    }
  }

  return text;
}

function processTextNode(node) {
  if (!node) return;
  if (shouldSkipNode(node)) return;

  const text = node.nodeValue || "";
  if (!text.includes(HIGHLIGHT_TEXT)) return;

  const textBeforeNode = getTextBeforeNode(node);
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let hasHighlight = false;

  while (cursor < text.length) {
    const index = text.indexOf(HIGHLIGHT_TEXT, cursor);

    if (index === -1) {
      fragment.append(document.createTextNode(text.slice(cursor)));
      break;
    }

    const textBeforeMatch = textBeforeNode + text.slice(0, index);
    const isExcluded = textBeforeMatch.endsWith(EXCLUDED_HIGHLIGHT_PREFIX);

    fragment.append(document.createTextNode(text.slice(cursor, index)));

    if (isExcluded) {
      fragment.append(document.createTextNode(HIGHLIGHT_TEXT));
    } else {
      const highlight = document.createElement("span");
      highlight.className = HIGHLIGHT_CLASS_NAME;
      highlight.textContent = HIGHLIGHT_TEXT;
      fragment.append(highlight);
      hasHighlight = true;
    }

    cursor = index + HIGHLIGHT_TEXT.length;
  }

  if (hasHighlight) {
    node.replaceWith(fragment);
  }
}

function processNode(root) {
  if (!root) return;

  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  if (root.classList?.contains(HIGHLIGHT_CLASS_NAME)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach(processTextNode);
}

function startHighlighting() {
  ensureStyle();
  processNode(document.body || document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        processTextNode(mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) {
        processNode(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
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

startHighlighting();
