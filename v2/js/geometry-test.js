
import {
  cutSolidGeometry,
  initializeGeometryEngine,
  getBladeThickness
} from './geometry-engine.js';

import * as THREE from 'three';

/**
 * 計算 BufferGeometry 的三角網格體積
 */
function calculateGeometryVolume(geometry) {
  const position = geometry.getAttribute('position');

  if (!position) {
    throw new Error('幾何缺少頂點資料');
  }

  let volume = 0;

  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(
      position, i
    );

    const b = new THREE.Vector3().fromBufferAttribute(
      position, i + 1
    );

    const c = new THREE.Vector3().fromBufferAttribute(
      position, i + 2
    );

    volume += a.dot(
      new THREE.Vector3().crossVectors(b, c)
    ) / 6;
  }

  return Math.abs(volume);
}

/**
 * 執行中央切割測試
 */
export async function runGeometrySelfTest() {
  console.log('========== 3D 幾何切割測試 ==========');

  let originalGeometry = null;
  let result = null;

  try {
    await initializeGeometryEngine();

    originalGeometry = new THREE.BoxGeometry(
      2, 2, 2
    );

    const originalVolume =
      calculateGeometryVolume(originalGeometry);

    result = await cutSolidGeometry(
      originalGeometry,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 }
    );

    const negativeVolume =
      calculateGeometryVolume(result.negative);

    const positiveVolume =
      calculateGeometryVolume(result.positive);

    const totalVolume =
      negativeVolume + positiveVolume;

    const expectedVolume =
      originalVolume -
      (getBladeThickness() * 2 * 2);

    const volumeDifference =
      Math.abs(totalVolume - expectedVolume);

    const tolerance = 0.05;

    const checks = {
      engineLoaded: true,

      negativeGeometryValid:
        negativeVolume > 0,

      positiveGeometryValid:
        positiveVolume > 0,

      bladeThicknessCorrect:
        result.bladeThickness === getBladeThickness(),

      volumeApproximatelyCorrect:
        volumeDifference < tolerance
    };

    const passed = Object.values(checks).every(Boolean);

    const report = {
      passed,
      checks,
      originalVolume,
      negativeVolume,
      positiveVolume,
      totalVolume,
      expectedVolume,
      volumeDifference,
      bladeThickness: result.bladeThickness
    };

    console.table(checks);
    console.log('測試報告：', report);

    return report;

  } catch (error) {
    console.error('幾何測試失敗：', error);

    return {
      passed: false,
      error: error.message
    };

  } finally {
    originalGeometry?.dispose();
    result?.negative?.dispose();
    result?.positive?.dispose();
  }
}
