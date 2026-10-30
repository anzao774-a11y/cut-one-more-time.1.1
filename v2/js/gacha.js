
import { state, spendGold, saveGame } from "./state.js";
import { GACHA_CONFIG } from "./data.js";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 從指定範圍內抽取稀有度
function weightedRandom(rarities) {
  const totalWeight = rarities.reduce(
    (sum, rarity) => sum + rarity.chance,
    0
  );

  let random = Math.random() * totalWeight;

  for (const rarity of rarities) {
    random -= rarity.chance;

    if (random < 0) {
      return rarity;
    }
  }

  return rarities[rarities.length - 1];
}

// 判斷本次抽卡的稀有度
function determineRarity(forceEpic = false) {
  const rarities = GACHA_CONFIG.rarities;

  // 傳奇保底優先
  if (
    state.gacha.pullsSinceLegendary >=
    GACHA_CONFIG.legendaryPity - 1
  ) {
    return rarities.find(r => r.id === "legendary");
  }

  // 極稀有保底或十連保底
  if (
    forceEpic ||
    state.gacha.pullsSinceEpic >=
    GACHA_CONFIG.epicPity - 1
  ) {
    return weightedRandom(
      rarities.filter(
        r => r.id === "epic" || r.id === "legendary"
      )
    );
  }

  return weightedRandom(rarities);
}

// 建立抽中的原石資料
function createStone(rarity) {
  return {
    id: createId(),
    name: `${rarity.name}原石`,
    rarity: rarity.id,
    rarityName: rarity.name,
    rarityColor: rarity.color,

    // 原石生成系統之後會補上完整資料
    shape: null,
    size: null,
    weight: null,
    jadeContents: [],
    estimatedValue: 0,
    potentialValue: 0,

    status: "unexamined",
    obtainedAt: Date.now()
  };
}

// 執行單次抽卡
function performPull(forceEpic = false) {
  const rarity = determineRarity(forceEpic);

  state.gacha.totalPulls += 1;
  state.gacha.pullsSinceEpic += 1;
  state.gacha.pullsSinceLegendary += 1;

  if (
    rarity.id === "epic" ||
    rarity.id === "legendary"
  ) {
    state.gacha.pullsSinceEpic = 0;
  }

  if (rarity.id === "legendary") {
    state.gacha.pullsSinceLegendary = 0;
  }

  const stone = createStone(rarity);

  state.inventory.stones.push(stone);

  return stone;
}

// 單抽
export function singlePull() {
  if (!spendGold(GACHA_CONFIG.singleCost)) {
    return {
      success: false,
      message: "金幣不足，無法抽卡。",
      results: []
    };
  }

  const stone = performPull();

  saveGame();

  return {
    success: true,
    message: "抽卡成功！",
    results: [stone]
  };
}

// 十連抽
export function tenPull() {
  if (!spendGold(GACHA_CONFIG.tenPullCost)) {
    return {
      success: false,
      message: "金幣不足，無法進行十連抽。",
      results: []
    };
  }

  const results = [];

  for (let i = 0; i < 10; i++) {
    const hasEpicOrBetter = results.some(
      stone =>
        stone.rarity === "epic" ||
        stone.rarity === "legendary"
    );

    // 前九抽沒有極稀有以上時，
    // 第十抽強制至少極稀有
    const forceEpic = i === 9 && !hasEpicOrBetter;

    results.push(performPull(forceEpic));
  }

  saveGame();

  return {
    success: true,
    message: "十連抽完成！",
    results
  };
}

// 查看目前保底進度
export function getPityStatus() {
  return {
    totalPulls: state.gacha.totalPulls,

    epic: {
      current: state.gacha.pullsSinceEpic,
      remaining: Math.max(
        0,
        GACHA_CONFIG.epicPity -
        state.gacha.pullsSinceEpic
      )
    },

    legendary: {
      current: state.gacha.pullsSinceLegendary,
      remaining: Math.max(
        0,
        GACHA_CONFIG.legendaryPity -
        state.gacha.pullsSinceLegendary
      )
    }
  };
}
