import { useEffect, useRef } from "react";

/**
 * The 3D HEX logo behind the top of the page. three.js loads after the page; without WebGL the
 * canvas stays empty and the page looks as it would without it.
 */
export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import("../three/scene")
      .then(({ mountHexScene }) => {
        if (cancelled) return;
        unmount = mountHexScene(canvas);
        canvas.classList.add("is-ready");
      })
      .catch(() => {
        // No WebGL, or the scene failed to load: leave the canvas empty.
      });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero__scene" aria-hidden="true" />;
}
