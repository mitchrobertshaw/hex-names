import type { CSSProperties } from "react";

import { type FeaturedName, featuredNames } from "../data/featured";
import { Avatar } from "./Avatar";

/**
 * Where the names float on wide screens, inside the content width like ENS's: `x` is the distance
 * from that side, as a percentage of the content width; `y` is the distance from the middle of the
 * hero in pixels, chosen to sit beside the badge and the lede and above and below the words, never
 * beside the wide headline.
 */
const SLOTS: { side: "left" | "right"; x: number; y: number; tilt: number; scale: number }[] = [
  { side: "left", x: 13, y: -325, tilt: -3, scale: 0.96 },
  { side: "right", x: 15, y: -312, tilt: 3, scale: 1 },
  { side: "left", x: 0, y: -232, tilt: 2, scale: 1.04 },
  { side: "right", x: 0, y: -222, tilt: -2, scale: 1 },
  { side: "left", x: 1, y: 112, tilt: 3, scale: 1 },
  { side: "right", x: 1, y: 100, tilt: -3, scale: 1.04 },
  { side: "left", x: 9, y: 300, tilt: -2, scale: 0.98 },
  { side: "right", x: 11, y: 312, tilt: 2, scale: 0.96 },
];

function Pill({ name, style }: { name: FeaturedName; style?: CSSProperties }) {
  return (
    <span className="pill" style={style} title={name.person ? `Reserved for ${name.person}` : undefined}>
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
            "--tilt": `${slot.tilt}deg`,
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
