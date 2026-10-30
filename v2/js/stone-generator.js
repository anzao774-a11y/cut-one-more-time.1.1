
import {
  JADE_TYPES,
  STONE_SHAPES,
  STONE_SIZES,
  STONE_RARITY_RULES
} from "./data.js";

function random(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function randomRange(range) {
  return random(range[0], range[1]);
}

function createFlaws(count, type) {
  return Array.from({ length: count }, () => ({
    id: createId(),
    type,
    position: {
      x: random(-0.45, 0.45),
      y: random(-0.45, 0.45),
      z: random(-0.45, 0.45)
    },
    size: random(0.02, 0.12),
    severity: random(0.1, 1)
  }));
}

function createJadeContents(rules) {
  const count = randomInt(
    rules.jadeCount[0],
    rules.jadeCount[1]
  );

  const contents = [];

  for (let i = 0; i < count; i++) {
    const jadeType = pick(JADE_TYPES);

    const size = randomRange(rules.jadeSize);

    const color = pick(jadeType.colors);

    contents.push({
      id: createId(),

      jadeTypeId: jadeType.id,
      jadeTypeName: jadeType.name,

      shape: pick([
        "橢圓",
        "不規則",
        "圓形",
        "條狀",
        "片狀"
      ]),

      position: {
        x: random(-0.35, 0.35),
        y: random(-0.35, 0.35),
        z: random(-0.35, 0.35)
      },

      dimensions: {
        x: size * random(0.7, 1.4),
        y: size * random(0.7, 1.4),
        z: size * random(0.5, 1.2)
      },

      color,
      transparency: randomRange(
        jadeType.transparency
      ),

      texture: pick(jadeType.texture),

      quality: random(0.45, 1),

      estimatedValue: 0,
      potentialValue: 0
    });
  }

  return contents;
}

function calculateValue(contents, weight) {
  let estimatedValue = 0;
  let potentialValue = 0;

  for (const jade of contents) {
    const type = JADE_TYPES.find(
      item => item.id === jade.jadeTypeId
    );

    const volume =
      jade.dimensions.x *
      jade.dimensions.y *
      jade.dimensions.z;

    const qualityMultiplier = jade.quality;

    jade.estimatedValue = Math.round(
      type.baseValue *
      volume *
      qualityMultiplier *
      100
    );

    jade.potentialValue = Math.round(
      jade.estimatedValue *
      random(1.2, 2.5)
    );

    estimatedValue += jade.estimatedValue;
    potentialValue += jade.potentialValue;
  }

  return {
    estimatedValue: Math.round(
      estimatedValue + weight * 0.5
    ),

    potentialValue: Math.round(
      potentialValue + weight
    )
  };
}

export function generateStone(rarity) {
  const rarityId =
    typeof rarity === "string"
      ? rarity
      : rarity.id;

  const rarityInfo =
    typeof rarity === "string"
      ? null
      : rarity;

  const rules = STONE_RARITY_RULES[rarityId];

  if (!rules) {
    throw new Error(`未知原石稀有度：${rarityId}`);
  }

  const sizeInfo = pick(STONE_SIZES);

  const weight = randomInt(
    sizeInfo.weightRange[0],
    sizeInfo.weightRange[1]
  );

  const shape = pick(STONE_SHAPES);

  const jadeContents = createJadeContents(rules);

  const crackCount = randomInt(
    Math.round(rules.crack[0] * 10),
    Math.round(rules.crack[1] * 10)
  );

  const impurityCount = randomInt(
    Math.round(rules.impurity[0] * 10),
    Math.round(rules.impurity[1] * 10)
  );

  const cracks = createFlaws(
    crackCount,
    "crack"
  );

  const impurities = createFlaws(
    impurityCount,
    "impurity"
  );

  const values = calculateValue(
    jadeContents,
    weight
  );

  const dimensions = {
    x: random(0.7, 1.3) * sizeInfo.valueMultiplier,
    y: random(0.7, 1.3) * sizeInfo.valueMultiplier,
    z: random(0.7, 1.3) * sizeInfo.valueMultiplier
  };

  return {
    id: createId(),

    name: `${rarityInfo?.name ?? rarityId}原石`,
    rarity: rarityId,
    rarityName: rarityInfo?.name ?? rarityId,
    rarityColor: rarityInfo?.color ?? "#aaaaaa",

    shape,
    size: sizeInfo.name,
    weight,
    dimensions,

    jadeContents,
    cracks,
    impurities,

    estimatedValue: values.estimatedValue,
    potentialValue: values.potentialValue,

    status: "unexamined",

    cuttingHistory: [],
    createdAt: Date.now(),
    obtainedAt: Date.now()
  };
}
