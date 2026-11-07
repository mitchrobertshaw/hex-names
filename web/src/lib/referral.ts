// Referral links: hexns.domains/?ref=alice or app.hexns.domains/?ref=alice, where alice is the
// referrer's .hex name. The name is remembered for 30 days in the visitor's browser and goes with
// their purchase to the registrar as its referral tag: keccak256 of the name, as ENSv2 ids names.
// Referrers are paid from the registrar's records, to whoever owns the name when they're paid.

import { ens_normalize } from "@adraffy/ens-normalize";

const KEY = "hexns-ref";
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

/** The referrer's name from a ?ref= value, if it's a valid .hex name. */
export function referrerFrom(value: string | null): string | null {
  if (!value) return null;
  try {
    const label = ens_normalize(value.trim().replace(/\.hex$/i, ""));
    return label && !label.includes(".") && [...label].length >= 3 ? label : null;
  } catch {
    return null;
  }
}

/** Remembers a ?ref= in this page's address, and returns the referrer to credit, if any. */
export function captureReferral(now = Date.now()): string | null {
  try {
    const fromLink = referrerFrom(new URLSearchParams(window.location.search).get("ref"));
    if (fromLink) localStorage.setItem(KEY, JSON.stringify({ label: fromLink, at: now }));
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { label: string; at: number } | null;
    if (!saved || now - saved.at > DAYS_30) return null;
    return referrerFrom(saved.label);
  } catch {
    return null; // storage blocked: only a link in the address counts
  }
}

/** A link that brings a visitor in on `label`'s referral. */
export function referralLink(label: string, base = "https://hexns.domains"): string {
  return `${base}/?ref=${encodeURIComponent(label)}`;
}
