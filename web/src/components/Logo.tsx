import { useId } from "react";

/** The HexNS mark: a hexagon ring in warm HEX-style colours. */
export function Logo({ size = 32 }: { size?: number }) {
  const id = `hexns-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFC400" />
          <stop offset="0.45" stopColor="#FF6A1F" />
          <stop offset="1" stopColor="#E5007A" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        fillRule="evenodd"
        d="M32 3.5 56.7 17.75v28.5L32 60.5 7.3 46.25v-28.5zM32 20.5l-10.4 6v12L32 44.5l10.4-6v-12z"
      />
    </svg>
  );
}
