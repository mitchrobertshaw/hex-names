import { useState } from "react";

const GRADIENTS = [
  "linear-gradient(135deg, #ffc400, #ff6a1f)",
  "linear-gradient(135deg, #ff6a1f, #e5007a)",
  "linear-gradient(135deg, #ff3d5a, #9b2bff)",
  "linear-gradient(135deg, #ffb800, #e5007a)",
  "linear-gradient(135deg, #ff8a00, #ff3d5a)",
  "linear-gradient(135deg, #e5007a, #6d3bff)",
];

function gradientFor(label: string): string {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * A person's X profile picture, saved in public/avatars by `npm run avatars`, or, for names that
 * aren't people or if the picture is missing, the name's first letter on a warm gradient.
 */
export function Avatar({ label, x, size = 34 }: { label: string; x?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (x && !failed) {
    return (
      <img
        className="avatar"
        src={`/avatars/${x.toLowerCase()}.jpg`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="avatar avatar--letter" style={{ width: size, height: size, background: gradientFor(label) }}>
      {[...label][0]?.toUpperCase()}
    </span>
  );
}
