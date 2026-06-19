const SETTINGS = {
  images: {
    key: "hideChzzkImages",
    defaultValue: true
  },
  highlight: {
    key: "highlightChzzkText",
    defaultValue: true
  },
  fullscreenClickBlocker: {
    key: "blockFullscreenClicks",
    defaultValue: true
  },
  highlightCardFilter: {
    key: "filterHighlightCardsOnly",
    defaultValue: false
  }
};

function getDefaults() {
  return Object.fromEntries(
    Object.values(SETTINGS).map((setting) => [
      setting.key,
      setting.defaultValue
    ])
  );
}

function updateStatus(name, enabled) {
  const status = document.querySelector(`[data-status="${name}"]`);
  if (!status) return;

  status.textContent = enabled ? "켜짐" : "꺼짐";
}

function updateToggle(name, enabled) {
  const toggle = document.querySelector(`[data-setting="${name}"]`);
  if (!toggle) return;

  toggle.checked = enabled;
  updateStatus(name, enabled);
}

chrome.storage.local.get(getDefaults(), (items) => {
  for (const [name, setting] of Object.entries(SETTINGS)) {
    updateToggle(name, Boolean(items[setting.key]));
  }
});

document.querySelectorAll("[data-setting]").forEach((toggle) => {
  toggle.addEventListener("change", async () => {
    const name = toggle.dataset.setting;
    const setting = SETTINGS[name];
    if (!setting) return;

    const enabled = toggle.checked;
    await chrome.storage.local.set({ [setting.key]: enabled });
    updateStatus(name, enabled);
  });
});
