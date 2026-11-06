// The hero's 3D scene, "Honeycomb": a field of hexagonal pillars rising and falling in a slow wave
// across the bottom of the screen, warmer where they rise, fading into the page in the distance.
// Pillars near the pointer rise and light up, and a click or tap sends a ripple across the field.
import {
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

import { gradientAt } from "./hex";
import { createKit } from "./kit";

const RADIUS = 0.5;
const COLUMNS = 34;
const ROWS = 18;
/** How far the pointer's bump reaches, in scene units (a pillar or two). */
const REACH = 1.15;
/** How fast a ripple spreads, in scene units a second, and how long it lasts. */
const RIPPLE_SPEED = 6.5;
const RIPPLE_LIFE = 3.5;
const MAX_RIPPLES = 6;

export function mount(canvas: HTMLCanvasElement): () => void {
  const kit = createKit(canvas, { fov: 30, environment: 0.5 });
  const { scene, camera } = kit;
  scene.add(new HemisphereLight(0xffffff, 0x3a2030, 1.2));
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(-4, 10, 6);
  scene.add(key);
  const fog = new Fog(0xffffff, 14, 34);
  scene.fog = fog;

  const geometry = kit.track(new CylinderGeometry(RADIUS * 0.9, RADIUS * 0.9, 1, 6));
  geometry.translate(0, 0.5, 0); // stand on the ground
  const material = kit.track(new MeshStandardMaterial({ roughness: 0.42, metalness: 0.12 }));
  const field = new InstancedMesh(geometry, material, COLUMNS * ROWS);
  scene.add(field);

  // Pointy-topped hexagons in offset rows.
  const cells: { x: number; z: number; phase: number; hue: number }[] = [];
  const dx = Math.sqrt(3) * RADIUS;
  const dz = 1.5 * RADIUS;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const x = (col - COLUMNS / 2) * dx + (row % 2 ? dx / 2 : 0);
      const z = (row - ROWS + 4) * dz;
      cells.push({ x, z, phase: Math.random() * Math.PI * 2, hue: (x / (COLUMNS * dx) + 0.5) * 0.9 + 0.05 });
    }
  }
  const back = (4 - ROWS) * dz; // the far edge of the field
  const front = 3 * dz;
  const side = (COLUMNS / 2) * dx;

  let base = new Color();
  kit.onTheme(() => {
    base = kit.cssColor("--surface-2", "#fff4ec");
    fog.color.copy(kit.cssColor("--bg", "#fff9f4"));
  });
  // The camera looks slightly upwards, so the field fills the bottom of the screen like a floor.
  let lookY = 4;
  kit.onResize(() => {
    const narrow = kit.view().aspect < 0.9;
    camera.position.set(0, narrow ? 7 : 6, narrow ? 22 : 16);
    lookY = narrow ? 4.6 : 4;
    camera.lookAt(0, lookY, 0);
  });

  // Where the pointer meets the field: on the pillar tops, roughly, or, pointing above the field,
  // at its far edge, so a click anywhere on the hero sends a ripple.
  const raycaster = new Raycaster();
  const tops = new Plane(new Vector3(0, 1, 0), -0.5);
  const farEdge = new Plane(new Vector3(0, 0, 1), -back);
  const ndc = new Vector2();
  const hit = new Vector3();
  function pointerOnField(allowFarEdge: boolean): Vector3 | null {
    ndc.set(kit.canvasPointer.x, kit.canvasPointer.y);
    raycaster.setFromCamera(ndc, camera);
    const point = raycaster.ray.intersectPlane(tops, hit);
    if (point && point.z >= back - 0.5 && point.z <= front + 1 && Math.abs(point.x) <= side + 1) return point;
    if (!allowFarEdge) return null;
    const behind = raycaster.ray.intersectPlane(farEdge, hit);
    return behind && Math.abs(behind.x) <= side ? behind : null;
  }

  const hover = { x: 0, z: 0, strength: 0 };
  const ripples: { x: number; z: number; start: number }[] = [];
  let taps = kit.canvasPointer.taps;
  let last = 0;

  const dummy = new Object3D();
  const color = new Color();
  const warm = new Color();
  kit.start((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    camera.position.x = kit.pointer.x * 0.8;
    camera.lookAt(0, lookY, 0);
    camera.updateMatrixWorld();

    // Follow the pointer smoothly; when it leaves, the bump sinks back where it was.
    const point = kit.canvasPointer.over ? pointerOnField(false) : null;
    if (point) {
      if (hover.strength < 0.02) {
        hover.x = point.x;
        hover.z = point.z;
      }
      const follow = 1 - Math.exp(-dt * 12);
      hover.x += (point.x - hover.x) * follow;
      hover.z += (point.z - hover.z) * follow;
    }
    hover.strength += ((point ? 1 : 0) - hover.strength) * (1 - Math.exp(-dt * (point ? 6 : 3)));

    if (kit.canvasPointer.taps !== taps) {
      taps = kit.canvasPointer.taps;
      const at = pointerOnField(true);
      if (at) ripples.push({ x: at.x, z: at.z, start: t });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
    }
    while (ripples.length && t - ripples[0].start > RIPPLE_LIFE) ripples.shift();

    cells.forEach((cell, i) => {
      const distance = Math.hypot(cell.x, cell.z + 2);
      const wave = 0.5 + 0.5 * Math.sin(distance * 0.75 - t * 1.1 + cell.phase * 0.15);
      const swell = wave * Math.exp(-distance * 0.08);

      let bump = 0;
      if (hover.strength > 0.002) {
        const d2 = (cell.x - hover.x) ** 2 + (cell.z - hover.z) ** 2;
        bump = hover.strength * Math.exp(-d2 / (2 * REACH * REACH));
      }
      let ring = 0;
      for (const ripple of ripples) {
        const age = t - ripple.start;
        const d = Math.hypot(cell.x - ripple.x, cell.z - ripple.z);
        ring += Math.exp(-((d - age * RIPPLE_SPEED) ** 2) / 0.9) * Math.exp(-age * 0.9);
      }
      const glow = Math.min(1, bump + ring);

      dummy.position.set(cell.x, 0, cell.z);
      dummy.scale.set(1, 0.16 + (swell + bump * 1.4 + ring * 1.1) * 1.05, 1);
      dummy.updateMatrix();
      field.setMatrixAt(i, dummy.matrix);

      gradientAt(cell.hue, warm);
      color.copy(base).lerp(warm, Math.min(1, Math.min(0.9, swell * 1.1) + glow * 0.8));
      if (glow > 0.002) color.multiplyScalar(1 + glow * 0.45); // brighter than the light alone
      field.setColorAt(i, color);
    });
    field.instanceMatrix.needsUpdate = true;
    if (field.instanceColor) field.instanceColor.needsUpdate = true;
  });
  return kit.dispose;
}
