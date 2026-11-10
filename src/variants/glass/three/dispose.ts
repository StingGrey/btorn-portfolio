import type * as THREE from 'three/webgpu';

/** 把一棵物体树用到的几何体和材质都释放掉（共用的只释放一次） */
export function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[];
    (Array.isArray(material) ? material : [material]).forEach((item) => materials.add(item));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
