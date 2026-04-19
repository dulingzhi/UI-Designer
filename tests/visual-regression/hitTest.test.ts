import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pickTopFrameIdFromIntersections } from '../../src/renderer/hitTest';

function makeHit(z: number, frameId?: string, parentFrameId?: string): THREE.Intersection<THREE.Object3D> {
  const obj = new THREE.Object3D();
  obj.position.z = z;
  if (frameId) obj.userData.frameId = frameId;

  if (parentFrameId) {
    const parent = new THREE.Object3D();
    parent.userData.frameId = parentFrameId;
    parent.add(obj);
  }

  return {
    distance: 0,
    point: new THREE.Vector3(),
    object: obj,
  } as THREE.Intersection<THREE.Object3D>;
}

describe('pickTopFrameIdFromIntersections', () => {
  it('returns top-most frame by z order', () => {
    const intersects = [
      makeHit(0.1, 'low'),
      makeHit(0.9, 'high'),
      makeHit(0.5, 'mid'),
    ];

    expect(pickTopFrameIdFromIntersections(intersects)).toBe('high');
  });

  it('skips ignored top frame and returns next hit frame', () => {
    const intersects = [
      makeHit(0.9, 'ignore-me'),
      makeHit(0.5, 'pick-me'),
    ];

    const picked = pickTopFrameIdFromIntersections(intersects, (id) => id === 'ignore-me');
    expect(picked).toBe('pick-me');
  });

  it('walks parent chain when hit object has no frameId', () => {
    const intersects = [makeHit(0.6, undefined, 'parent-frame')];
    expect(pickTopFrameIdFromIntersections(intersects)).toBe('parent-frame');
  });

  it('returns null when all hit frames are ignored', () => {
    const intersects = [
      makeHit(0.9, 'a'),
      makeHit(0.5, 'b'),
    ];

    const picked = pickTopFrameIdFromIntersections(intersects, () => true);
    expect(picked).toBeNull();
  });
});