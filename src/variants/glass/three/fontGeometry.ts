import * as THREE from 'three/webgpu';
import { parse, type Font, type Path } from 'opentype.js';

const cache = new Map<string, Promise<Font>>();

export function loadFont(url: string) {
  let font = cache.get(url);
  if (!font) {
    font = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font request failed: ${url}`);
        return response.arrayBuffer();
      })
      .then((buffer) => parse(buffer));
    cache.set(url, font);
  }
  return font;
}

/** opentype 的路径是 y 朝下的，转成 three 的 y 朝上形状 */
function pathToShapes(path: Path) {
  const shapePath = new THREE.ShapePath();
  for (const command of path.commands) {
    if (command.type === 'M') shapePath.moveTo(command.x, -command.y);
    else if (command.type === 'L') shapePath.lineTo(command.x, -command.y);
    else if (command.type === 'Q') shapePath.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y);
    else if (command.type === 'C') {
      shapePath.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y);
    }
  }
  return shapePath.toShapes();
}

export function glyphAdvance(font: Font, char: string, size: number) {
  return (font.charToGlyph(char).advanceWidth / font.unitsPerEm) * size;
}

/** 单个字母的挤出几何体，原点在字母左下角（基线） */
export function extrudeGlyph(font: Font, char: string, size: number, depth: number) {
  const shapes = pathToShapes(font.charToGlyph(char).getPath(0, 0, size));
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: depth * 0.22,
    bevelSize: size * 0.022,
    bevelSegments: 5,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** 一行平面文字（贴在玻璃上的刻字），返回几何体和宽度，原点在左侧基线 */
export function flatText(font: Font, text: string, size: number) {
  const shapes = pathToShapes(font.getPath(text, 0, 0, size));
  const geometry = new THREE.ShapeGeometry(shapes, 8);
  return { geometry, width: font.getAdvanceWidth(text, size) };
}
