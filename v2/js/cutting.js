
import { CUTTING_CONFIG } from "./data.js";

// 向量工具
function vectorLength(v) {
  return Math.sqrt(
    v.x * v.x +
    v.y * v.y +
    v.z * v.z
  );
}

function normalizeVector(v) {
  const length = vectorLength(v);

  if (length === 0) {
    throw new Error("切割方向不能是零向量。");
  }

  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length
  };
}

function dot(a, b) {
  return (
    a.x * b.x +
    a.y * b.y +
    a.z * b.z
  );
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 將角度轉換成切割平面的法向量
export function angleToNormal(angleX, angleY) {
  const radX = angleX * Math.PI / 180;
  const radY = angleY * Math.PI / 180;

  return normalizeVector({
    x: Math.sin(radY),
    y: -Math.sin(radX) * Math.cos(radY),
    z: Math.cos(radX) * Math.cos(radY)
  });
}

// 建立切割平面
// plane equation: normal · position = offset
export function createCutPlane(
  normal,
  offset
) {
  if (!Number.isFinite(offset)) {
    throw new Error("切割位置必須是有效數值。");
  }

  const normalized = normalizeVector(normal);

  return {
    normal: normalized,
    offset,
    equation: {
      a: normalized.x,
      b: normalized.y,
      c: normalized.z,
      d: -offset
    }
  };
}

// 計算一個點位於切割平面的哪一側
export function getPointSide(point, plane) {
  const distance =
    dot(plane.normal, point) - plane.offset;

  if (Math.abs(distance) < 0.000001) {
    return {
      side: "on-plane",
      distance: 0
    };
  }

  return {
    side: distance > 0 ? "positive" : "negative",
    distance
  };
}

// 計算鋸片中心位置
export function getBladePosition(plane) {
  return {
    x: plane.normal.x * plane.offset,
    y: plane.normal.y * plane.offset,
    z: plane.normal.z * plane.offset
  };
}

// 建立切割計畫
export function createCutPlan(
  stone,
  settings = {}
) {
  if (!stone || !stone.id) {
    throw new Error("找不到有效的原石資料。");
  }

  const angleX = Number(settings.angleX ?? 0);
  const angleY = Number(settings.angleY ?? 0);
  const offset = Number(settings.offset ?? 0);

  if (
    !Number.isFinite(angleX) ||
    !Number.isFinite(angleY) ||
    !Number.isFinite(offset)
  ) {
    throw new Error("切割設定包含無效數值。");
  }

  const normal = angleToNormal(
    angleX,
    angleY
  );

  const plane = createCutPlane(
    normal,
    offset
  );

  const thickness = CUTTING_CONFIG.bladeThickness;

  return {
    id: createId(),
    stoneId: stone.id,

    settings: {
      angleX,
      angleY,
      offset
    },

    plane,

    blade: {
      thickness,
      radius: CUTTING_CONFIG.bladeRadius,
      center: getBladePosition(plane)
    },

    status: "preview",

    createdAt: Date.now()
  };
}

// 建立切割預覽資訊
export function createCutPreview(
  stone,
  settings = {}
) {
  const plan = createCutPlan(stone, settings);

  const dimensions = stone.dimensions || {
    x: 1,
    y: 1,
    z: 1
  };

  const approximateRadius = Math.sqrt(
    dimensions.x ** 2 +
    dimensions.y ** 2 +
    dimensions.z ** 2
  ) / 2;

  const maxDistance = approximateRadius;

  return {
    plan,

    preview: {
      plane: plan.plane,
      blade: plan.blade,

      thickness: plan.blade.thickness,

      estimatedBladeTravel:
        maxDistance * 2 +
        plan.blade.thickness,

      isGeometricPreview: false
    }
  };
}

// 計算點到切割平面的距離
export function distanceToPlane(point, plane) {
  return (
    dot(plane.normal, point) -
    plane.offset
  );
}

// 判斷玉肉中心位於切割平面的哪一側
export function classifyJadeContents(
  jadeContents,
  plane
) {
  return jadeContents.map(jade => {
    const result = getPointSide(
      jade.position,
      plane
    );

    return {
      jadeId: jade.id,
      side: result.side,
      distance: result.distance
    };
  });
}

// 建立切割紀錄資料
export function createCutRecord(plan, result = {}) {
  return {
    id: createId(),
    planId: plan.id,
    stoneId: plan.stoneId,

    settings: { ...plan.settings },

    bladeThickness: plan.blade.thickness,

    result: {
      success: Boolean(result.success),
      quality: result.quality ?? null,
      materialLoss: result.materialLoss ?? null
    },

    timestamp: Date.now()
  };
}
