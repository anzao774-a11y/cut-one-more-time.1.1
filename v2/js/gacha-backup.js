
import { state, spendGold, saveGame } from "./state.js";
import { GACHA_CONFIG } from "./data.js";
import { generateStone } from "./stone-generator.js";

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

// 判斷本次抽卡稀有度
function determineRarity(forceEpic = false) {
  const rarities = GACHA_CONFIG.rarities;

  // 傳奇保底
  if (
    state.gacha.pullsSinceLegendary >=
    GACHA_CONFIG.legendaryPity - 1
  ) {
    return rarities.find(
      rarity => rarity.id === "legendary"
    );
  }

  // 極稀有保底或十連保底
  if (
    forceEpic ||
    state.gacha.pullsSinceEpic >=
    GACHA_CONFIG.epicPity - 1
  ) {
    return weightedRandom(
      rarities.filter(
        rarity =>
          rarity.id === "epic" ||
          rarity.id === "legendary"
      )
    );
  }

  return weightedRandom(rarities);
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

  // 直接生成完整原石
  const stone = generateStone(rarity);

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

  try {
    const stone = performPull();

    saveGame();

    return {
      success: true,
      message: "抽卡成功！",
      results: [stone]
    };
  } catch (error) {
    console.error("單抽失敗：", error);

    return {
      success: false,
      message: "原石生成失敗，請重新嘗試。",
      results: []
    };
  }
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

  const originalGacha = {
    ...state.gacha
  };

  const originalInventoryLength =
    state.inventory.stones.length;

  const results = [];

  try {
    for (let i = 0; i < 10; i++) {
      const hasEpicOrBetter = results.some(
        stone =>
          stone.rarity === "epic" ||
          stone.rarity === "legendary"
      );

      const forceEpic =
        i === 9 && !hasEpicOrBetter;

      results.push(performPull(forceEpic));
    }

    saveGame();

    return {
      success: true,
      message: "十連抽完成！",
      results
    };
  } catch (error) {
    console.error("十連抽失敗：", error);

    // 發生錯誤時回復抽卡資料
    Object.assign(state.gacha, originalGacha);

    state.inventory.stones.splice(
      originalInventoryLength
    );

    // 退還十連抽金幣
    state.player.gold += GACHA_CONFIG.tenPullCost;
    state.player.totalSpent -= GACHA_CONFIG.tenPullCost;

    saveGame();

    return {
      success: false,
      message: "抽卡發生錯誤，金幣已退還。",
      results: []
    };
  }
}

// 查看保底進度
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
