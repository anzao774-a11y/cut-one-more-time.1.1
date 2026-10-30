
import { state, addGold, saveGame } from "./state.js";
import { JADE_TYPES, CRAFTING_CONFIG } from "./data.js";
import { getItem, removeItem } from "./inventory.js";

function random(min, max) {
  return min + Math.random() * (max - min);
}

function round(value) {
  return Math.max(0, Math.round(value));
}

function ensureMarketPrice(jadeTypeId) {
  if (!state.market.prices[jadeTypeId]) {
    const jade = JADE_TYPES.find(
      item => item.id === jadeTypeId
    );

    if (!jade) return null;

    state.market.prices[jadeTypeId] = {
      basePrice: jade.baseValue,
      currentPrice: jade.baseValue,
      changeRate: 0,
      updatedAt: Date.now()
    };
  }

  return state.market.prices[jadeTypeId];
}

// 更新單一玉種行情
export function updateMarketPrice(jadeTypeId) {
  const market = ensureMarketPrice(jadeTypeId);

  if (!market) return null;

  const changeRate = random(-0.04, 0.04);

  market.currentPrice = round(
    market.currentPrice * (1 + changeRate)
  );

  market.changeRate = changeRate;
  market.updatedAt = Date.now();

  state.market.history.push({
    jadeTypeId,
    price: market.currentPrice,
    changeRate,
    timestamp: Date.now()
  });

  saveGame();

  return market;
}

// 更新所有玉種行情
export function updateAllMarketPrices() {
  return JADE_TYPES.map(jade =>
    updateMarketPrice(jade.id)
  );
}

// 取得玉種目前行情
export function getMarketPrice(jadeTypeId) {
  return ensureMarketPrice(jadeTypeId);
}

// 取得所有行情
export function getAllMarketPrices() {
  return JADE_TYPES.map(jade => ({
    jadeTypeId: jade.id,
    jadeTypeName: jade.name,
    ...ensureMarketPrice(jade.id)
  }));
}

// 計算物品實際出售價格
export function calculateSellPrice(type, item) {
  if (!item) return 0;

  const baseValue = Number(
    item.estimatedValue
  ) || 0;

  if (type === "scraps") {
    return round(
      baseValue *
      CRAFTING_CONFIG.baseScrapBuyRate
    );
  }

  const jadeId =
    item.jadeTypeId ||
    item.jadeContents?.[0]?.jadeTypeId;

  if (!jadeId) {
    return baseValue;
  }

  const market = ensureMarketPrice(jadeId);

  if (!market) {
    return baseValue;
  }

  const jade = JADE_TYPES.find(
    entry => entry.id === jadeId
  );

  const multiplier =
    market.currentPrice / jade.baseValue;

  return round(baseValue * multiplier);
}

// 出售物品
export function sellItem(type, itemId) {
  const item = getItem(type, itemId);

  if (!item) {
    return {
      success: false,
      message: "找不到指定物品。",
      price: 0
    };
  }

  const price = calculateSellPrice(type, item);

  if (price <= 0) {
    return {
      success: false,
      message: "物品目前沒有可出售價值。",
      price: 0
    };
  }

  // 先移除物品，避免重複出售
  const removedItem = removeItem(type, itemId);

  if (!removedItem) {
    return {
      success: false,
      message: "出售失敗。",
      price: 0
    };
  }

  addGold(price);

  const transaction = {
    type: "sell",
    itemType: type,
    itemId,
    itemName: item.name || "未命名物品",
    price,
    timestamp: Date.now()
  };

  state.records.transactions.push(transaction);

  saveGame();

  return {
    success: true,
    message: `出售成功，獲得 ${price} G。`,
    price,
    transaction
  };
}

// 查看近期市場價格歷史
export function getMarketHistory(
  jadeTypeId,
  limit = 30
) {
  return state.market.history
    .filter(
      entry => entry.jadeTypeId === jadeTypeId
    )
    .slice(-limit);
}

// 初始化市場資料
export function initializeMarket() {
  for (const jade of JADE_TYPES) {
    ensureMarketPrice(jade.id);
  }

  saveGame();

  return getAllMarketPrices();
}
