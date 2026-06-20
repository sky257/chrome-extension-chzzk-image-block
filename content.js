const STORAGE_KEY = "hideChzzkImages";
const CONTROL_BAR_STORAGE_KEY = "hideChzzkControlBar";
const HIGHLIGHT_STORAGE_KEY = "highlightChzzkText";
const FULLSCREEN_CLICK_BLOCKER_STORAGE_KEY = "blockFullscreenClicks";
const HIGHLIGHT_CARD_FILTER_STORAGE_KEY = "filterHighlightCardsOnly";
const CLASS_NAME = "chzzk-image-blocker-enabled";
const STYLE_ID = "chzzk-image-blocker-style";
const HIGHLIGHT_CLASS_NAME = "chzzk-text-highlight";
const HIGHLIGHT_CARD_FILTERED_CLASS_NAME = "chzzk-highlight-card-filtered";
const CONTROL_BAR_HIDDEN_CLASS_NAME = "chzzk-control-bar-hidden";
const CONTROL_BAR_SELECTOR = ".pzp-pc__bottom";
const FULLSCREEN_CLICK_BLOCKER_ID = "chzzk-fullscreen-click-blocker";
const CUSTOM_HIGHLIGHT_NAME = "chzzk-text-highlight";
const HIGHLIGHT_TEXT = "하이라이트";
const EXCLUDED_HIGHLIGHT_PREFIX = "2분 ";

let highlightObserver = null;
let highlightRefreshTimer = null;
let highlightCardFilterObserver = null;
let highlightCardFilterRefreshTimer = null;
let fullscreenClickBlockerEnabled = true;

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

html::highlight(${CUSTOM_HIGHLIGHT_NAME}) {
  background: #7cff7c;
  color: black;
}

html .${HIGHLIGHT_CARD_FILTERED_CLASS_NAME} {
  display: none !important;
}

html.${CONTROL_BAR_HIDDEN_CLASS_NAME} ${CONTROL_BAR_SELECTOR} {
  display: none !important;
}

#${FULLSCREEN_CLICK_BLOCKER_ID} {
  position: fixed !important;
  inset: 200px 0 !important;
  z-index: 2147483647 !important;
  background: transparent !important;
  pointer-events: auto !important;
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

function toggleControlBar() {
  ensureStyle();
  const enabled = document.documentElement.classList.toggle(
    CONTROL_BAR_HIDDEN_CLASS_NAME
  );
  chrome.storage.local.set({ [CONTROL_BAR_STORAGE_KEY]: enabled });
}

function setControlBarHidden(enabled) {
  ensureStyle();
  document.documentElement.classList.toggle(
    CONTROL_BAR_HIDDEN_CLASS_NAME,
    Boolean(enabled)
  );
}

function isEditableTarget(target) {
  return Boolean(
    target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
  );
}

function startShortcutListener() {
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key?.toLowerCase() !== "i") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      toggleControlBar();
    },
    true
  );
}

function stopMouseEvent(event) {
  if (event.type !== "mousemove" && event.type !== "pointermove") {
    event.preventDefault();
  }

  event.stopPropagation();
  event.stopImmediatePropagation();
}

function createFullscreenClickBlocker() {
  const blocker = document.createElement("div");
  blocker.id = FULLSCREEN_CLICK_BLOCKER_ID;
  blocker.setAttribute("aria-hidden", "true");

  [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchend",
    "click",
    "auxclick",
    "dblclick",
    "contextmenu",
    "mousemove",
    "wheel"
  ].forEach((type) => {
    blocker.addEventListener(type, stopMouseEvent, true);
    blocker.addEventListener(type, stopMouseEvent, false);
  });

  return blocker;
}

function updateFullscreenClickBlocker() {
  ensureStyle();

  const fullscreenElement = document.fullscreenElement;
  const blocker = document.getElementById(FULLSCREEN_CLICK_BLOCKER_ID);

  if (!fullscreenClickBlockerEnabled || !fullscreenElement) {
    blocker?.remove();
    return;
  }

  if (blocker && blocker.parentElement === fullscreenElement) return;

  blocker?.remove();
  fullscreenElement.appendChild(createFullscreenClickBlocker());
}

function setFullscreenClickBlocking(enabled) {
  fullscreenClickBlockerEnabled = Boolean(enabled);
  updateFullscreenClickBlocker();
}

function startFullscreenClickBlocker() {
  document.addEventListener("fullscreenchange", updateFullscreenClickBlocker);
  updateFullscreenClickBlocker();
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;

  return Boolean(
    parent.closest(
      `script, style, noscript, textarea, input`
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

function removeHighlights() {
  CSS.highlights?.delete?.(CUSTOM_HIGHLIGHT_NAME);

  document.querySelectorAll(`.${HIGHLIGHT_CLASS_NAME}`).forEach((highlight) => {
    const textNode = document.createTextNode(highlight.textContent || "");
    const parent = highlight.parentNode;
    highlight.replaceWith(textNode);
    parent?.normalize();
  });
}

function collectHighlightRanges(root = document.body || document.documentElement) {
  if (!root || !("Highlight" in window) || !CSS.highlights) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const ranges = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (shouldSkipNode(node)) continue;

    const text = node.nodeValue || "";
    if (!text.includes(HIGHLIGHT_TEXT)) continue;

    const textBeforeNode = getTextBeforeNode(node);
    let cursor = 0;

    while (cursor < text.length) {
      const index = text.indexOf(HIGHLIGHT_TEXT, cursor);
      if (index === -1) break;

      const textBeforeMatch = textBeforeNode + text.slice(0, index);
      const isExcluded = textBeforeMatch.endsWith(EXCLUDED_HIGHLIGHT_PREFIX);

      if (!isExcluded) {
        const range = new Range();
        range.setStart(node, index);
        range.setEnd(node, index + HIGHLIGHT_TEXT.length);
        ranges.push(range);
      }

      cursor = index + HIGHLIGHT_TEXT.length;
    }
  }

  return ranges;
}

function refreshHighlights() {
  highlightRefreshTimer = null;
  removeHighlights();

  if (!("Highlight" in window) || !CSS.highlights) return;

  const ranges = collectHighlightRanges();
  CSS.highlights.set(CUSTOM_HIGHLIGHT_NAME, new Highlight(...ranges));
}

function scheduleHighlightRefresh() {
  if (highlightRefreshTimer) {
    clearTimeout(highlightRefreshTimer);
  }

  highlightRefreshTimer = setTimeout(refreshHighlights, 150);
}

function setHighlighting(enabled) {
  ensureStyle();

  if (!enabled) {
    highlightObserver?.disconnect();
    highlightObserver = null;
    if (highlightRefreshTimer) {
      clearTimeout(highlightRefreshTimer);
      highlightRefreshTimer = null;
    }
    removeHighlights();
    return;
  }

  refreshHighlights();

  if (highlightObserver) return;

  highlightObserver = new MutationObserver(() => {
    scheduleHighlightRefresh();
  });

  highlightObserver.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isAllowedHighlightTitle(text) {
  const normalizedText = normalizeText(text);
  return (
    normalizedText.includes(HIGHLIGHT_TEXT) &&
    !normalizedText.includes(EXCLUDED_HIGHLIGHT_PREFIX + HIGHLIGHT_TEXT)
  );
}

function getCardTitleText(element) {
  const titleElement = element.querySelector?.(
    "a[class*='title'], a[class*='Title'], [class*='title'], [class*='Title'], strong, h1, h2, h3, h4"
  );
  const titleText = titleElement?.getAttribute?.("title") || titleElement?.textContent;
  const fallbackText = element.getAttribute?.("title") || element.textContent;

  return normalizeText(titleText || fallbackText);
}

function getBestCardTitleText(card, candidate) {
  const titleCandidates = [
    ...card.querySelectorAll(
      "a[class*='title'], a[class*='Title'], [class*='title'], [class*='Title'], strong, h1, h2, h3, h4"
    )
  ];

  const videoTitle = titleCandidates.find((element) => {
    const text = normalizeText(element.getAttribute?.("title") || element.textContent);
    const href = element.getAttribute?.("href") || "";
    return text.length >= 4 && text.length <= 160 && /\/video\//.test(href);
  });

  const titleElement =
    videoTitle ||
    titleCandidates.find((element) => {
      const text = normalizeText(element.getAttribute?.("title") || element.textContent);
      return text.length >= 4 && text.length <= 160;
    });

  return normalizeText(
    titleElement?.getAttribute?.("title") ||
      titleElement?.textContent ||
      getCardTitleText(candidate)
  );
}

function isCardCandidate(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  if (element.id === FULLSCREEN_CLICK_BLOCKER_ID) return false;
  if (element.closest?.(`.${HIGHLIGHT_CARD_FILTERED_CLASS_NAME}`)) return true;
  if (element.closest?.("header, nav, footer, aside, script, style, noscript")) {
    return false;
  }

  const text = getCardTitleText(element);
  if (text.length < 4 || text.length > 160) return false;

  const href = element.getAttribute?.("href") || "";
  const hasMedia = Boolean(
    element.querySelector?.("img, picture, video, canvas, [class*='thumb'], [class*='Thumb']")
  );
  const looksLikeContentLink = /(?:clip|video|vod|news|content|lounge|watch)/i.test(href);

  return hasMedia || looksLikeContentLink;
}

function findCardRoot(element) {
  return (
    element.closest?.("li, article, [class*='card'], [class*='Card'], [class*='item'], [class*='Item']") ||
    element
  );
}

function filterHighlightCards(root = document) {
  ensureStyle();

  const scope = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE
    ? root
    : document;

  const cards = new Map();

  if (scope.matches?.("a[href], [role='link']") && isCardCandidate(scope)) {
    cards.set(findCardRoot(scope), scope);
  }

  scope.querySelectorAll?.("a[href], [role='link']").forEach((element) => {
    if (isCardCandidate(element)) {
      cards.set(findCardRoot(element), element);
    }
  });

  cards.forEach((candidate, card) => {
    const title = getBestCardTitleText(card, candidate);
    card.classList.toggle(
      HIGHLIGHT_CARD_FILTERED_CLASS_NAME,
      !isAllowedHighlightTitle(title)
    );
  });
}

function removeHighlightCardFilterClasses() {
  document
    .querySelectorAll(`.${HIGHLIGHT_CARD_FILTERED_CLASS_NAME}`)
    .forEach((element) => {
      element.classList.remove(HIGHLIGHT_CARD_FILTERED_CLASS_NAME);
    });
}

function clearHighlightCardFilter() {
  highlightCardFilterObserver?.disconnect();
  highlightCardFilterObserver = null;
  if (highlightCardFilterRefreshTimer) {
    clearTimeout(highlightCardFilterRefreshTimer);
    highlightCardFilterRefreshTimer = null;
  }
  removeHighlightCardFilterClasses();
}

function refreshHighlightCardFilter() {
  highlightCardFilterRefreshTimer = null;
  removeHighlightCardFilterClasses();
  filterHighlightCards(document);
}

function scheduleHighlightCardFilterRefresh() {
  if (highlightCardFilterRefreshTimer) {
    clearTimeout(highlightCardFilterRefreshTimer);
  }

  highlightCardFilterRefreshTimer = setTimeout(refreshHighlightCardFilter, 150);
}

function setHighlightCardFilter(enabled) {
  if (!enabled) {
    clearHighlightCardFilter();
    return;
  }

  refreshHighlightCardFilter();

  if (highlightCardFilterObserver) return;

  highlightCardFilterObserver = new MutationObserver(() => {
    scheduleHighlightCardFilterRefresh();
  });

  highlightCardFilterObserver.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

chrome.storage.local.get({ [STORAGE_KEY]: true }, (items) => {
  setImageBlocking(items[STORAGE_KEY]);
});

chrome.storage.local.get({ [CONTROL_BAR_STORAGE_KEY]: false }, (items) => {
  setControlBarHidden(items[CONTROL_BAR_STORAGE_KEY]);
});

chrome.storage.local.get({ [HIGHLIGHT_STORAGE_KEY]: true }, (items) => {
  setHighlighting(items[HIGHLIGHT_STORAGE_KEY]);
});

chrome.storage.local.get(
  { [FULLSCREEN_CLICK_BLOCKER_STORAGE_KEY]: true },
  (items) => {
    setFullscreenClickBlocking(items[FULLSCREEN_CLICK_BLOCKER_STORAGE_KEY]);
  }
);

chrome.storage.local.get(
  { [HIGHLIGHT_CARD_FILTER_STORAGE_KEY]: false },
  (items) => {
    setHighlightCardFilter(items[HIGHLIGHT_CARD_FILTER_STORAGE_KEY]);
  }
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[STORAGE_KEY]) {
    setImageBlocking(changes[STORAGE_KEY].newValue);
  }

  if (changes[CONTROL_BAR_STORAGE_KEY]) {
    setControlBarHidden(changes[CONTROL_BAR_STORAGE_KEY].newValue);
  }

  if (changes[HIGHLIGHT_STORAGE_KEY]) {
    setHighlighting(changes[HIGHLIGHT_STORAGE_KEY].newValue);
  }

  if (changes[FULLSCREEN_CLICK_BLOCKER_STORAGE_KEY]) {
    setFullscreenClickBlocking(
      changes[FULLSCREEN_CLICK_BLOCKER_STORAGE_KEY].newValue
    );
  }

  if (changes[HIGHLIGHT_CARD_FILTER_STORAGE_KEY]) {
    setHighlightCardFilter(changes[HIGHLIGHT_CARD_FILTER_STORAGE_KEY].newValue);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SET_CHZZK_IMAGE_BLOCKING") return;

  setImageBlocking(message.enabled);
  sendResponse({ ok: true });
});

startShortcutListener();
startFullscreenClickBlocker();
