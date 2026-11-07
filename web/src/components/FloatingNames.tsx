import type { CSSProperties } from "react";

import { type FeaturedName, featuredNames } from "../data/featured";
import { Avatar } from "./Avatar";

/**
 * Where the names float on wide screens, inside the content width like ENS's: `x` is the distance
 * from that side, as a percentage of the content width; `y` is the distance from the middle of the
 * hero in pixels, chosen to sit beside the badge, above the words and beside the search, never
 * beside the wide headline. The first six people float here; everyone scrolls past on phones.
 */
const SLOTS: { side: "left" | "right"; x: number; y: number; scale: number }[] = [
  { side: "left", x: 13, y: -325, scale: 0.96 },
  { side: "right", x: 15, y: -312, scale: 1 },
  { side: "left", x: 0, y: -232, scale: 1.04 },
  { side: "right", x: 0, y: -222, scale: 1 },
  { side: "left", x: 1, y: 112, scale: 1 },
  { side: "right", x: 1, y: 100, scale: 1.04 },
  // None lower down: the search and the live line below it have the bottom to themselves.
];

function Pill({ name, style }: { name: FeaturedName; style?: CSSProperties }) {
  // The .hex takes the colour of the person's profile picture.
  const tone = name.tone ? ({ "--tld-light": name.tone.light, "--tld-dark": name.tone.dark } as CSSProperties) : {};
  return (
    <span className="pill" style={{ ...style, ...tone }} title={name.person ? `Reserved for ${name.person}` : undefined}>
      <Avatar label={name.label} x={name.x} />
      <span className="pill__name">
        {name.label}
        <span className="pill__tld">.hex</span>
      </span>
    </span>
  );
}

/** The KOLs' names: around the words on wide screens, a slowly scrolling row on narrow ones. */
export function FloatingNames({ variant }: { variant: "scatter" | "marquee" }) {
  if (variant === "scatter") {
    return (
      <div className="floating floating--scatter" aria-hidden="true">
        {featuredNames.slice(0, SLOTS.length).map((name, i) => {
          const slot = SLOTS[i];
          const style = {
            [slot.side]: `${slot.x}%`,
            "--y": `${slot.y}px`,
            "--scale": slot.scale,
            "--duration": `${6 + (i % 4) * 1.3}s`,
            "--delay": `${-i * 0.9}s`,
          } as CSSProperties;
          return <Pill key={name.label} name={name} style={style} />;
        })}
      </div>
    );
  }
  return (
    <div className="floating floating--marquee" aria-hidden="true">
      <div className="marquee">
        {[...featuredNames, ...featuredNames].map((name, i) => (
          <Pill key={`${name.label}-${i}`} name={name} />
        ))}
      </div>
    </div>
  );
}
