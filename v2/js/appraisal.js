
import { state, saveGame } from "./state.js";
import { getItem } from "./inventory.js";

function random(min, max) {
  return min + Math.random() * (max - min);
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getStone(stoneId) {
  return getItem("stones", stoneId);
}

function getAccuracy() {
  const level = state.skills.appraisal || 1;

  return Math.min(
    0.95,
    0.45 + (level - 1) * 0.08
  );
}

function ensureAppraisalData(stone) {
  if (!stone.appraisal) {
    stone.appraisal = {
      flashlight: [],
      magnifier: [],
      scanner: [],
      lastExamined: null
    };
  }

  return stone.appraisal;
}

// 手電筒鑑定
export function inspectWithFlashlight(stoneId) {
  const stone = getStone(stoneId);

  if (!stone) {
    return {
      success: false,
      message: "找不到指定原石。"
    };
  }

  const accuracy = getAccuracy();
  const jade = stone.jadeContents || [];

  const averageTransparency = jade.length
    ? jade.reduce(
        (sum, item) => sum + item.transparency,
        0
      ) / jade.length
    : 0;

  const observedTransparency =
    averageTransparency * random(
      1 - (1 - accuracy) * 0.5,
      1 + (1 - accuracy) * 0.5
    );

  let result;

  if (jade.length === 0) {
    result = {
      light: "透光反應不明顯",
      color: "未觀察到明顯玉色",
      hint: "目前無法確認內部是否存在玉肉。"
    };
  } else if (observedTransparency > 0.7) {
    result = {
      light: "透光反應明顯",
      color: pick(["綠色調", "淡色調", "混合色調"]),
      hint: "內部可能存在透明度較高的玉肉。"
    };
  } else if (observedTransparency > 0.35) {
    result = {
      light: "具有一定透光反應",
      color: pick(["綠色調", "灰白色調", "混合色調"]),
      hint: "內部可能存在中等透明度的玉肉。"
    };
  } else {
    result = {
      light: "透光反應較弱",
      color: "顏色特徵不明顯",
      hint: "內部可能較為混濁，也可能受到原石外皮影響。"
    };
  }

  const appraisal = ensureAppraisalData(stone);

  const record = {
    ...result,
    accuracy,
    timestamp: Date.now()
  };

  appraisal.flashlight.push(record);
  appraisal.lastExamined = Date.now();

  saveGame();

  return {
    success: true,
    tool: "手電筒",
    result: record
  };
}

// 放大鏡鑑定
export function inspectWithMagnifier(stoneId) {
  const stone = getStone(stoneId);

  if (!stone) {
    return {
      success: false,
      message: "找不到指定原石。"
    };
  }

  const accuracy = getAccuracy();

  const cracks = stone.cracks || [];
  const impurities = stone.impurities || [];

  const observedCracks = Math.round(
    cracks.length * random(
      accuracy,
      1 + (1 - accuracy)
    )
  );

  const observedImpurities = Math.round(
    impurities.length * random(
      accuracy,
      1 + (1 - accuracy)
    )
  );

  let crackHint;

  if (observedCracks === 0) {
    crackHint = "表面未發現明顯裂紋。";
  } else if (observedCracks <= 3) {
    crackHint = "發現少量裂紋，需要留意切割方向。";
  } else {
    crackHint = "發現較多裂紋，切割時可能產生損耗。";
  }

  let impurityHint;

  if (observedImpurities === 0) {
    impurityHint = "表面雜質不明顯。";
  } else if (observedImpurities <= 3) {
    impurityHint = "發現少量雜質。";
  } else {
    impurityHint = "雜質分布較多，建議仔細選擇切割位置。";
  }

  const appraisal = ensureAppraisalData(stone);

  const record = {
    crackHint,
    impurityHint,
    observedCracks,
    observedImpurities,
    accuracy,
    timestamp: Date.now()
  };

  appraisal.magnifier.push(record);
  appraisal.lastExamined = Date.now();

  saveGame();

  return {
    success: true,
    tool: "放大鏡",
    result: record
  };
}

// 進階探測儀
export function inspectWithScanner(stoneId) {
  const stone = getStone(stoneId);

  if (!stone) {
    return {
      success: false,
      message: "找不到指定原石。"
    };
  }

  const accuracy = Math.min(
    0.99,
    getAccuracy() + 0.12
  );

  const jade = stone.jadeContents || [];

  const actualCount = jade.length;

  const estimatedCount = Math.max(
    0,
    actualCount + Math.round(
      random(-1, 1) * (1 - accuracy) * 2
    )
  );

  const averageQuality = actualCount
    ? jade.reduce(
        (sum, item) => sum + item.quality,
        0
      ) / actualCount
    : 0;

  let qualityHint;

  if (averageQuality > 0.8) {
    qualityHint = "探測到的內部結構品質可能相當出色。";
  } else if (averageQuality > 0.55) {
    qualityHint = "探測到的內部結構品質中等。";
  } else if (actualCount > 0) {
    qualityHint = "探測到的內部結構可能存在品質缺陷。";
  } else {
    qualityHint = "目前未探測到明顯玉肉訊號。";
  }

  const appraisal = ensureAppraisalData(stone);

  const record = {
    estimatedJadeCount: estimatedCount,
    qualityHint,
    accuracy,
    timestamp: Date.now()
  };

  appraisal.scanner.push(record);
  appraisal.lastExamined = Date.now();

  saveGame();

  return {
    success: true,
    tool: "進階探測儀",
    result: record
  };
}

// 查看原石所有鑑定紀錄
export function getAppraisalHistory(stoneId) {
  const stone = getStone(stoneId);

  if (!stone) {
    return null;
  }

  return stone.appraisal || {
    flashlight: [],
    magnifier: [],
    scanner: [],
    lastExamined: null
  };
}
