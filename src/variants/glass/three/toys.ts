import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type GlassOptions = {
  roughness?: number;
  thickness?: number;
  attenuation?: number;
  dispersion?: number;
  iridescence?: number;
  base?: string;
};

/** 物理磨砂玻璃：真实透射 + 粗糙度磨砂 + 色散 + 体积吸收染色 */
export function frostedGlass(tint: string, options: GlassOptions = {}) {
  return new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(options.base ?? '#ffffff'),
    metalness: 0,
    roughness: options.roughness ?? 0.3,
    transmission: 1,
    thickness: options.thickness ?? 0.9,
    ior: 1.46,
    dispersion: options.dispersion ?? 3,
    attenuationColor: new THREE.Color(tint),
    attenuationDistance: options.attenuation ?? 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    specularIntensity: 1,
    iridescence: options.iridescence ?? 0,
    iridescenceIOR: 1.3,
  });
}

function heartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.44);
  shape.bezierCurveTo(-0.08, -0.34, -0.52, -0.08, -0.52, 0.17);
  shape.bezierCurveTo(-0.52, 0.42, -0.31, 0.52, -0.18, 0.52);
  shape.bezierCurveTo(-0.07, 0.52, 0, 0.44, 0, 0.35);
  shape.bezierCurveTo(0, 0.44, 0.07, 0.52, 0.18, 0.52);
  shape.bezierCurveTo(0.31, 0.52, 0.52, 0.42, 0.52, 0.17);
  shape.bezierCurveTo(0.52, -0.08, 0.08, -0.34, 0, -0.44);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    curveSegments: 36,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.1,
    bevelSegments: 8,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function starGeometry() {
  const shape = new THREE.Shape();
  const points = 5;
  for (let index = 0; index < points * 2; index += 1) {
    const angle = Math.PI / 2 + (index * Math.PI) / points;
    const radius = index % 2 === 0 ? 0.52 : 0.27;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.09,
    bevelSegments: 8,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

export type ToyKind = 'heart' | 'star' | 'capsule' | 'bubble' | 'cube' | 'planet';

export const toyKinds: ToyKind[] = ['heart', 'star', 'capsule', 'bubble', 'cube', 'planet'];

/** 返回一个玩具（Group），以及它的碰撞半径 */
export function createToy(kind: ToyKind): { object: THREE.Group; radius: number } {
  const group = new THREE.Group();
  group.name = kind;
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    return mesh;
  };

  switch (kind) {
    case 'heart':
      add(heartGeometry(), frostedGlass('#ff7fb5', { roughness: 0.3, dispersion: 4.5, attenuation: 1.5 }));
      return { object: group, radius: 0.55 };
    case 'star':
      add(starGeometry(), frostedGlass('#ffd257', { roughness: 0.32, attenuation: 1.3 }));
      return { object: group, radius: 0.52 };
    case 'capsule': {
      const mesh = add(new THREE.CapsuleGeometry(0.26, 0.5, 10, 32), frostedGlass('#5fd6a4', { roughness: 0.36, attenuation: 1.5 }));
      mesh.rotation.z = 0.7;
      return { object: group, radius: 0.5 };
    }
    case 'bubble':
      add(
        new THREE.SphereGeometry(0.42, 64, 32),
        frostedGlass('#a9d8ff', { roughness: 0.04, thickness: 0.35, attenuation: 2.4, iridescence: 1, dispersion: 6 }),
      );
      return { object: group, radius: 0.44 };
    case 'cube':
      add(new RoundedBoxGeometry(0.72, 0.72, 0.72, 6, 0.2), frostedGlass('#b9a3ff', { roughness: 0.38, attenuation: 1.4 }));
      return { object: group, radius: 0.5 };
    case 'planet': {
      add(new THREE.SphereGeometry(0.28, 48, 24), frostedGlass('#ff8cc3', { roughness: 0.24, attenuation: 1.1 }));
      const ring = add(new THREE.TorusGeometry(0.47, 0.04, 16, 96), frostedGlass('#8ec8ff', { roughness: 0.14, attenuation: 1.2 }));
      ring.rotation.x = 1.15;
      ring.rotation.y = 0.35;
      return { object: group, radius: 0.5 };
    }
    default:
      return { object: group, radius: 0.5 };
  }
}
