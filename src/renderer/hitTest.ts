// ============================================================
// hitTest — Raycasting 点击检测
// ============================================================
// 将鼠标在 canvas 局部坐标映射到 Three.js 场景中的 frameId
// 用于替代/补充 DOM 的 data-frame-id 查找

import * as THREE from 'three';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

// 复用 Raycaster 和 Vector2，避免每次 hitTest 创建新对象
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * 检测鼠标位置下的帧 ID
 *
 * @param mouseX - canvas 内部 X 坐标 (0 ~ 1920)
 * @param mouseY - canvas 内部 Y 坐标 (0 ~ 1080, 从顶部向下)
 * @param scene  - Three.js 场景
 * @param camera - 正交相机 (0, 1920, 1080, 0)
 * @returns frameId 或 null
 *
 * 注意: mouseX/mouseY 是 canvas 内部坐标，
 * 由调用方通过 getBoundingClientRect() 从屏幕坐标转换得到。
 * 因为 WebGL canvas 和 DOM 层共用同一个 CSS transform，
 * 坐标一致性由 CSS 保证。
 */
export function hitTest(
  mouseX: number,
  mouseY: number,
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
): string | null {
  // 转换为 NDC: Camera(0, 1920, 1080, 0)
  // X: 0→-1, 1920→+1
  // Y: 0(top)→+1, 1080(bottom)→-1
  mouse.set(
    (mouseX / CANVAS_WIDTH) * 2 - 1,
    -(mouseY / CANVAS_HEIGHT) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length === 0) return null;

  // 按 z-order (position.z) 降序排列，取最上层
  if (intersects.length > 1) {
    intersects.sort((a, b) => b.object.position.z - a.object.position.z);
  }

  // 从命中的 mesh 向上查找 frameId (可能在 parent group 上)
  let obj: THREE.Object3D | null = intersects[0].object;
  while (obj) {
    if (obj.userData && typeof obj.userData.frameId === 'string') {
      return obj.userData.frameId;
    }
    obj = obj.parent;
  }
  return null;
}
