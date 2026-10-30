
import { state, loadGame } from "./state.js";
import { singlePull, tenPull, getPityStatus } from "./gacha.js";
import {
  initAudio,
  playSound,
  startAmbient,
  setVolume,
  setMuted,
  startSaw,
  stopSaw
} from "./audio.js";
console.log("[Game] Main module loaded");

// DOM
const goldElement = document.getElementById("gold");
const resultElement = document.getElementById("draw-results");
const notificationElement = document.getElementById("notification");

// 金幣顯示
function renderGold() {
  goldElement.textContent =
    `${state.player.gold.toLocaleString("zh-TW")} G`;
}

// 通知訊息
function notify(message) {
  if (!notificationElement) return;

  notificationElement.textContent = message;
  notificationElement.classList.add("show");

  setTimeout(() => {
    notificationElement.classList.remove("show");
  }, 2500);
}

// 頁面切換
function showPage(pageName) {
  const target = document.getElementById(`page-${pageName}`);

  if (!target) return;

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.remove("active");
  });

  target.classList.add("active");

  const button = document.querySelector(
    `.nav-button[data-page="${pageName}"]`
  );

  if (button) button.classList.add("active");
}

document.querySelectorAll(".nav-button").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

// 抽卡結果顯示
function renderResults(results, message) {
  resultElement.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = message;
  resultElement.appendChild(heading);

  results.forEach((stone, index) => {
    const card = document.createElement("div");

    card.className = "result-card";
    card.style.borderLeft = `4px solid ${stone.rarityColor}`;

    const name = document.createElement("strong");
    name.textContent = `${stone.rarityName}｜${stone.name}`;

    const number = document.createElement("span");
    number.textContent = `第 ${index + 1} 顆`;

    card.append(number, name);
    resultElement.appendChild(card);
  });

  const pity = getPityStatus();

  const pityText = document.createElement("p");
  pityText.textContent =
    `極稀有保底：${pity.epic.current}/${10}　` +
    `傳奇保底：${pity.legendary.current}/${30}`;

  resultElement.appendChild(pityText);
}

// 執行抽卡
function draw(pullFunction) {
  const result = pullFunction();

  renderGold();

  if (!result.success) {
    notify(result.message);
    playSound("error");
    return;
  }

  playSound("draw");

  const hasLegendary = result.results.some(
    stone => stone.rarity === "legendary"
  );

  const hasEpic = result.results.some(
    stone => stone.rarity === "epic"
  );

  if (hasLegendary) {
    playSound("legendary");
  } else if (hasEpic) {
    playSound("rare");
  } else {
    playSound("stone");
  }

  renderResults(result.results, result.message);
  notify(result.message);
}

// 單抽按鈕
document.getElementById("draw-one").addEventListener("click", () => {
  draw(singlePull);
});

// 十連抽按鈕
document.getElementById("draw-ten").addEventListener("click", () => {
  draw(tenPull);
});

// 啟動遊戲
loadGame();
renderGold();

console.log("[Game] 頁面切換與抽卡系統已啟動");

// 幾何測試獨立載入，不影響其他功能
window.runGeometrySelfTest = async function () {
  const { runGeometrySelfTest } = await import("./geometry-test.js");
  return runGeometrySelfTest();
};
// 使用者第一次操作時啟動音效
document.addEventListener("pointerdown", async function () {
  await initAudio();
  await startAmbient();
}, { once: true });

// 側邊欄按鈕音效
document.querySelectorAll(".nav-button").forEach(button => {
  button.addEventListener("click", () => {
    playSound("button");
  });
});
