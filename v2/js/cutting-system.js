import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { state, saveGame } from "./state.js";
import { getInventory } from "./inventory.js";

import {
  initializeGeometryEngine,
  cutSolidGeometry,
  getBladeThickness
} from "./geometry-engine.js";

const $ = selector => document.querySelector(selector);

const viewer = $("#stone-viewer");
const infoNode = $("#selected-stone-info");
const statusNode = $("#cut-status");

const previewButton = $("#preview-cut");
const cutButton = $("#start-cut");

let scene;
let camera;
let renderer;
let controls;

let stoneGroup = null;
let previewGroup = null;
let stoneScale = 1;

let activeStone = null;
let activeStoneId = null;

let busy = false;
let booted = false;

function status(message, error = false) {
  if (!statusNode) return;

  statusNode.textContent = message;
  statusNode.dataset.state = error ? "error" : "normal";
}

function notify(message) {
  const node = $("#notification");

  if (!node) return;

  node.textContent = message;
  node.classList.add("show");

  setTimeout(() => {
    node.classList.remove("show");
  }, 2400);
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStone(id) {
  return getInventory("stones").find(
    stone => stone?.id === id
  ) || null;
}

function hashString(text) {
  let hash = 2166136261;

  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/**
 * 建立原石模型
 * 原石尺寸使用 stone.dimensions。
 */
function createStoneGeometry(stone) {
  const dimensions = stone.dimensions || {
    x: 1,
    y: 1,
    z: 1
  };

  // 先合併重複頂點，避免三角形接縫分離
  const originalGeometry = new THREE.IcosahedronGeometry(1, 4);
  const geometry = mergeVertices(originalGeometry);

  originalGeometry.dispose();

  const position = geometry.getAttribute("position");
  const random = seededRandom(hashString(stone.id));

  for (let i = 0; i < position.count; i++) {
    const noise = 0.88 + random() * 0.22;

    position.setXYZ(
      i,
      position.getX(i) * dimensions.x * 0.5 * noise,
      position.getY(i) * dimensions.y * 0.5 * noise,
      position.getZ(i) * dimensions.z * 0.5 * noise
    );
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * 建立玉肉模型
 */
function createJadeGeometry(jade, stone) {
  const dimensions = jade.dimensions || {
    x: 0.08,
    y: 0.08,
    z: 0.06
  };

  const stoneDimensions = stone.dimensions || {
    x: 1,
    y: 1,
    z: 1
  };

  const geometry = new THREE.SphereGeometry(
    1,
    28,
    20
  );

  geometry.scale(
    Math.max(0.012, dimensions.x * 0.5),
    Math.max(0.012, dimensions.y * 0.5),
    Math.max(0.012, dimensions.z * 0.5)
  );

  const position = jade.position || {
    x: 0,
    y: 0,
    z: 0
  };

  geometry.translate(
    position.x * stoneDimensions.x,
    position.y * stoneDimensions.y,
    position.z * stoneDimensions.z
  );

  geometry.computeVertexNormals();

  return geometry;
}

function createRockMaterial(stone) {
  const colors = {
    common: 0x77766e,
    fine: 0x777d78,
    rare: 0x687b70,
    epic: 0x77718a,
    legendary: 0x9b8153
  };

  return new THREE.MeshStandardMaterial({
    color: colors[stone.rarity] || 0x77766e,
    roughness: 0.9,
    metalness: 0.02,
   flatShading: false
  });
}

function disposeObject(object) {
  if (!object) return;

  object.traverse(child => {
    child.geometry?.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach(material => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
}

/**
 * 初始化 3D 畫面
 */
function initializeViewer() {
  if (renderer || !viewer) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171713);

  camera = new THREE.PerspectiveCamera(
    38,
    1,
    0.01,
    100
  );

  camera.position.set(2.6, 1.8, 2.8);

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setSize(
    Math.max(1, viewer.clientWidth),
    Math.max(1, viewer.clientHeight)
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  viewer.replaceChildren(renderer.domElement);

  controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  scene.add(
    new THREE.HemisphereLight(
      0xe7e2d2,
      0x34372d,
      2
    )
  );

  const light = new THREE.DirectionalLight(
    0xffffff,
    2.4
  );

  light.position.set(3, 4, 5);
  scene.add(light);

  const fillLight = new THREE.DirectionalLight(
    0x8cb6a0,
    1
  );

  fillLight.position.set(-4, 1, -3);
  scene.add(fillLight);

  const resize = () => {
    if (!renderer || !camera) return;

    const width = Math.max(1, viewer.clientWidth);
    const height = Math.max(1, viewer.clientHeight);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  };

  window.addEventListener("resize", resize);

  function animate() {
    requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

/**
 * 顯示原石與內部玉肉
 */
function renderStone(stone) {
  initializeViewer();

  // 清除上一顆原石留下的預覽群組
  if (previewGroup) {
    clearPreview();
    scene.remove(previewGroup);
    disposeObject(previewGroup);
    previewGroup = null;
  }

  // 清除上一顆原石
  if (stoneGroup) {
    scene.remove(stoneGroup);
    disposeObject(stoneGroup);
    stoneGroup = null;
  }

  stoneGroup = new THREE.Group();

  const rockGeometry = createStoneGeometry(stone);

  const rock = new THREE.Mesh(
    rockGeometry,
    createRockMaterial(stone)
  );

  stoneGroup.add(rock);

  for (const jade of stone.jadeContents || []) {
    const material = new THREE.MeshPhysicalMaterial({
      color: jade.color || "#4b9b72",
      roughness: 0.2,
      metalness: 0.02,
      transparent: true,
      opacity: 0.92,
      clearcoat: 0.7
    });

    const jadeMesh = new THREE.Mesh(
      createJadeGeometry(jade, stone),
      material
    );

    jadeMesh.userData.jadeId = jade.id;

    stoneGroup.add(jadeMesh);
  }

  scene.add(stoneGroup);

  const box = new THREE.Box3().setFromObject(stoneGroup);
  const size = box.getSize(new THREE.Vector3());

  const maxDimension = Math.max(
    size.x,
    size.y,
    size.z,
    0.5
  );

  stoneScale = 1.5 / maxDimension;

  stoneGroup.scale.setScalar(stoneScale);

  // 預覽群組使用與原石完全相同的縮放比例
  previewGroup = new THREE.Group();
  previewGroup.scale.setScalar(stoneScale);

  scene.add(previewGroup);

  controls.target.set(0, 0, 0);

  camera.position.set(2.2, 1.55, 2.5);
  camera.updateProjectionMatrix();
}
/**
 * 切割平面
 *
 * XYZ 滑桿控制切割平面位置。
 * 角度滑桿控制切割方向。
 */

function getCutPlane(stone) {
  const x = Number($("#cut-x")?.value || 0);
  const y = Number($("#cut-y")?.value || 0);
  const z = Number($("#cut-z")?.value || 0);

  const horizontalAngle =
    Number($("#cut-angle")?.value ?? 90);

  const verticalAngle =
    Number($("#cut-angle-y")?.value ?? 0);

  const horizontalRadians =
    horizontalAngle * Math.PI / 180;

  const verticalRadians =
    verticalAngle * Math.PI / 180;

  const normal = new THREE.Vector3(
    Math.cos(verticalRadians) *
      Math.sin(horizontalRadians),

    Math.sin(verticalRadians),

    Math.cos(verticalRadians) *
      Math.cos(horizontalRadians)
  ).normalize();

  const dimensions = stone.dimensions || {
    x: 1,
    y: 1,
    z: 1
  };

  const point = new THREE.Vector3(
    x * dimensions.x * 0.5,
    y * dimensions.y * 0.5,
    z * dimensions.z * 0.5
  );

  const offset = normal.dot(point);

  return {
    normal,
    point,
    offset
  };
}

/**
 * 計算沿切割方向的投影半徑
 */
function getProjectionRadius(stone, normal) {
  const d = stone.dimensions || {
    x: 1,
    y: 1,
    z: 1
  };

  return Math.sqrt(
    (normal.x * d.x * 0.5) ** 2 +
    (normal.y * d.y * 0.5) ** 2 +
    (normal.z * d.z * 0.5) ** 2
  );
}

/**
 * 邊緣自動剝落判定
 */

/**
 * 根據原石實際幾何形狀判定邊緣剝落
 */
function getEdgeSpallInfo(stone, plane) {
  const geometry = createStoneGeometry(stone);
  const position = geometry.getAttribute("position");

  let minProjection = Infinity;
  let maxProjection = -Infinity;

  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);

    const projection = vertex.dot(plane.normal);

    minProjection = Math.min(
      minProjection,
      projection
    );

    maxProjection = Math.max(
      maxProjection,
      projection
    );
  }

  geometry.dispose();

  const diameter = maxProjection - minProjection;

  const negativeDepth = plane.offset - minProjection;
  const positiveDepth = maxProjection - plane.offset;

  const remainingEdge = Math.max(
    0,
    Math.min(negativeDepth, positiveDepth)
  );

  const threshold = Math.max(
    2.5 * getBladeThickness(),
    0.06 * diameter
  );

  const intersects =
    negativeDepth > 0 &&
    positiveDepth > 0;

  return {
    threshold,
    remainingEdge,
    negativeDepth,
    positiveDepth,
    edgeSpall:
      intersects && remainingEdge <= threshold,
    diameter
  };
}


function clearPreview() {
  if (!previewGroup) return;

  while (previewGroup.children.length) {
    const child = previewGroup.children[0];

    previewGroup.remove(child);
    disposeObject(child);
  }
}

function renderPreview() {
  if (!activeStone || !previewGroup) return;

  const plane = getCutPlane(activeStone);
  const edge = getEdgeSpallInfo(activeStone, plane);

  clearPreview();

  const dimensions = activeStone.dimensions || {
    x: 1,
    y: 1,
    z: 1
  };

  const extent = Math.max(
    dimensions.x,
    dimensions.y,
    dimensions.z,
    1
  );

 const geometry = new THREE.PlaneGeometry(
  extent * 1.6,
  extent * 1.6
);

  const material = new THREE.MeshBasicMaterial({
    color: edge.edgeSpall ? 0xffc66d : 0x7bd3b0,
    transparent: true,
   opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(
    geometry,
    material
  );

  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    plane.normal
  );

  mesh.position.copy(plane.point);

  previewGroup.add(mesh);

  status(
    edge.edgeSpall
      ? `預覽：即將觸發邊緣自動剝落，門檻 ${edge.threshold.toFixed(3)}`
      : `預覽：正常切割，邊緣剝落門檻 ${edge.threshold.toFixed(3)}`
  );
}

function selectStone(id) {
  const stone = getStone(id);

  if (!stone) {
    activeStone = null;
    activeStoneId = null;

    if (infoNode) {
      infoNode.textContent =
        "找不到原石，請回倉庫重新選擇。";
    }

    status("尚未選擇原石");
    return;
  }

  activeStone = stone;
  activeStoneId = stone.id;

  updateStoneInfo(stone);
  renderStone(stone);
  renderPreview();

  status("原石載入完成，可以開始調整切割位置。");
}
window.addEventListener("cutting:select", event => {
  const stoneId = event.detail?.stoneId;

  console.log("[Cutting] 收到選取事件：", stoneId);

  if (!stoneId) return;

  selectStone(stoneId);
});
/**
 * 計算幾何體積
 */
function calculateVolume(geometry) {
  if (!geometry) return 0;

  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();

  if (!position) return 0;

  let volume = 0;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  const count = index
    ? index.count / 3
    : position.count / 3;

  for (let i = 0; i < count; i++) {
    const ia = index ? index.getX(i * 3) : i * 3;
    const ib = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const ic = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);

    volume += a.dot(b.clone().cross(c)) / 6;
  }

  return Math.abs(volume);
}

/**
 * 分割玉肉
 */

/**
 * 分割玉肉，保留切割後的位置、尺寸與價值
 */

async function splitJade(jade, stone, plane) {
  const geometry = createJadeGeometry(jade, stone);

  try {
    geometry.computeBoundingSphere();

    if (!geometry.boundingSphere) {
      throw new Error("無法確認玉肉幾何位置。");
    }

    const center = geometry.boundingSphere.center;
    const radius = geometry.boundingSphere.radius;

    const signedDistance = plane.normal.dot(
      center.clone().sub(plane.point)
    );

    const halfThickness = getBladeThickness() / 2;

    // 完整位於正側，整塊保留
    if (signedDistance - radius >= halfThickness) {
      return {
        negative: null,
        positive: { ...jade }
      };
    }

    // 完整位於負側，整塊保留
    if (signedDistance + radius <= -halfThickness) {
      return {
        negative: { ...jade },
        positive: null
      };
    }

    // 玉肉與切割區域相交，必須進行真正的幾何分割
    const originalVolume = calculateVolume(geometry);

    const result = await cutSolidGeometry(
      geometry,
      plane.point,
      plane.normal
    );

    // 玉肉橫跨切割區域卻無法產生兩側結果，
    // 不允許用中心位置猜測。
    if (!result?.negative || !result?.positive) {
      result?.negative?.dispose();
      result?.positive?.dispose();

      throw new Error(
        "玉肉分割結果不完整，為避免誤丟原石，已取消切割。"
      );
    }

    const stoneDimensions = stone.dimensions || {
      x: 1,
      y: 1,
      z: 1
    };

    function createJadePiece(pieceGeometry) {
      const volume = calculateVolume(pieceGeometry);

      if (!Number.isFinite(volume) || volume <= 0) {
        throw new Error("玉肉分割結果無效。");
      }

      pieceGeometry.computeBoundingBox();

      const bounds = pieceGeometry.boundingBox;

      const pieceCenter = bounds.getCenter(
        new THREE.Vector3()
      );

      const dimensions = bounds.getSize(
        new THREE.Vector3()
      );

      const ratio = Math.min(
        1,
        Math.max(0, volume / Math.max(originalVolume, 0.000001))
      );

      return {
        ...jade,

        id: createId(),

        position: {
          x: pieceCenter.x / Math.max(stoneDimensions.x, 0.000001),
          y: pieceCenter.y / Math.max(stoneDimensions.y, 0.000001),
          z: pieceCenter.z / Math.max(stoneDimensions.z, 0.000001)
        },

        dimensions: {
          x: dimensions.x,
          y: dimensions.y,
          z: dimensions.z
        },

        estimatedValue: Math.round(
          (jade.estimatedValue || 0) * ratio
        ),

        potentialValue: Math.round(
          (jade.potentialValue || 0) * ratio
        ),

        cutFragment: true
      };
    }

    return {
      negative: createJadePiece(result.negative),
      positive: createJadePiece(result.positive)
    };

  } finally {
    geometry.dispose();
  }
}


/**
 * 建立切割後石料
 */
function createPiece(stone, geometry, jadeContents, side, edgeSpall, sourceVolume) {
  const volume = calculateVolume(geometry);

  const ratio = Math.min(
    1,
    Math.max(0.01, volume / Math.max(sourceVolume, 0.000001))
  );

  geometry.computeBoundingBox();

  const dimensions = new THREE.Vector3();

  geometry.boundingBox.getSize(dimensions);

  const jadeValue = jadeContents.reduce(
    (sum, jade) => sum + (Number(jade.estimatedValue) || 0),
    0
  );

  const piece = {
    id: createId(),

 name:
  `${stone.name}｜` +
  `${side === "negative" ? "左側" : "右側"}` +
  `${edgeSpall ? "（自動剝落石屑）" : ""}`,

    type: "fragment",
    kind: "fragment",

    sourceStoneId: stone.id,

    rarity: stone.rarity,
    rarityName: stone.rarityName,
    rarityColor: stone.rarityColor,

    shape: stone.shape,

    weight: Math.max(
      1,
      Math.round((stone.weight || 1) * ratio)
    ),

    dimensions: {
      x: dimensions.x,
      y: dimensions.y,
      z: dimensions.z
    },

    modelGeometry: geometry.toJSON(),

    jadeContents,

    estimatedValue: Math.round(
      (stone.estimatedValue || 0) * ratio * 0.35 +
      jadeValue
    ),

    potentialValue: Math.round(
      (stone.potentialValue || 0) * ratio * 0.35 +
      jadeContents.reduce(
        (sum, jade) =>
          sum + (Number(jade.potentialValue) || 0),
        0
      )
    ),

    status: "cut",
    edgeSpall: Boolean(edgeSpall),

    createdAt: Date.now(),
    cuttingHistory: [...(stone.cuttingHistory || [])]
  };

  geometry.dispose();

  return piece;
}

/**
 * 正式切割
 */

/**
 * 正式切割
 */
async function performCut() {
  if (busy || !activeStone) return;

  busy = true;

  if (cutButton) cutButton.disabled = true;
  if (previewButton) previewButton.disabled = true;

  let rockResult = null;

  try {
    await initializeGeometryEngine();

    const stone = getStone(activeStoneId);

    if (!stone) {
      throw new Error("原石已不存在，請重新選擇。");
    }

    const plane = getCutPlane(stone);
    const edge = getEdgeSpallInfo(stone, plane);

    const rockGeometry = createStoneGeometry(stone);
    const sourceVolume = calculateVolume(rockGeometry);

    try {
      rockResult = await cutSolidGeometry(
        rockGeometry,
        plane.point,
        plane.normal
      );
    } finally {
      rockGeometry.dispose();
    }

    if (!rockResult?.negative || !rockResult?.positive) {
      throw new Error(
        "切割沒有產生完整的兩側石料，原石已保留。"
      );
    }

    const negativeVolume = calculateVolume(
      rockResult.negative
    );

    const positiveVolume = calculateVolume(
      rockResult.positive
    );

    const spallSide = edge.edgeSpall
      ? (
          negativeVolume <= positiveVolume
            ? "negative"
            : "positive"
        )
      : null;

    const negativeJade = [];
    const positiveJade = [];

    // 逐一分割原石內的玉肉
    for (const jade of stone.jadeContents || []) {
      const split = await splitJade(
        jade,
        stone,
        plane
      );

      if (split.negative) {
        negativeJade.push(split.negative);
      }

      if (split.positive) {
        positiveJade.push(split.positive);
      }
    }

    // 只有確實含有玉肉的部分才建立倉庫物品
    const keptPieces = [];
    const discardedSides = [];

    let negativePiece = null;
    let positivePiece = null;

    if (negativeJade.length > 0) {
      negativePiece = createPiece(
        stone,
        rockResult.negative,
        negativeJade,
        "negative",
        spallSide === "negative",
        sourceVolume
      );

      keptPieces.push(negativePiece);
      rockResult.negative = null;
    } else {
      discardedSides.push("左側");
    }

    if (positiveJade.length > 0) {
      positivePiece = createPiece(
        stone,
        rockResult.positive,
        positiveJade,
        "positive",
        spallSide === "positive",
        sourceVolume
      );

      keptPieces.push(positivePiece);
      rockResult.positive = null;
    } else {
      discardedSides.push("右側");
    }

    // 產生切割紀錄
    const record = {
      id: createId(),
      stoneId: stone.id,

      bladeThickness: getBladeThickness(),

      edgeSpall: edge.edgeSpall,
      edgeSpallThreshold: edge.threshold,
      spallSide,

      plane: {
        point: {
          x: plane.point.x,
          y: plane.point.y,
          z: plane.point.z
        },

        normal: {
          x: plane.normal.x,
          y: plane.normal.y,
          z: plane.normal.z
        }
      },

      resultPieceIds: keptPieces.map(piece => piece.id),

      discardedSides,

      timestamp: Date.now()
    };

    // 所有判定完成後，才正式更新倉庫
    state.inventory.stones =
      state.inventory.stones.filter(
        item => item?.id !== stone.id
      );

    state.inventory.materials ||= [];

    state.inventory.materials.push(...keptPieces);

    state.records ||= {};
    state.records.cuttingHistory ||= [];

    state.records.cuttingHistory.push(record);

    saveGame();

    activeStone = null;
    activeStoneId = null;

    window.selectedStoneId = null;

    if (stoneGroup) {
      scene.remove(stoneGroup);
      disposeObject(stoneGroup);
      stoneGroup = null;
    }

    clearPreview();

    if (infoNode) {
      infoNode.textContent = "切割完成。";
    }

    // 組合不透露玉肉數量的通知
    const messages = [];

    if (negativePiece) {
      messages.push("左側石料含有玉，已保留");
    } else {
      messages.push("左側石料未發現玉，已自動丟棄");
    }

    if (positivePiece) {
      messages.push("右側石料含有玉，已保留");
    } else {
      messages.push("右側石料未發現玉，已自動丟棄");
    }

    const resultMessage = messages.join("；");

    status(
      edge.edgeSpall
        ? `切割完成，觸發邊緣剝落。${resultMessage}`
        : `切割完成。${resultMessage}`
    );

    notify(`切割完成！${resultMessage}`);

    document.dispatchEvent(
      new CustomEvent("cutting:completed")
    );

  } catch (error) {
    console.error("[Cutting] 切割失敗", error);

    status(
      error.message || "切割失敗，原石沒有被移除。",
      true
    );

    notify(
      error.message || "切割失敗，原石已保留。"
    );

  } finally {
    // 清除尚未交給 createPiece 的幾何體
    if (rockResult) {
      rockResult.negative?.dispose();
      rockResult.positive?.dispose();
    }

    busy = false;

    if (cutButton) cutButton.disabled = false;
    if (previewButton) previewButton.disabled = false;
  }
}

/**
 * 綁定操作
 */
function bindControls() {
  [
    $("#cut-x"),
    $("#cut-y"),
    $("#cut-z"),
    $("#cut-angle"),
    $("#cut-angle-y")
  ].forEach(input => {
    input?.addEventListener("input", renderPreview);
  });

  previewButton?.addEventListener("click", () => {
    if (!activeStone) {
      status("請先從倉庫選擇原石。", true);
      return;
    }

    renderPreview();
  });

  cutButton?.addEventListener("click", performCut);

  // 監聽切石頁面開啟
  const cuttingPage = $("#page-cutting");

  if (cuttingPage) {
    const observer = new MutationObserver(() => {
      if (
        cuttingPage.classList.contains("active") &&
        window.selectedStoneId
      ) {
        selectStone(window.selectedStoneId);
      }
    });

    observer.observe(cuttingPage, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  document.addEventListener("cutting:completed", () => {
    window.dispatchEvent(
      new CustomEvent("inventory:refresh")
    );
  });
}

function addStyles() {
  if ($("#cutting-system-styles")) return;

  const style = document.createElement("style");

  style.id = "cutting-system-styles";

  style.textContent = `
    #stone-viewer {
      min-height: 360px;
      height: min(58vh, 560px);
      overflow: hidden;
      border-radius: 12px;
      background: #171713;
      position: relative;
    }

    #stone-viewer canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: pan-y;
    }

    #selected-stone-info h3 {
      margin-top: 0;
      color: #d8b66c;
    }

    #cut-status {
      min-height: 1.5em;
      color: #d8c18b;
    }

    #cut-status[data-state="error"] {
      color: #e58b79;
    }

    #start-cut:disabled,
    #preview-cut:disabled {
      opacity: .55;
      cursor: wait;
    }

    @media(max-width:640px) {
      #stone-viewer {
        height: 380px;
        min-height: 300px;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * 啟動
 */
async function boot() {
  if (booted || !viewer) return;

  booted = true;

  addStyles();
  bindControls();

  try {
    await initializeGeometryEngine();

    if (window.selectedStoneId) {
      selectStone(window.selectedStoneId);
    } else {
      status("請先從倉庫選擇一塊原石。");
    }

  } catch (error) {
    console.error(error);

    status(
      error.message || "3D 系統初始化失敗。",
      true
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    boot,
    { once: true }
  );
} else {
  boot();
}
