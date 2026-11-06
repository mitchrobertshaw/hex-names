// The names floating at the top of the homepage.
//
// People (HEX KOLs) have an X handle, and their X profile picture is shown next to their name.
// After adding someone, run `npm run avatars` to save their picture in public/avatars.
// Every person here must also be in script/reserved-names.csv, so the homepage never advertises
// someone's name that a stranger could buy first. featured.test.ts checks both.
//
// Until the list of KOLs is in, plain HEX words fill the rest. They aren't people, so they don't
// need reserving.

export interface FeaturedName {
  label: string; // the name without .hex
  person?: string; // who it belongs to, for people
  x?: string; // their X handle, without @
}

export const featuredNames: FeaturedName[] = [
  { label: "yourfriendsommi", person: "Your Friend Sommi", x: "yourfriendSOMMI" },
  { label: "hexican" },
  { label: "tshares" },
  { label: "fullterm" },
  { label: "staker" },
  { label: "bigpayday" },
  { label: "hearts" },
  { label: "ladder" },
  { label: "endstake" },
  { label: "5555days" },
];
