import { ens_normalize } from "@adraffy/ens-normalize";
import { describe, expect, it } from "vitest";

import { reservedNames } from "../lib/reserved";
import { featuredNames } from "./featured";

describe("featured names", () => {
  it("only shows people whose names are reserved", () => {
    for (const f of featuredNames.filter((f) => f.x)) {
      expect(reservedNames.has(f.label), `${f.label}.hex must be in script/reserved-names.csv`).toBe(true);
    }
  });

  it("have a picture saved for every person", () => {
    const saved = Object.keys(import.meta.glob("../assets/avatars/*.jpg"));
    for (const f of featuredNames.filter((f) => f.x)) {
      expect(saved, `run "npm run avatars" to save @${f.x}'s picture`).toContain(
        `../assets/avatars/${f.x!.toLowerCase()}.jpg`,
      );
    }
  });

  it("are written as wallets will look them up", () => {
    for (const f of featuredNames) expect(ens_normalize(f.label)).toBe(f.label);
  });

  it("are not repeated", () => {
    const labels = featuredNames.map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
