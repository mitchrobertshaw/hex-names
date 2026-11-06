// The 3D scene behind the top of the page: the HEX logo, extruded and glossy in its own gradient,
// swaying slowly, with small hexagons floating around it. Loaded separately from the rest of the
// site, so the page appears before three.js arrives.
import {
  BufferAttribute,
  type BufferGeometry,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  Shape,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

import { HEX_LOGO_GRADIENT, HEX_LOGO_PATH, HEX_LOGO_SIZE } from "./hexLogo";

const STOPS = HEX_LOGO_GRADIENT.stops.map((stop) => ({ offset: stop.offset, color: new Color(stop.color) }));
const LOGO_WIDTH = 5.2; // in scene units; the camera sees about 6.3 units from top to bottom

/** The logo gradient's colour at `t`, from 0 (pink) to 1 (yellow). */
function gradientAt(t: number, out: Color): Color {
  const x = MathUtils.clamp(t, 0, 1);
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1];
    const b = STOPS[i];
    if (x <= b.offset) return out.copy(a.color).lerp(b.color, (x - a.offset) / (b.offset - a.offset));
  }
  return out.copy(STOPS[STOPS.length - 1].color);
}

/** Colours every point of `geometry` by where it falls along the logo's gradient, as SVG would. */
function paintLogoGradient(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const width = max.x - min.x;
  const height = max.y - min.y;
  const { from, to } = HEX_LOGO_GRADIENT;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    const u = (position.getX(i) - min.x) / width;
    const v = (position.getY(i) - min.y) / height;
    gradientAt(((u - from.x) * dx + (v - from.y) * dy) / lengthSq, color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

function makeLogo(): Mesh {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${HEX_LOGO_PATH}"/></svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new ExtrudeGeometry(shapes, {
    depth: 26,
    bevelEnabled: true,
    bevelThickness: 5,
    bevelSize: 3.5,
    bevelSegments: 4,
    curveSegments: 8,
  });
  paintLogoGradient(geometry);
  geometry.center();
  // See-through, so it sits in the background behind the words (how much is set in styles.css).
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.15,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.3,
  });
  const logo = new Mesh(geometry, material);
  const scale = LOGO_WIDTH / HEX_LOGO_SIZE.width;
  logo.scale.set(scale, -scale, scale); // SVG's y grows downwards
  return logo;
}

function hexagonShape(radius: number): Shape {
  const shape = new Shape();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (i * Math.PI) / 3;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Each small hexagon's colour, as a point along the logo's gradient. */
const HEXAGON_COLOURS = [0.1, 0.45, 0.75, 0.25, 0.95, 0.6];

/**
 * Where the small hexagons sit, as fractions of the view, with depth and size. On wide screens
 * they fill the gaps between the floating names; on narrow ones they keep to the top and bottom,
 * clear of the words. Hexagons without a place are hidden.
 */
const WIDE_PLACES = [
  { x: -0.42, y: 0.07, z: -1.5, size: 0.36 },
  { x: 0.44, y: 0.12, z: -2.0, size: 0.32 },
  { x: 0.44, y: -0.21, z: -1.0, size: 0.38 },
  { x: -0.31, y: -0.24, z: -0.8, size: 0.3 },
  { x: -0.18, y: 0.45, z: -3.0, size: 0.26 },
  { x: 0.16, y: -0.55, z: -2.4, size: 0.3 },
];
const NARROW_PLACES = [
  { x: -0.4, y: 0.47, z: -1.0, size: 0.16 },
  { x: 0.42, y: 0.42, z: -1.6, size: 0.13 },
  { x: -0.42, y: -0.36, z: -1.2, size: 0.14 },
  { x: 0.4, y: -0.4, z: -0.8, size: 0.17 },
];

/**
 * Draws the scene on `canvas`, sized to the canvas, until the returned function is called.
 * Throws if the browser can't do WebGL.
 */
export function mountHexScene(canvas: HTMLCanvasElement): () => void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.7;

  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new HemisphereLight(0xffffff, 0x5a2340, 1.1));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 8);
  scene.add(key);
  const pinkRim = new PointLight(0xff2fa0, 60, 30);
  pinkRim.position.set(-6, 2, 3);
  scene.add(pinkRim);
  const warmFill = new PointLight(0xffa020, 40, 30);
  warmFill.position.set(5, -4, 4);
  scene.add(warmFill);

  const logo = makeLogo();
  scene.add(logo);

  const hexGeometry = new ExtrudeGeometry(hexagonShape(1), {
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 3,
  });
  hexGeometry.center();
  const hexagons = HEXAGON_COLOURS.map((t, i) => {
    const material = new MeshPhysicalMaterial({
      color: gradientAt(t, new Color()),
      metalness: 0.2,
      roughness: 0.28,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    });
    const mesh = new Mesh(hexGeometry, material);
    mesh.rotation.set(i * 0.7, i * 1.1, 0);
    scene.add(mesh);
    return { mesh };
  });

  // Fit everything to the canvas: the logo takes at most 90% of the width, the hexagons spread out.
  let logoY = 0;
  function layout() {
    const viewHeight = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const viewWidth = viewHeight * camera.aspect;
    const fit = Math.min(1, (viewWidth * 0.9) / LOGO_WIDTH);
    const scale = (LOGO_WIDTH / HEX_LOGO_SIZE.width) * fit;
    logo.scale.set(scale, -scale, scale);
    logoY = viewHeight * 0.03;
    const places = camera.aspect < 0.9 ? NARROW_PLACES : WIDE_PLACES;
    hexagons.forEach(({ mesh }, i) => {
      const place = places[i];
      mesh.visible = Boolean(place);
      if (!place) return;
      mesh.scale.setScalar(place.size);
      mesh.position.set(place.x * viewWidth, place.y * viewHeight, place.z);
      mesh.userData.y = mesh.position.y;
    });
  }

  // How see-through the logo is follows the light or dark theme (--scene-logo-opacity).
  function applyTheme() {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--scene-logo-opacity"));
    (logo.material as MeshPhysicalMaterial).opacity = Number.isFinite(value) ? value : 0.3;
    if (!running) render(performance.now());
  }
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkQuery.addEventListener("change", applyTheme);

  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  const start = performance.now();
  function render(now: number) {
    const t = reducedMotion ? 2 : (now - start) / 1000;
    tilt.x += (pointer.y * 0.16 - tilt.x) * 0.05;
    tilt.y += (pointer.x * 0.24 - tilt.y) * 0.05;
    logo.rotation.y = Math.sin(t * 0.35) * 0.3 + tilt.y;
    logo.rotation.x = Math.sin(t * 0.27) * 0.12 + tilt.x;
    logo.position.y = logoY + Math.sin(t * 0.6) * 0.08;
    hexagons.forEach(({ mesh }, i) => {
      mesh.rotation.x = i * 0.7 + t * (0.18 + i * 0.03);
      mesh.rotation.y = i * 1.1 + t * (0.26 + i * 0.04);
      mesh.position.y = mesh.userData.y + Math.sin(t * 0.5 + i) * 0.15;
    });
    renderer.render(scene, camera);
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    layout();
    if (!running) render(performance.now());
  }

  // Only animate while the scene is on screen, the tab is open and motion is welcome.
  let running = false;
  let frame = 0;
  let onScreen = true;
  function loop(now: number) {
    render(now);
    frame = requestAnimationFrame(loop);
  }
  function update() {
    const shouldRun = !reducedMotion && onScreen && document.visibilityState === "visible";
    if (shouldRun && !running) frame = requestAnimationFrame(loop);
    if (!shouldRun && running) cancelAnimationFrame(frame);
    running = shouldRun;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  });
  intersectionObserver.observe(canvas);
  const onPointerMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", update);

  resize();
  applyTheme();
  update();

  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    themeObserver.disconnect();
    darkQuery.removeEventListener("change", applyTheme);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("visibilitychange", update);
    logo.geometry.dispose();
    (logo.material as MeshPhysicalMaterial).dispose();
    hexGeometry.dispose();
    for (const { mesh } of hexagons) (mesh.material as MeshPhysicalMaterial).dispose();
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
