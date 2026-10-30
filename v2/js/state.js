
const SAVE_KEY = "cutOneMoreTime_v2_save";

export const defaultState = {
  version: 2,

  player: {
    gold: 10000,
    totalSpent: 0,
    totalEarned: 0
  },

  gacha: {
    totalPulls: 0,
    pullsSinceEpic: 0,
    pullsSinceLegendary: 0
  },

  inventory: {
    stones: [],
    materials: [],
    jewelry: [],
    scraps: []
  },

  museum: {
    exhibits: [],
    lastClaimTime: Date.now(),
    totalEarned: 0
  },

  skills: {
    appraisal: 1,
    cutting: 1,
    crafting: 1,
    trading: 1
  },

  collection: {
    stoneDex: [],
    jadeDex: [],
    jewelryDex: [],
    achievements: []
  },

  market: {
    prices: {},
    history: []
  },

  records: {
    transactions: [],
    cuttingHistory: []
  },

  settings: {
    sound: true,
    animation: true
  }
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function mergeState(defaults, saved) {
  if (
    typeof defaults !== "object" ||
    defaults === null ||
    Array.isArray(defaults)
  ) {
    return saved === undefined ? defaults : saved;
  }

  if (
    typeof saved !== "object" ||
    saved === null ||
    Array.isArray(saved)
  ) {
    return cloneValue(defaults);
  }

  const result = { ...defaults };

  for (const key of Object.keys(defaults)) {
    result[key] = mergeState(defaults[key], saved[key]);
  }

  for (const key of Object.keys(saved)) {
    if (!(key in defaults)) {
      result[key] = saved[key];
    }
  }

  return result;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export let state = cloneDefaultState();

export function saveGame() {
  try {
    const saveData = {
      ...state,
      savedAt: Date.now()
    };

    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(saveData)
    );

    return true;
  } catch (error) {
    console.error("遊戲存檔失敗：", error);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
      state = cloneDefaultState();
      return false;
    }

    const saved = JSON.parse(raw);
    state = mergeState(defaultState, saved);

    return true;
  } catch (error) {
    console.error("遊戲讀檔失敗：", error);
    state = cloneDefaultState();
    return false;
  }
}

export function resetGame() {
  state = cloneDefaultState();
  saveGame();
  return state;
}

export function exportSave() {
  return JSON.stringify(
    {
      ...state,
      exportedAt: Date.now()
    },
    null,
    2
  );
}

export function importSave(jsonText) {
  try {
    const imported = JSON.parse(jsonText);

    if (
      typeof imported !== "object" ||
      imported === null ||
      !imported.player ||
      !imported.inventory
    ) {
      throw new Error("存檔格式不正確");
    }

    state = mergeState(defaultState, imported);
    saveGame();

    return true;
  } catch (error) {
    console.error("匯入存檔失敗：", error);
    return false;
  }
}

export function addGold(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  state.player.gold += amount;
  state.player.totalEarned += amount;
  saveGame();

  return true;
}

export function spendGold(amount) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    state.player.gold < amount
  ) {
    return false;
  }

  state.player.gold -= amount;
  state.player.totalSpent += amount;
  saveGame();

  return true;
}

export function recordTransaction(record) {
  state.records.transactions.push({
    ...record,
    timestamp: Date.now()
  });

  saveGame();
}
