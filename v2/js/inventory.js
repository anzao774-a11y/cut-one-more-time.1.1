
import { state, saveGame } from "./state.js";

export const INVENTORY_TYPES = [
  "stones",
  "materials",
  "jewelry",
  "scraps"
];

export const ITEM_TYPES = {
  STONE: "stone",
  FRAGMENT: "fragment",
  JADE: "jade",
  MATERIAL: "material",
  JEWELRY: "jewelry",
  SCRAP: "scrap"
};

function ensureInventory() {
  if (!state.inventory || typeof state.inventory !== "object") {
    state.inventory = {};
  }

  for (const type of INVENTORY_TYPES) {
    if (!Array.isArray(state.inventory[type])) {
      state.inventory[type] = [];
    }
  }
}

function isValidType(type) {
  return INVENTORY_TYPES.includes(type);
}

function findItemIndex(type, id) {
  if (!isValidType(type)) return -1;

  return state.inventory[type].findIndex(
    item => item && item.id === id
  );
}

function findItem(type, id) {
  const index = findItemIndex(type, id);

  if (index === -1) return null;

  return state.inventory[type][index];
}

function getItemName(item) {
  return item?.name || "未命名物品";
}

// 取得指定類別的倉庫物品
export function getInventory(type) {
  ensureInventory();

  if (!isValidType(type)) return [];

  return state.inventory[type];
}

// 取得所有倉庫物品
export function getAllInventory() {
  ensureInventory();

  return {
    stones: state.inventory.stones,
    materials: state.inventory.materials,
    jewelry: state.inventory.jewelry,
    scraps: state.inventory.scraps
  };
}

// 依照物品編號搜尋
export function getItem(type, id) {
  ensureInventory();

  if (!id) return null;

  return findItem(type, id);
}

// 取得物品分類
export function getItemCategory(item, inventoryType = "") {
  if (!item) return "unknown";

  if (item.type === "fragment" || item.kind === "fragment") {
    return ITEM_TYPES.FRAGMENT;
  }

  if (item.type === "jade" || item.kind === "jade") {
    return ITEM_TYPES.JADE;
  }

  if (item.type === "material" || item.kind === "material") {
    return ITEM_TYPES.MATERIAL;
  }

  if (item.type === "jewelry" || item.kind === "jewelry") {
    return ITEM_TYPES.JEWELRY;
  }

  if (item.type === "scrap" || item.kind === "scrap") {
    return ITEM_TYPES.SCRAP;
  }

  if (inventoryType === "stones") return ITEM_TYPES.STONE;
  if (inventoryType === "jewelry") return ITEM_TYPES.JEWELRY;
  if (inventoryType === "scraps") return ITEM_TYPES.SCRAP;
  if (inventoryType === "materials") return ITEM_TYPES.MATERIAL;

  if (Array.isArray(item.jadeContents)) {
    return ITEM_TYPES.STONE;
  }

  return "unknown";
}

// 新增物品
export function addItem(type, item) {
  ensureInventory();

  if (!isValidType(type)) return false;
  if (!item || !item.id) return false;

  const exists = state.inventory[type].some(
    current => current && current.id === item.id
  );

  if (exists) return false;

  state.inventory[type].push(item);

  saveGame();

  return true;
}

// 將物品從一個類別移至另一個類別
export function moveItem(fromType, toType, id) {
  ensureInventory();

  if (
    !isValidType(fromType) ||
    !isValidType(toType) ||
    fromType === toType
  ) {
    return false;
  }

  const source = state.inventory[fromType];
  const target = state.inventory[toType];

  const index = source.findIndex(
    item => item && item.id === id
  );

  if (index === -1) return false;

  const item = source[index];

  const duplicate = target.some(
    current => current && current.id === id
  );

  if (duplicate) return false;

  source.splice(index, 1);
  target.push(item);

  saveGame();

  return true;
}

// 依照物品編號移除物品
export function removeItem(type, id) {
  ensureInventory();

  if (!isValidType(type)) return null;

  const index = findItemIndex(type, id);

  if (index === -1) return null;

  const [removedItem] = state.inventory[type].splice(index, 1);

  saveGame();

  return removedItem;
}

// 計算倉庫物品數量
export function getInventoryCount(type) {
  ensureInventory();

  if (!isValidType(type)) return 0;

  return state.inventory[type].length;
}

// 計算倉庫物品總估值
export function getInventoryValue(type) {
  ensureInventory();

  if (!isValidType(type)) return 0;

  return state.inventory[type].reduce(
    (total, item) => {
      return total + (Number(item?.estimatedValue) || 0);
    },
    0
  );
}

// 取得所有分類統計
export function getInventoryStats() {
  ensureInventory();

  const stats = {};

  for (const type of INVENTORY_TYPES) {
    stats[type] = {
      count: getInventoryCount(type),
      value: getInventoryValue(type)
    };
  }

  stats.totalCount = INVENTORY_TYPES.reduce(
    (sum, type) => sum + stats[type].count,
    0
  );

  stats.totalValue = INVENTORY_TYPES.reduce(
    (sum, type) => sum + stats[type].value,
    0
  );

  return stats;
}

// 搜尋所有類別的物品
export function searchInventory(keyword) {
  ensureInventory();

  const query = String(keyword ?? "")
    .trim()
    .toLowerCase();

  if (!query) return [];

  const results = [];

  for (const type of INVENTORY_TYPES) {
    for (const item of state.inventory[type]) {
      if (!item) continue;

      const searchableText = [
        item.id,
        item.name,
        item.rarity,
        item.rarityName,
        item.jadeTypeId,
        item.jadeTypeName,
        item.status,
        item.type,
        item.kind
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchableText.includes(query)) {
        results.push({
          type,
          category: getItemCategory(item, type),
          item
        });
      }
    }
  }

  return results;
}

// 依估值排序
export function sortInventory(type, order = "desc") {
  const items = getInventory(type);

  return [...items].sort((a, b) => {
    const valueA = Number(a?.estimatedValue) || 0;
    const valueB = Number(b?.estimatedValue) || 0;

    return order === "asc"
      ? valueA - valueB
      : valueB - valueA;
  });
}

// 依條件篩選
export function filterInventory(type, options = {}) {
  const items = getInventory(type);

  return items.filter(item => {
    if (!item) return false;

    if (
      options.rarity &&
      item.rarity !== options.rarity
    ) {
      return false;
    }

    if (
      options.status &&
      item.status !== options.status
    ) {
      return false;
    }

    if (
      options.category &&
      getItemCategory(item, type) !== options.category
    ) {
      return false;
    }

    return true;
  });
}

// 清理沒有任何玉肉的無用半塊
// 有玉肉的半塊永遠不會被自動清除
export function cleanEmptyFragments() {
  ensureInventory();

  const materials = state.inventory.materials;
  const before = materials.length;

  state.inventory.materials = materials.filter(item => {
    if (!item) return false;

    const hasJade =
      Array.isArray(item.jadeContents) &&
      item.jadeContents.length > 0;

    const isFragment =
      item.type === "fragment" ||
      item.kind === "fragment";

    return !isFragment || hasJade;
  });

  const removed = before - state.inventory.materials.length;

  if (removed > 0) saveGame();

  return removed;
}

// 將倉庫資料儲存
export function saveInventory() {
  ensureInventory();
  saveGame();
}
