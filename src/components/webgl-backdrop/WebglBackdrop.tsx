import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function WebglBackdrop() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const isCompact = window.innerWidth < 900 || window.devicePixelRatio > 1.5;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isCompact,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompact ? 1 : 1.25));
    mount.appendChild(renderer.domElement);

    const starCount = isCompact ? 720 : 1120;
    const starPositions = new Float32Array(starCount * 3);
    const starBasePositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 12;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 7.4;
      starPositions[i * 3 + 2] = -3.8 + Math.random() * 2.4;
      starBasePositions[i * 3] = starPositions[i * 3];
      starBasePositions[i * 3 + 1] = starPositions[i * 3 + 1];
      starBasePositions[i * 3 + 2] = starPositions[i * 3 + 2];

      const cool = Math.random();
      starColors[i * 3] = 0.72 + cool * 0.22;
      starColors[i * 3 + 1] = 0.78 + cool * 0.2;
      starColors[i * 3 + 2] = 0.92 + cool * 0.08;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: isCompact ? 0.016 : 0.014,
      transparent: true,
      opacity: 0.82,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    const points = isCompact ? 420 : 620;
    const positions = new Float32Array(points * 3);
    const colors = new Float32Array(points * 3);
    for (let i = 0; i < points; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.3 + Math.random() * 3.2;
      const lane = (Math.random() - 0.5) * 0.55;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius * 0.33 + lane;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2.6;

      const pinkBias = Math.random();
      colors[i * 3] = 0.75 + pinkBias * 0.25;
      colors[i * 3 + 1] = 0.42 + (1 - pinkBias) * 0.32;
      colors[i * 3 + 2] = 0.62 + (1 - pinkBias) * 0.38;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.018,
      transparent: true,
      opacity: 0.78,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const field = new THREE.Points(geometry, material);
    scene.add(field);

    const rings = new THREE.Group();
    const ringGeometries: THREE.BufferGeometry[] = [];
    const ringMaterials: THREE.Material[] = [];
    const cyan = new THREE.Color('#54f4ff');
    const pink = new THREE.Color('#ff6f9f');
    for (let i = 0; i < 5; i += 1) {
      const curve = new THREE.EllipseCurve(0, 0, 2.0 + i * 0.38, 0.48 + i * 0.08);
      const ringPoints = curve.getPoints(isCompact ? 96 : 132);
      const ringGeometry = new THREE.BufferGeometry().setFromPoints(
        ringPoints.map((point) => new THREE.Vector3(point.x, point.y, -0.4 - i * 0.08)),
      );
      const ringMaterial = new THREE.LineBasicMaterial({
        color: i % 2 ? cyan : pink,
        transparent: true,
        opacity: 0.16,
      });
      const ring = new THREE.Line(ringGeometry, ringMaterial);
      ring.rotation.z = i * 0.12;
      ringGeometries.push(ringGeometry);
      ringMaterials.push(ringMaterial);
      rings.add(ring);
    }
    scene.add(rings);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };

    const pointer = {
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
    };

    const movePointer = (event: PointerEvent) => {
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    let frame = 0;
    let isVisible = true;
    let disposed = false;
    const tick = () => {
      frame = 0;
      if (disposed || !isVisible) {
        return;
      }

      pointer.x += (pointer.tx - pointer.x) * 0.055;
      pointer.y += (pointer.ty - pointer.y) * 0.055;
      const pointerWorldX = pointer.x * 4.8;
      const pointerWorldY = -pointer.y * 3.0;
      const elapsed = performance.now() * 0.001;
      const starArray = starGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < starCount; i += 1) {
        const index = i * 3;
        const baseX = starBasePositions[index];
        const baseY = starBasePositions[index + 1];
        const dx = baseX - pointerWorldX;
        const dy = baseY - pointerWorldY;
        const distSq = dx * dx + dy * dy + 0.001;
        const pressure = Math.min(0.85, 1.7 / distSq);
        const wave = Math.sin(elapsed * 1.6 + i * 0.37) * 0.018;
        starArray[index] = baseX + dx * pressure * 0.28 + wave;
        starArray[index + 1] = baseY + dy * pressure * 0.2 - wave;
        starArray[index + 2] = starBasePositions[index + 2] + pressure * 0.46;
      }
      starGeometry.attributes.position.needsUpdate = true;
      camera.position.x = pointer.x * 0.28;
      camera.position.y = -pointer.y * 0.18;
      camera.lookAt(0, 0, 0);
      starField.rotation.y = pointer.x * 0.035;
      starField.rotation.x = -pointer.y * 0.025;
      field.rotation.z += 0.0007;
      field.rotation.x = Math.sin(performance.now() * 0.00025) * 0.12 - pointer.y * 0.04;
      field.rotation.y = pointer.x * 0.06;
      rings.rotation.z -= 0.0009;
      rings.rotation.x = -pointer.y * 0.08;
      rings.rotation.y = pointer.x * 0.1;
      renderer.render(scene, camera);

      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && isVisible && !disposed) {
        frame = requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    resize();
    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            ([entry]) => {
              isVisible = entry.isIntersecting;
              if (isVisible) {
                start();
              } else {
                stop();
              }
            },
            { rootMargin: '220px 0px', threshold: 0 },
          )
        : null;
    observer?.observe(mount);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', movePointer);
    start();

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', movePointer);
      starGeometry.dispose();
      starMaterial.dispose();
      geometry.dispose();
      material.dispose();
      ringGeometries.forEach((ringGeometry) => ringGeometry.dispose());
      ringMaterials.forEach((ringMaterial) => ringMaterial.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="webgl-backdrop" ref={mountRef} aria-hidden="true" />;
}
