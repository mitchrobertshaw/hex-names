import type { CSSProperties } from "react";

import { type FeaturedName, featuredNames } from "../data/featured";
import { Avatar } from "./Avatar";

/** Where the names float on wide screens: around the headline, clear of the search box. */
const SLOTS: { side: "left" | "right"; x: number; y: number; tilt: number }[] = [
  { side: "left", x: 4, y: 20, tilt: -4 },
  { side: "right", x: 4, y: 16, tilt: 3 },
  { side: "left", x: 1.5, y: 50, tilt: 3 },
  { side: "right", x: 1.5, y: 46, tilt: -3 },
  { side: "left", x: 6, y: 78, tilt: 2 },
  { side: "right", x: 6, y: 76, tilt: -2 },
  { side: "left", x: 20, y: 3, tilt: 2 },
  { side: "right", x: 21, y: 4, tilt: -2 },
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

/**
 * Names floating at the top of the page. People (with their X picture) come first. Wide screens
 * scatter them around the hero; narrow screens show them as a slowly scrolling row.
 */
export function FloatingNames({ variant }: { variant: "scatter" | "marquee" }) {
  if (variant === "scatter") {
    return (
      <div className="floating floating--scatter" aria-hidden="true">
        {featuredNames.slice(0, SLOTS.length).map((name, i) => {
          const slot = SLOTS[i];
          const style = {
            [slot.side]: `${slot.x}%`,
            top: `${slot.y}%`,
            "--tilt": `${slot.tilt}deg`,
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
