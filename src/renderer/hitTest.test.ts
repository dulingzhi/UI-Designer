/**
 * round 176：hitTest 命中排序测试。
 * 语义锁定：重叠帧命中取「世界 z 最大」（视觉最上层）。
 * 原缺陷：排序键用 object.position.z（子网格装饰偏移，帧间恒同），
 * 帧层级 z 在 group.position.z 不参与 → 可选中视觉下层帧。
 * 修复后用 hit.point.z（世界交点，含祖先链）。
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pickTopFrameIdFromIntersections } from './hitTest';

function makeIntersect(frameId: string, worldZ: number, childZ: number): THREE.Intersection<THREE.Object3D> {
  // 模拟真实结构：group(position.z=frame 层级) > mesh(position.z=装饰偏移, userData.frameId)
  const group = new THREE.Group();
  group.position.z = worldZ;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  mesh.position.z = childZ;
  mesh.userData.frameId = frameId;
  group.add(mesh);
  // 构造与真实 raycast 等价的交点（世界坐标）
  return {
    distance: 1000,
    distanceToRay: 0,
    point: new THREE.Vector3(0, 0, worldZ + childZ),
    index: 0,
    face: null,
    faceIndex: 0,
    object: mesh,
    uv: new THREE.Vector2(),
  } as unknown as THREE.Intersection<THREE.Object3D>;
}

describe('pickTopFrameIdFromIntersections 世界 z 排序（round 176）', () => {
  it('帧层级 z（group）决定命中优先级，非子网格装饰偏移', () => {
    // frameA 层级 z=5（视觉上层），frameB z=3——两者子 mesh 装饰偏移同为 0.1
    const a = makeIntersect('frameA', 5, 0.1);
    const b = makeIntersect('frameB', 3, 0.1);
    // 输入顺序故意 B 在前（raycaster 遍历序不代表视觉序）
    const hit = pickTopFrameIdFromIntersections([b, a]);
    expect(hit).toBe('frameA');
  });

  it('同世界 z 时保持输入序（稳定排序，等价原行为）', () => {
    const a = makeIntersect('frameA', 3, 0.1);
    const b = makeIntersect('frameB', 3, 0.1);
    const hit = pickTopFrameIdFromIntersections([b, a]);
    expect(hit).toBe('frameB');
  });

  it('无 frameId 的对象跳过（extractFrameId 沿父链）', () => {
    const a = makeIntersect('frameA', 5, 0.1);
    const noId = makeIntersect('', 9, 0.9);
    (noId.object as THREE.Mesh).userData = {};
    const hit = pickTopFrameIdFromIntersections([noId, a]);
    expect(hit).toBe('frameA');
  });

  it('shouldIgnoreFrameId 过滤命中（锁定帧不响应点选）', () => {
    const a = makeIntersect('frameA', 5, 0.1);
    const b = makeIntersect('frameB', 3, 0.1);
    const hit = pickTopFrameIdFromIntersections([a, b], id => id === 'frameA');
    expect(hit).toBe('frameB');
  });

  it('空 intersects 返回 null', () => {
    expect(pickTopFrameIdFromIntersections([])).toBeNull();
  });
});
