// The HEX gradient, from pink through red and orange to yellow, as hex.com's logo uses it.
import { Color, MathUtils } from "three";

const STOPS = [
  { offset: 0, color: new Color("#FE01FA") },
  { offset: 0.3163, color: new Color("#FF0F6F") },
  { offset: 0.5195, color: new Color("#FF3D3D") },
  { offset: 0.7086, color: new Color("#FF851F") },
  { offset: 1, color: new Color("#FFDB01") },
];

/** The HEX gradient's colour at `t`, from 0 (pink) to 1 (yellow). */
export function gradientAt(t: number, out = new Color()): Color {
  const x = MathUtils.clamp(t, 0, 1);
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1];
    const b = STOPS[i];
    if (x <= b.offset) return out.copy(a.color).lerp(b.color, (x - a.offset) / (b.offset - a.offset));
  }
  return out.copy(STOPS[STOPS.length - 1].color);
}
