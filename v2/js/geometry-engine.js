/**
 * geometry-engine.js
 * 真正的 3D CSG 幾何切割引擎
 */

const BLADE_THICKNESS = 0.025;

let THREE = null;
let CSG = null;
let engineReady = false;
let loadingPromise = null;

export async function initializeGeometryEngine() {
  if (engineReady) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      THREE = await import("three");
      CSG = await import("three-bvh-csg");

      if (!CSG.Brush || !CSG.Evaluator || !CSG.INTERSECTION) {
        throw new Error("CSG 模組缺少必要功能");
      }

      engineReady = true;
      console.info("[GeometryEngine] 初始化完成");
      return true;

    } catch (error) {
      loadingPromise = null;
      engineReady = false;

      console.error("[GeometryEngine] 初始化失敗", error);

      throw new Error(
        "3D 幾何引擎載入失敗，請檢查 Import Map 與網路連線。"
      );
    }
  })();

  return loadingPromise;
}

function createHalfSpace(point, normal, extent, side, material) {
  const depth = extent * 2;

  const geometry = new THREE.BoxGeometry(
    extent * 4,
    extent * 4,
    depth
  );

  const brush = new CSG.Brush(geometry, material);

  const quaternion = new THREE.Quaternion();

  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  );

  brush.quaternion.copy(quaternion);

  brush.position.copy(point).addScaledVector(
    normal,
    side * (BLADE_THICKNESS / 2 + depth / 2)
  );

  brush.updateMatrixWorld(true);

  return brush;
}

function validateResult(result) {
  if (!result?.geometry) {
    return null;
  }

  const geometry = result.geometry;

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const position = geometry.getAttribute("position");

  if (!position || position.count < 12) {
    return null;
  }

  const size = new THREE.Vector3();

  geometry.boundingBox.getSize(size);

  if (
    size.x < 0.000001 ||
    size.y < 0.000001 ||
    size.z < 0.000001
  ) {
    return null;
  }

  geometry.computeVertexNormals();

  return geometry.clone();
}

/**
 * 切割封閉立體
 *
 * negative：法向量反方向
 * positive：法向量正方向
 */
export async function cutSolidGeometry(
  geometry,
  planePoint,
  planeNormal
) {
  await initializeGeometryEngine();

  if (!geometry?.isBufferGeometry) {
    throw new Error("輸入模型不是有效的 BufferGeometry。");
  }

  const point = new THREE.Vector3(
    Number(planePoint.x),
    Number(planePoint.y),
    Number(planePoint.z)
  );

  const normal = new THREE.Vector3(
    Number(planeNormal.x),
    Number(planeNormal.y),
    Number(planeNormal.z)
  );

  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(point.z) ||
    !Number.isFinite(normal.x) ||
    !Number.isFinite(normal.y) ||
    !Number.isFinite(normal.z) ||
    normal.lengthSq() < 0.0000000001
  ) {
    throw new Error("切割平面資料無效。");
  }

  normal.normalize();

  const sourceGeometry = geometry.clone();

  sourceGeometry.computeBoundingSphere();

  if (!sourceGeometry.boundingSphere) {
    sourceGeometry.dispose();
    throw new Error("無法取得原石尺寸。");
  }

  const extent = Math.max(
    sourceGeometry.boundingSphere.radius * 5,
    BLADE_THICKNESS * 30
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x88847a,
    roughness: 0.85,
    metalness: 0
  });

  const sourceBrush = new CSG.Brush(
    sourceGeometry,
    material
  );

  sourceBrush.position.set(0, 0, 0);
  sourceBrush.rotation.set(0, 0, 0);
  sourceBrush.scale.set(1, 1, 1);
  sourceBrush.updateMatrixWorld(true);

  const negativeBrush = createHalfSpace(
    point,
    normal,
    extent,
    -1,
    material
  );

  const positiveBrush = createHalfSpace(
    point,
    normal,
    extent,
    1,
    material
  );

  const evaluator = new CSG.Evaluator();

  evaluator.useGroups = false;

  let negativeResult = null;
  let positiveResult = null;

  try {
    negativeResult = evaluator.evaluate(
      sourceBrush,
      negativeBrush,
      CSG.INTERSECTION
    );

    positiveResult = evaluator.evaluate(
      sourceBrush,
      positiveBrush,
      CSG.INTERSECTION
    );

    const negative = validateResult(negativeResult);
    const positive = validateResult(positiveResult);

    if (!negative && !positive) {
      throw new Error("切割沒有產生有效石料。");
    }

    return {
      negative,
      positive,
      bladeThickness: BLADE_THICKNESS,
      planePoint: point.clone(),
      planeNormal: normal.clone()
    };

  } catch (error) {
    console.error("[GeometryEngine] 切割失敗", error);

    throw new Error(
      `幾何切割失敗：${error.message}`
    );

  } finally {
    sourceGeometry.dispose();

    negativeBrush.geometry.dispose();
    positiveBrush.geometry.dispose();

    material.dispose();

    negativeResult?.geometry?.dispose();
    positiveResult?.geometry?.dispose();
  }
}

export function getBladeThickness() {
  return BLADE_THICKNESS;
}

export function isGeometryEngineReady() {
  return engineReady;
}
