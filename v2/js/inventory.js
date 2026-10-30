
import { state, saveGame } from "./state.js";

const INVENTORY_TYPES = [
  "stones",
  "materials",
  "jewelry",
  "scraps"
];

function findItem(type, id) {
  if (!INVENTORY_TYPES.includes(type)) {
    return null;
  }

  return state.inventory[type].find(
    item => item.id === id
  ) ?? null;
}

// 取得指定類別的倉庫物品
export function getInventory(type) {
  if (!INVENTORY_TYPES.includes(type)) {
    return [];
  }

  return state.inventory[type];
}

// 取得所有倉庫物品
export function getAllInventory() {
  return {
    stones: state.inventory.stones,
    materials: state.inventory.materials,
    jewelry: state.inventory.jewelry,
    scraps: state.inventory.scraps
  };
}

// 依照物品編號搜尋
export function getItem(type, id) {
  return findItem(type, id);
}

// 新增物品
export function addItem(type, item) {
  if (!INVENTORY_TYPES.includes(type)) {
    return false;
  }

  if (!item || !item.id) {
    return false;
  }

  const exists = state.inventory[type].some(
    current => current.id === item.id
  );

  if (exists) {
    return false;
  }

  state.inventory[type].push(item);

  saveGame();

  return true;
}

// 將物品從一個類別移至另一個類別
export function moveItem(
  fromType,
  toType,
  id
) {
  if (
    !INVENTORY_TYPES.includes(fromType) ||
    !INVENTORY_TYPES.includes(toType) ||
    fromType === toType
  ) {
    return false;
  }

  const source = state.inventory[fromType];

  const index = source.findIndex(
    item => item.id === id
  );

  if (index === -1) {
    return false;
  }

  const item = source[index];

  const duplicate = state.inventory[toType].some(
    current => current.id === id
  );

  if (duplicate) {
    return false;
  }

  source.splice(index, 1);
  state.inventory[toType].push(item);

  saveGame();

  return true;
}

// 依照物品編號移除物品
export function removeItem(type, id) {
  if (!INVENTORY_TYPES.includes(type)) {
    return null;
  }

  const items = state.inventory[type];

  const index = items.findIndex(
    item => item.id === id
  );

  if (index === -1) {
    return null;
  }

  const [removedItem] = items.splice(index, 1);

  saveGame();

  return removedItem;
}

// 計算倉庫物品數量
export function getInventoryCount(type) {
  if (!INVENTORY_TYPES.includes(type)) {
    return 0;
  }

  return state.inventory[type].length;
}

// 計算倉庫物品總估值
export function getInventoryValue(type) {
  if (!INVENTORY_TYPES.includes(type)) {
    return 0;
  }

  return state.inventory[type].reduce(
    (total, item) => {
      return total + (
        Number(item.estimatedValue) || 0
      );
    },
    0
  );
}

// 搜尋所有類別的物品
export function searchInventory(keyword) {
  const query = String(keyword)
    .trim()
    .toLowerCase();

  if (!query) {
    return [];
  }

  const results = [];

  for (const type of INVENTORY_TYPES) {
    for (const item of state.inventory[type]) {
      const searchableText = [
        item.id,
        item.name,
        item.rarityName,
        item.jadeTypeName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchableText.includes(query)) {
        results.push({
          type,
          item
        });
      }
    }
  }

  return results;
}

// 清理沒有任何玉肉的無用半塊
// 有玉肉的半塊永遠不會被自動清除
export function cleanEmptyFragments() {
  const materials = state.inventory.materials;

  const before = materials.length;

  state.inventory.materials =
    materials.filter(item => {
      const hasJade =
        Array.isArray(item.jadeContents) &&
        item.jadeContents.length > 0;

      const isFragment =
        item.type === "fragment" ||
        item.kind === "fragment";

      return !isFragment || hasJade;
    });

  const removed = before -
    state.inventory.materials.length;

  if (removed > 0) {
    saveGame();
  }

  return removed;
}
