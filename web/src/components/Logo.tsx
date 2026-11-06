import { useId } from "react";

/** The HexNS mark, "Bead": a hexagon strung on a network line between two nodes. One filled path. */
export const BEAD_PATH =
  "M50.011 33.45L42.261 46.873A2.9 2.9 0 0 1 39.75 48.323L24.25 48.323A2.9 2.9 0 0 1 21.739 46.873L13.989 33.45A2.9 2.9 0 0 1 13.989 30.55L21.739 17.127A2.9 2.9 0 0 1 24.25 15.677L39.75 15.677A2.9 2.9 0 0 1 42.261 17.127L50.011 30.55A2.9 2.9 0 0 1 50.011 33.45ZM44.151 32L38.076 21.477L25.924 21.477L19.849 32L25.924 42.523L38.076 42.523ZM8 29.1H17V34.9H8ZM47 29.1H56V34.9H47ZM2.6 32A5.4 5.4 0 1 1 13.4 32A5.4 5.4 0 1 1 2.6 32ZM50.6 32A5.4 5.4 0 1 1 61.4 32A5.4 5.4 0 1 1 50.6 32ZM26.8 32A5.2 5.2 0 1 1 37.2 32A5.2 5.2 0 1 1 26.8 32Z";

const RATIO = 1.8011; // width / height

/** The mark in the HexNS gradient, `height` pixels tall. Decorative: "HexNS" is written beside it. */
export function Logo({ height = 22 }: { height?: number }) {
  const id = `hexns-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className="logo"
      width={Math.round(height * RATIO * 10) / 10}
      height={height}
      viewBox="2.6 15.677 58.8 32.647"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="4" y1="22" x2="60" y2="42">
          <stop offset="0" stopColor="#FFC400" />
          <stop offset="0.5" stopColor="#FF6A1F" />
          <stop offset="1" stopColor="#E5007A" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d={BEAD_PATH} />
    </svg>
  );
}
