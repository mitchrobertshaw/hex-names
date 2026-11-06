// The plumbing for the hero's 3D scene: the renderer, camera, studio lighting, resizing, following
// the light/dark theme, the pointer, and an animation loop that only runs while the scene is on
// screen, the tab is open and the visitor hasn't asked for less motion.
import {
  Color,
  MathUtils,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface Kit {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  reducedMotion: boolean;
  /** The pointer, smoothed, from -1 to 1 on each axis (0 when reduced motion is on). */
  pointer: { x: number; y: number };
  /**
   * The pointer over the canvas, in WebGL's coordinates (-1 to 1, y up), and whether it is there.
   * `taps` counts clicks and taps on the canvas that aren't on a link, button or field, so the
   * scene can react to each one.
   */
  canvasPointer: { x: number; y: number; over: boolean; taps: number };
  /** The size of the view, in scene units, at depth 0. */
  view(): { width: number; height: number; aspect: number };
  /** A colour from the page's CSS variables, e.g. "--bg". */
  cssColor(name: string, fallback: string): Color;
  isDark(): boolean;
  onResize(handler: () => void): void;
  onTheme(handler: () => void): void;
  /** Starts drawing; `frame` gets the time in seconds. */
  start(frame: (time: number) => void): void;
  /** Disposes `thing` when the scene is unmounted. */
  track<T extends { dispose(): void }>(thing: T): T;
  dispose(): void;
}

export function createKit(
  canvas: HTMLCanvasElement,
  { fov = 35, distance = 10, environment = 0.7, alpha = true } = {},
): Kit {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = environment;

  const camera = new PerspectiveCamera(fov, 1, 0.1, 200);
  camera.position.set(0, 0, distance);

  const disposables: { dispose(): void }[] = [envTexture, pmrem];
  const resizeHandlers: (() => void)[] = [];
  const themeHandlers: (() => void)[] = [];
  const target = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  const canvasPointer = { x: 0, y: 0, over: false, taps: 0 };
  let frameFn: ((time: number) => void) | null = null;
  let running = false;
  let onScreen = true;
  let raf = 0;
  const startTime = performance.now();

  function render(now: number) {
    if (!frameFn) return;
    if (!reducedMotion) {
      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;
    }
    frameFn(reducedMotion ? 2 : (now - startTime) / 1000);
    renderer.render(scene, camera);
  }

  function loop(now: number) {
    render(now);
    raf = requestAnimationFrame(loop);
  }

  function update() {
    const shouldRun = Boolean(frameFn) && !reducedMotion && onScreen && document.visibilityState === "visible";
    if (shouldRun && !running) raf = requestAnimationFrame(loop);
    if (!shouldRun && running) cancelAnimationFrame(raf);
    running = shouldRun;
    if (!running) render(performance.now());
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resizeHandlers.forEach((handler) => handler());
    if (!running) render(performance.now());
  }

  function themeChanged() {
    themeHandlers.forEach((handler) => handler());
    if (!running) render(performance.now());
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  });
  intersectionObserver.observe(canvas);
  const themeObserver = new MutationObserver(themeChanged);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkQuery.addEventListener("change", themeChanged);
  // The canvas lets clicks through to the page, so the pointer is followed on the window.
  const client = { x: 0, y: 0, known: false };
  const locatePointer = () => {
    if (!client.known) return;
    const rect = canvas.getBoundingClientRect();
    canvasPointer.x = ((client.x - rect.left) / rect.width) * 2 - 1;
    canvasPointer.y = -((client.y - rect.top) / rect.height) * 2 + 1;
    canvasPointer.over = Math.abs(canvasPointer.x) <= 1 && Math.abs(canvasPointer.y) <= 1;
  };
  const followPointer = (event: PointerEvent) => {
    target.x = (event.clientX / window.innerWidth) * 2 - 1;
    target.y = (event.clientY / window.innerHeight) * 2 - 1;
    client.x = event.clientX;
    client.y = event.clientY;
    client.known = true;
    locatePointer();
  };
  // A tap on a link, button or field is for that, not for the scene.
  const onPointerDown = (event: PointerEvent) => {
    followPointer(event);
    const onControl =
      event.target instanceof Element && event.target.closest("a, button, input, select, textarea, label, summary, dialog");
    if (canvasPointer.over && !onControl) canvasPointer.taps += 1;
  };
  // A finger that lifts has gone; a mouse stays where it is.
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") canvasPointer.over = false;
  };
  const onPointerLeave = () => {
    canvasPointer.over = false;
    client.known = false;
  };
  window.addEventListener("pointermove", followPointer, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("scroll", locatePointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", update);

  return {
    renderer,
    scene,
    camera,
    reducedMotion,
    pointer,
    canvasPointer,
    view() {
      const height = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.length();
      return { width: height * camera.aspect, height, aspect: camera.aspect };
    },
    cssColor(name, fallback) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return new Color(value || fallback);
    },
    isDark() {
      return getComputedStyle(document.documentElement).colorScheme.includes("dark");
    },
    onResize(handler) {
      resizeHandlers.push(handler);
    },
    onTheme(handler) {
      themeHandlers.push(handler);
    },
    start(frame) {
      frameFn = frame;
      resize();
      themeChanged();
      update();
    },
    track(thing) {
      disposables.push(thing);
      return thing;
    },
    dispose() {
      cancelAnimationFrame(raf);
      running = false;
      frameFn = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      darkQuery.removeEventListener("change", themeChanged);
      window.removeEventListener("pointermove", followPointer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("scroll", locatePointer);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", update);
      disposables.forEach((thing) => thing.dispose());
      renderer.dispose();
      renderer.forceContextLoss(); // free the GPU straight away when switching designs
    },
  };
}

/** Eases 0..1 to 0..1, slow at both ends. */
export const easeInOut = (x: number) => x * x * (3 - 2 * x);
