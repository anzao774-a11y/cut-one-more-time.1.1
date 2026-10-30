
export const GACHA_CONFIG = {
  singleCost: 500,
  tenPullCost: 4500,

  rarities: [
    {
      id: "common",
      name: "普通",
      chance: 55,
      color: "#a6a6a6"
    },
    {
      id: "fine",
      name: "精良",
      chance: 27,
      color: "#55b77a"
    },
    {
      id: "rare",
      name: "稀有",
      chance: 13,
      color: "#4b9ee8"
    },
    {
      id: "epic",
      name: "極稀有",
      chance: 4.5,
      color: "#ad78e8"
    },
    {
      id: "legendary",
      name: "傳奇",
      chance: 0.5,
      color: "#e9b84f"
    }
  ],

  epicPity: 10,
  legendaryPity: 30
};

export const JADE_TYPES = [
  {
    id: "nephrite",
    name: "軟玉",
    baseValue: 80,
    rarity: 1,
    colors: ["#d6e5c8", "#a9c5a0", "#789b83"],
    transparency: [0.2, 0.55],
    texture: ["細膩", "普通"]
  },
  {
    id: "qingyu",
    name: "青玉",
    baseValue: 130,
    rarity: 1.2,
    colors: ["#557e72", "#77988b", "#a4b9a8"],
    transparency: [0.25, 0.65],
    texture: ["細膩", "油潤"]
  },
  {
    id: "white_jade",
    name: "白玉",
    baseValue: 220,
    rarity: 1.6,
    colors: ["#eee9db", "#d9d5c9", "#c8c5ba"],
    transparency: [0.35, 0.8],
    texture: ["細膩", "溫潤"]
  },
  {
    id: "ice_jade",
    name: "冰種翡翠",
    baseValue: 650,
    rarity: 3,
    colors: ["#b8e9df", "#c5eee9", "#a4d8d0"],
    transparency: [0.65, 0.95],
    texture: ["冰透", "細膩"]
  },
  {
    id: "violet_jade",
    name: "紫羅蘭翡翠",
    baseValue: 900,
    rarity: 3.5,
    colors: ["#b99bd6", "#a98ac9", "#d0b8e5"],
    transparency: [0.35, 0.8],
    texture: ["細膩", "溫潤"]
  },
  {
    id: "imperial_green",
    name: "帝王綠翡翠",
    baseValue: 3000,
    rarity: 5,
    colors: ["#087b42", "#15965b", "#075b36"],
    transparency: [0.6, 0.95],
    texture: ["極細膩", "冰透"]
  }
];

export const STONE_SHAPES = [
  "橢圓形",
  "不規則形",
  "圓形",
  "長條形",
  "扁平形",
  "多角形"
];

export const STONE_SIZES = [
  {
    id: "small",
    name: "小型",
    weightRange: [100, 500],
    valueMultiplier: 0.8
  },
  {
    id: "medium",
    name: "中型",
    weightRange: [500, 2000],
    valueMultiplier: 1
  },
  {
    id: "large",
    name: "大型",
    weightRange: [2000, 6000],
    valueMultiplier: 1.5
  },
  {
    id: "huge",
    name: "巨型",
    weightRange: [6000, 15000],
    valueMultiplier: 2.2
  }
];

export const STONE_RARITY_RULES = {
  common: {
    jadeCount: [0, 1],
    jadeSize: [0.05, 0.2],
    impurity: [0.3, 0.8],
    crack: [0.2, 0.8]
  },

  fine: {
    jadeCount: [1, 2],
    jadeSize: [0.1, 0.35],
    impurity: [0.2, 0.65],
    crack: [0.15, 0.65]
  },

  rare: {
    jadeCount: [1, 3],
    jadeSize: [0.15, 0.5],
    impurity: [0.1, 0.5],
    crack: [0.1, 0.5]
  },

  epic: {
    jadeCount: [2, 4],
    jadeSize: [0.25, 0.65],
    impurity: [0.05, 0.4],
    crack: [0.05, 0.4]
  },

  legendary: {
    jadeCount: [2, 5],
    jadeSize: [0.35, 0.8],
    impurity: [0, 0.3],
    crack: [0, 0.3]
  }
};

export const CUTTING_CONFIG = {
  bladeThickness: 0.025,
  bladeRadius: 1.5,
  cuttingSpeed: 0.8,
  materialLoss: 0.025
};

export const MUSEUM_CONFIG = {
  incomeRatePerMinute: 0.05,
  offlineLimitHours: 8
};

export const CRAFTING_CONFIG = {
  baseScrapBuyRate: 0.32,

  molds: [
    {
      id: "jade_bangle",
      name: "玉鐲",
      type: "ring",
      hole: true
    },
    {
      id: "ring",
      name: "戒指",
      type: "solid",
      hole: false
    },
    {
      id: "pendant",
      name: "項鍊墜飾",
      type: "solid",
      hole: false
    },
    {
      id: "earring",
      name: "耳環",
      type: "solid",
      hole: false
    }
  ]
};
