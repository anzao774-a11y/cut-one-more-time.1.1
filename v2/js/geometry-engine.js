
/**
 * geometry-engine.js
 *
 * 真正的 3D 幾何切割引擎
 *
 * 功能：
 * 1. 使用 CSG 布林運算切割封閉立體
 * 2. 依照切割平面分成左右兩個獨立幾何
 * 3. 固定鋸片厚度 0.025
 * 4. 保留兩側切面，不使用假切割線
 * 5. 可對原石與玉肉分別執行相同切割
 *
 * 注意：
 * 輸入幾何必須是封閉、無自相交的立體。
 */

const CSG_MODULE_URL =
  'https://esm.sh/three-bvh-csg@0.0.17?external=three,three-mesh-bvh';

const BLADE_THICKNESS = 0.025;

let THREE = null;
let CSG = null;
let engineReady = false;
let loadingPromise = null;

/**
 * 載入幾何運算模組
 */
export async function initializeGeometryEngine() {
  if (engineReady) return true;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      THREE = await import('three');
      CSG = await import('three-bvh-csg');

      if (
        !CSG.Brush ||
        !CSG.Evaluator ||
        !CSG.INTERSECTION
      ) {
        throw new Error('CSG 模組缺少必要功能');
      }

      engineReady = true;
      console.info('[GeometryEngine] 初始化完成');

      return true;
    } catch (error) {
      engineReady = false;
      loadingPromise = null;

      console.error(
        '[GeometryEngine] 初始化失敗：',
        error
      );

      throw new Error(
        '3D 幾何引擎載入失敗，請檢查網路與模組設定。'
      );
    }
  })();

  return loadingPromise;
}

/**
 * 建立切割平面的單側封閉空間
 *
 * side:
 * -1 = 法向量反方向
 *  1 = 法向量正方向
 */
function createHalfSpace(
  point,
  normal,
  extent,
  halfThickness,
  side,
  material
) {
  const THREERef = THREE;

  const width = extent * 4;
  const height = extent * 4;
  const depth = extent;

  const geometry = new THREERef.BoxGeometry(
    width,
    height,
    depth
  );

  const brush = new CSG.Brush(
    geometry,
    material
  );

  const quaternion = new THREERef.Quaternion();

  quaternion.setFromUnitVectors(
    new THREERef.Vector3(0, 0, 1),
    normal
  );

  brush.quaternion.copy(quaternion);

  const offset =
    side * (halfThickness + depth / 2);

  brush.position.copy(point).addScaledVector(
    normal,
    offset
  );

  brush.updateMatrixWorld(true);

  return brush;
}

/**
 * 對一個封閉立體執行真正的幾何切割
 *
 * geometry:
 * Three.js BufferGeometry
 *
 * planePoint:
 * 切割平面上的一個點，使用模型本地座標
 *
 * planeNormal:
 * 切割平面的法向量，使用模型本地座標
 *
 * 回傳：
 * {
 *   negative: BufferGeometry,
 *   positive: BufferGeometry,
 *   bladeThickness: number
 * }
 */
export async function cutSolidGeometry(
  geometry,
  planePoint,
  planeNormal
) {
  await initializeGeometryEngine();

  if (!geometry?.isBufferGeometry) {
    throw new Error('輸入的模型不是有效的 BufferGeometry');
  }

  if (
    !planePoint ||
    !Number.isFinite(planePoint.x) ||
    !Number.isFinite(planePoint.y) ||
    !Number.isFinite(planePoint.z)
  ) {
    throw new Error('切割位置無效');
  }

  const THREERef = THREE;

  const point = new THREERef.Vector3(
    planePoint.x,
    planePoint.y,
    planePoint.z
  );

  const normal = new THREERef.Vector3(
    planeNormal.x,
    planeNormal.y,
    planeNormal.z
  );

  if (normal.lengthSq() < 1e-12) {
    throw new Error('切割方向不可為零向量');
  }

  normal.normalize();

  const sourceGeometry = geometry.clone();

  sourceGeometry.clearGroups();
  sourceGeometry.computeVertexNormals();
  sourceGeometry.computeBoundingBox();
  sourceGeometry.computeBoundingSphere();

  const sphere = sourceGeometry.boundingSphere;

  if (!sphere || sphere.radius <= 0) {
    sourceGeometry.dispose();
    throw new Error('模型尺寸無效');
  }

  const extent = Math.max(
    sphere.radius * 4,
    BLADE_THICKNESS * 20
  );

  const halfThickness = BLADE_THICKNESS / 2;

  const material = new THREERef.MeshStandardMaterial({
    color: 0x8c8982,
    roughness: 0.8,
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

  const negativeSpace = createHalfSpace(
    point,
    normal,
    extent,
    halfThickness,
    -1,
    material
  );

  const positiveSpace = createHalfSpace(
    point,
    normal,
    extent,
    halfThickness,
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
      negativeSpace,
      CSG.INTERSECTION
    );

    positiveResult = evaluator.evaluate(
      sourceBrush,
      positiveSpace,
      CSG.INTERSECTION
    );

    const negativeGeometry =
      validateAndCloneResult(negativeResult);

    const positiveGeometry =
      validateAndCloneResult(positiveResult);

    return {
      negative: negativeGeometry,
      positive: positiveGeometry,
      bladeThickness: BLADE_THICKNESS,
      planePoint: point.clone(),
      planeNormal: normal.clone()
    };

  } catch (error) {
    console.error('[GeometryEngine] 切割失敗：', error);

    throw new Error(
      `幾何切割失敗：${error.message}`
    );

  } finally {
    sourceGeometry.dispose();

    negativeSpace.geometry.dispose();
    positiveSpace.geometry.dispose();

    material.dispose();

    negativeResult?.geometry?.dispose();
    positiveResult?.geometry?.dispose();
  }
}

/**
 * 檢查 CSG 結果是否有效
 */
function validateAndCloneResult(result) {
  if (!result?.geometry) {
    throw new Error('CSG 沒有產生有效幾何');
  }

  const geometry = result.geometry;

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();

  const position = geometry.getAttribute('position');

  if (!position || position.count < 12) {
    throw new Error('切割結果過小或沒有有效三角形');
  }

  const box = geometry.boundingBox;

  const size = new THREE.Vector3();

  box.getSize(size);

  if (
    size.x < 1e-7 ||
    size.y < 1e-7 ||
    size.z < 1e-7
  ) {
    throw new Error('切割結果不是有效的立體');
  }

  return geometry.clone();
}

/**
 * 取得固定鋸片厚度
 */
export function getBladeThickness() {
  return BLADE_THICKNESS;
}

/**
 * 檢查引擎是否已載入
 */
export function isGeometryEngineReady() {
  return engineReady;
}
