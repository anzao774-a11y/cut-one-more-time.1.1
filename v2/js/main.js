
import { state, loadGame, saveGame, exportSave, importSave } from "./state.js";
import { singlePull, tenPull, getPityStatus } from "./gacha.js";
import {
  initAudio,
  playSound,
  startAmbient,
  setVolume,
  setMuted
} from "./audio.js";
import {
  getInventory,
  getAllInventory
} from "./inventory.js";
import {
  inspectWithFlashlight,
  inspectWithMagnifier,
  inspectWithScanner,
  getAppraisalHistory
} from "./appraisal.js";

console.log("[Game] Main module loaded");

// ============================================================
// DOM helpers
// ============================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

// ============================================================
// Notification
// ============================================================

let notificationTimer = null;

function notify(message, type = "normal") {
  const element = $("#notification");

  if (!element) {
    console.log(`[Notification] ${message}`);
    return;
  }

  element.textContent = message;
  element.classList.add("show");
  element.dataset.type = type;

  clearTimeout(notificationTimer);

  notificationTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2600);
}

// ============================================================
// Gold display
// ============================================================

function renderGold() {
  setText("#gold", formatNumber(state.player.gold));
}

// ============================================================
// Page navigation
// ============================================================

function showPage(pageName) {
  $$(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });

  $$(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  if (pageName === "inventory") {
    renderInventory();
  }

  if (pageName === "appraisal") {
    renderAppraisal();
  }
}

$$(".nav-button[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
    playSound("button");
  });
});

// ============================================================
// Audio and settings
// ============================================================

let audioInitialized = false;

function initializeAudioOnce() {
  if (audioInitialized) return;

  audioInitialized = true;
  initAudio();

  if (state.settings.sound !== false) {
    startAmbient();
  }

  applyAudioSettings();
}

document.addEventListener("pointerdown", initializeAudioOnce, {
  once: true
});

function applyAudioSettings() {
  const settings = state.settings;

  setMuted(settings.sound === false);

  const volumes = settings.volumes || {
    master: 0.8,
    music: 0.35,
    sfx: 0.8
  };

  setVolume("master", Number(volumes.master));
  setVolume("music", Number(volumes.music));
  setVolume("sfx", Number(volumes.sfx));
}

function initializeSettings() {
  state.settings.volumes ||= {
    master: 0.8,
    music: 0.35,
    sfx: 0.8
  };

  const soundToggle = $(
    "#sound-toggle, #sound-enabled, [data-setting='sound']"
  );

  const animationToggle = $(
    "#animation-toggle, #animation-enabled, [data-setting='animation']"
  );

  if (soundToggle) {
    soundToggle.checked = state.settings.sound !== false;

    soundToggle.addEventListener("change", () => {
      state.settings.sound = soundToggle.checked;
      setMuted(!soundToggle.checked);

      if (soundToggle.checked && audioInitialized) {
        startAmbient();
      }

      saveGame();
    });
  }

  if (animationToggle) {
    animationToggle.checked = state.settings.animation !== false;

    animationToggle.addEventListener("change", () => {
      state.settings.animation = animationToggle.checked;
      saveGame();
    });
  }

  const volumeSelectors = {
    master: "#master-volume, #volume-master, [data-volume='master']",
    music: "#music-volume, #volume-music, [data-volume='music']",
    sfx: "#sfx-volume, #volume-sfx, [data-volume='sfx']"
  };

  Object.entries(volumeSelectors).forEach(([channel, selector]) => {
    const slider = $(selector);
    if (!slider) return;

    slider.value = state.settings.volumes[channel];

    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      const normalized = value > 1 ? value / 100 : value;

      state.settings.volumes[channel] = normalized;
      setVolume(channel, normalized);
      saveGame();
    });
  });

  applyAudioSettings();
}

// ============================================================
// Save export / import
// ============================================================

function downloadSave() {
  const saveText = exportSave();

  const blob = new Blob([saveText], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "再切一刀就好_存檔.json";
  link.click();

  URL.revokeObjectURL(url);
  notify("存檔已匯出");
}

function importSaveFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const success = importSave(String(reader.result));

    if (success) {
      notify("存檔匯入成功，正在重新整理");
      setTimeout(() => location.reload(), 800);
    } else {
      notify("存檔格式錯誤，無法匯入", "error");
    }
  };

  reader.onerror = () => {
    notify("讀取存檔失敗", "error");
  };

  reader.readAsText(file);
}

function initializeSaveControls() {
  const exportButton = $(
    "#export-save, #save-export, [data-action='export-save']"
  );

  const importButton = $(
    "#import-save, #save-import, [data-action='import-save']"
  );

  const fileInput = $(
    "#import-file, #save-file, input[type='file'][data-save-import]"
  );

  if (exportButton) {
    exportButton.addEventListener("click", downloadSave);
  }

  if (importButton && fileInput) {
    importButton.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      importSaveFile(fileInput.files?.[0]);
      fileInput.value = "";
    });
  }
}

// ============================================================
// Gacha
// ============================================================

function renderResults(stones) {
  const container = $("#draw-results");
  if (!container) return;

  container.replaceChildren();

  if (!Array.isArray(stones) || stones.length === 0) {
    container.textContent = "尚未抽取原石";
    return;
  }

  stones.forEach((stone) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const name = document.createElement("strong");
    name.textContent = stone.name || "未命名原石";

    const rarity = document.createElement("span");
    rarity.textContent = stone.rarityName || stone.rarity || "未知";

    const value = document.createElement("span");
    value.textContent =
      `估價 ${formatNumber(stone.estimatedValue)} G`;

    card.append(name, rarity, value);
    container.appendChild(card);
  });
}

function renderPity() {
  const pity = getPityStatus();

  setText(
    "#pity-status",
    `距離史詩保底：${pity.epic.current}/${pity.epic.required}｜距離傳說保底：${pity.legendary.current}/${pity.legendary.required}`
  );
}

function handleSinglePull() {
  try {
    const result = singlePull();

    if (!result || !result.success) {
      notify(
        result?.message || "單抽失敗，請確認金幣是否足夠",
        "error"
      );
      return;
    }

    renderResults(result.results);
    renderGold();
    renderPity();
    renderInventory();

    playSound("draw");
    notify(result.message || "獲得一塊新的原石！");

    console.log("[Gacha] Single pull success:", result.results);

  } catch (error) {
    console.error("[Gacha] Single pull failed:", error);
    notify("單抽時發生錯誤", "error");
  }
}

function handleTenPull() {
  try {
    const result = tenPull();

    if (!result || !result.success) {
      notify(
        result?.message || "十連抽失敗，請確認金幣是否足夠",
        "error"
      );
      return;
    }

    renderResults(result.results);
    renderGold();
    renderPity();
    renderInventory();

    playSound("draw");
    notify(
      `十連抽完成，獲得 ${result.results.length} 顆原石`
    );

    console.log("[Gacha] Ten pull success:", result.results);

  } catch (error) {
    console.error("[Gacha] Ten pull failed:", error);
    notify("十連抽時發生錯誤", "error");
  }
}

$("#draw-one")?.addEventListener("click", handleSinglePull);
$("#draw-ten")?.addEventListener("click", handleTenPull);

// ============================================================
// Inventory
// ============================================================

let currentInventoryType = "stones";

const inventoryLabels = {
  stones: "原石",
  materials: "材料",
  jewelry: "玉器",
  scraps: "碎料"
};

function getCurrentInventory() {
  const inventory = getInventory(currentInventoryType);
  return Array.isArray(inventory) ? inventory : [];
}

function renderInventorySummary() {
  const container = $("#inventory-summary");
  if (!container) return;

  const all = getAllInventory() || {};

  const stats = Object.entries(inventoryLabels).map(([type, label]) => {
    const count = Array.isArray(all[type]) ? all[type].length : 0;

    return `
      <div class="inventory-stat">
        <span>${label}</span>
        <strong>${formatNumber(count)}</strong>
      </div>
    `;
  });

  container.innerHTML = stats.join("");
}

function createInventoryCard(item, type) {
  const card = document.createElement("article");
  card.className = "inventory-card";

  const name = document.createElement("h3");
  name.textContent = item.name || "未命名物品";

  const details = document.createElement("p");

  if (type === "stones") {
    details.textContent =
      `${item.rarityName || item.rarity || "未知"}｜${item.shape || "未知形狀"}｜${formatNumber(item.weight)} g`;
  } else {
    details.textContent =
      item.description || item.typeName || inventoryLabels[type];
  }

  const value = document.createElement("p");
  value.textContent =
    `估計價值：${formatNumber(item.estimatedValue ?? item.value)} G`;

  card.append(name, details, value);

  if (type === "stones") {
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const appraisalButton = document.createElement("button");
    appraisalButton.className = "secondary-button";
    appraisalButton.textContent = "前往鑑定";

    appraisalButton.addEventListener("click", () => {
      window.selectedStoneId = item.id;
      showPage("appraisal");
      renderAppraisal();
    });

    const cuttingButton = document.createElement("button");
    cuttingButton.className = "primary-button";
    cuttingButton.textContent = "前往切石";

    cuttingButton.addEventListener("click", () => {
      window.selectedStoneId = item.id;
      showPage("cutting");
 console.log("[Main] 發送原石選取事件：", item.id);

window.dispatchEvent(
  new CustomEvent("cutting:select", {
    detail: { stoneId: item.id }
  })
);
      notify(`已選取：${item.name}`);
    });

    actions.append(appraisalButton, cuttingButton);
    card.appendChild(actions);
  }

  return card;
}

function renderInventory() {
  renderInventorySummary();

  const container = $("#inventory-content");
  if (!container) return;

  const searchInput = $(
    "#inventory-search, #inventory-filter, [data-inventory-search]"
  );

  const keyword = (searchInput?.value || "").trim().toLowerCase();

  const items = getCurrentInventory().filter((item) => {
    const text = [
      item.name,
      item.rarityName,
      item.rarity,
      item.shape,
      item.description
    ].join(" ").toLowerCase();

    return text.includes(keyword);
  });

  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "目前沒有符合條件的物品";
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "inventory-grid";

  items.forEach((item) => {
    grid.appendChild(createInventoryCard(item, currentInventoryType));
  });

  container.appendChild(grid);
}

$$("[data-inventory-type]").forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.inventoryType;

    if (!inventoryLabels[type]) return;

    currentInventoryType = type;

    $$("[data-inventory-type]").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    renderInventory();
  });
});

$(
  "#inventory-search, #inventory-filter, [data-inventory-search]"
)?.addEventListener("input", renderInventory);

 // 切割完成後更新倉庫與金幣顯示
document.addEventListener("cutting:completed", () => {
  renderInventory();
  renderGold();
});

// ============================================================
// Appraisal
// ============================================================

function getSelectedStone() {
  const stones = getInventory("stones") || [];

  return stones.find(
    (stone) => stone.id === window.selectedStoneId
  ) || stones[0] || null;
}

function renderAppraisal() {
  const container = $("#appraisal-content");
  if (!container) return;

  container.replaceChildren();

  const stone = getSelectedStone();

  if (!stone) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      "目前沒有可鑑定的原石，先去抽取一些原石吧。";

    container.appendChild(empty);
    return;
  }

  window.selectedStoneId = stone.id;

  const title = document.createElement("h3");
  title.textContent = stone.name || "未命名原石";

  const description = document.createElement("p");
  description.textContent =
    `${stone.rarityName || stone.rarity || "未知"}｜${stone.shape || "未知形狀"}｜${formatNumber(stone.weight)} g`;

  const value = document.createElement("p");
  value.textContent =
    `目前估價：${formatNumber(stone.estimatedValue)} G`;

  container.append(title, description, value);

  const tools = [
    {
      id: "flashlight",
      label: "使用手電筒",
      sound: "flashlight",
      action: () => inspectWithFlashlight(stone.id)
    },
    {
      id: "magnifier",
      label: "使用放大鏡",
      sound: "scan",
      action: () => inspectWithMagnifier(stone.id)
    },
    {
      id: "scanner",
      label: "使用掃描器",
      sound: "scan",
      action: () => inspectWithScanner(stone.id)
    }
  ];

  tools.forEach((tool) => {
    const button = document.createElement("button");
    button.className = "secondary-button";
    button.textContent = tool.label;

    button.addEventListener("click", () => {
      try {
        const result = tool.action();

        if (!result?.success) {
          notify(result?.message || "鑑定失敗", "error");
          return;
        }

        playSound(tool.sound);
        renderAppraisalResult(result);
        saveGame();

      } catch (error) {
        console.error("[Appraisal] Failed:", error);
        notify("鑑定時發生錯誤", "error");
      }
    });

    container.appendChild(button);
  });

  const history = getAppraisalHistory(stone.id);

  if (history) {
    const historyTitle = document.createElement("h3");
    historyTitle.textContent = "鑑定紀錄";
    container.appendChild(historyTitle);

    ["flashlight", "magnifier", "scanner"].forEach((type) => {
      const records = history[type] || [];

      records.forEach((record) => {
        const line = document.createElement("p");

        line.textContent =
          `${type}：${record.hint || record.crackHint || record.qualityHint || "已完成鑑定"}`;

        container.appendChild(line);
      });
    });
  }
}

function renderAppraisalResult(result) {
  const container = $("#appraisal-content");
  if (!container) return;

  const resultBox = document.createElement("div");
  resultBox.className = "panel";

  const title = document.createElement("h3");
  title.textContent = "鑑定結果";

  const details = document.createElement("p");

  if (result.tool === "flashlight") {
    details.textContent =
      `${result.result.hint}｜顏色：${result.result.color}｜準確度：${result.result.accuracy}%`;

  } else if (result.tool === "magnifier") {
    details.textContent =
      `${result.result.crackHint}｜${result.result.impurityHint}｜準確度：${result.result.accuracy}%`;

  } else if (result.tool === "scanner") {
    details.textContent =
      `預估玉肉數量：${result.result.estimatedJadeCount}｜${result.result.qualityHint}｜準確度：${result.result.accuracy}%`;

  } else {
    details.textContent = "鑑定完成";
  }

  resultBox.append(title, details);
  container.appendChild(resultBox);
}

// ============================================================
// Geometry test entry
// ============================================================

window.runGeometrySelfTest = async function () {
  const { runGeometrySelfTest } = await import("./geometry-test.js");
  return runGeometrySelfTest();
};

// ============================================================
// Initial startup
// ============================================================

loadGame();

state.settings ||= {};
state.settings.sound ??= true;
state.settings.animation ??= true;

renderGold();
renderPity();
renderInventory();

initializeSettings();
initializeSaveControls();

console.log("[Game] Initialization complete");
