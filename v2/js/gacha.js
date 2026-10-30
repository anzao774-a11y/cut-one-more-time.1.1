

import { state, spendGold, saveGame } from "./state.js";
import { GACHA_CONFIG } from "./data.js";
import { generateStone } from "./stone-generator.js";

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.chance, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.chance;
    if (roll < 0) return item;
  }

  return items[items.length - 1];
}

function getRarityIndex(rarityId) {
  return GACHA_CONFIG.rarities.findIndex(
    item => item.id === rarityId
  );
}

function determineRarity(forceEpic = false) {
  const epicIndex = getRarityIndex("epic");
  const legendaryIndex = getRarityIndex("legendary");

  const legendaryDue =
    state.gacha.pullsSinceLegendary >=
    GACHA_CONFIG.legendaryPity - 1;

  const epicDue =
    state.gacha.pullsSinceEpic >=
    GACHA_CONFIG.epicPity - 1;

  if (legendaryDue) {
    return GACHA_CONFIG.rarities[legendaryIndex];
  }

  if (forceEpic || epicDue) {
    const eligible = GACHA_CONFIG.rarities.filter(
      item => getRarityIndex(item.id) >= epicIndex
    );

    return weightedRandom(eligible);
  }

  return weightedRandom(GACHA_CONFIG.rarities);
}

function performPull(forceEpic = false) {
  const rarity = determineRarity(forceEpic);

  // 使用完整原石生成器
  const stone = generateStone(rarity);

  state.gacha.totalPulls += 1;

  const isEpicOrHigher =
    getRarityIndex(rarity.id) >= getRarityIndex("epic");

  const isLegendary = rarity.id === "legendary";

  state.gacha.pullsSinceEpic =
    isEpicOrHigher
      ? 0
      : state.gacha.pullsSinceEpic + 1;

  state.gacha.pullsSinceLegendary =
    isLegendary
      ? 0
      : state.gacha.pullsSinceLegendary + 1;

  state.inventory.stones.push(stone);

  return stone;
}

function insufficientFunds(cost) {
  return {
    success: false,
    message: `金幣不足，需要 ${cost.toLocaleString("zh-TW")} G。`,
    results: []
  };
}

export function singlePull() {
  const cost = GACHA_CONFIG.singleCost;

  if (state.player.gold < cost) {
    return insufficientFunds(cost);
  }

  if (!spendGold(cost)) {
    return insufficientFunds(cost);
  }

  const stone = performPull();

  saveGame();

  return {
    success: true,
    message: "獲得一塊新的原石！",
    results: [stone]
  };
}

export function tenPull() {
  const cost = GACHA_CONFIG.tenPullCost;

  if (state.player.gold < cost) {
    return insufficientFunds(cost);
  }

  if (!spendGold(cost)) {
    return insufficientFunds(cost);
  }

  const results = [];
  let hasEpicOrHigher = false;

  for (let i = 0; i < 10; i++) {
    // 第十抽若前九抽沒有極稀有以上，強制觸發保底
    const forceEpic = i === 9 && !hasEpicOrHigher;

    const stone = performPull(forceEpic);

    results.push(stone);

    if (
      getRarityIndex(stone.rarity) >=
      getRarityIndex("epic")
    ) {
      hasEpicOrHigher = true;
    }
  }

  saveGame();

  return {
    success: true,
    message: "十連開石完成！",
    results
  };
}

export function getPityStatus() {
  return {
    epic: {
      current: state.gacha.pullsSinceEpic,
      required: GACHA_CONFIG.epicPity
    },
    legendary: {
      current: state.gacha.pullsSinceLegendary,
      required: GACHA_CONFIG.legendaryPity
    }
  };
}
