// The names floating at the top of the homepage: HEX KOLs, with their X profile pictures.
//
// After adding someone, run `npm run avatars` to save their picture in src/assets/avatars.
// Every person here must also be in script/reserved-names.csv, so the homepage never advertises
// someone's name that a stranger could buy first. featured.test.ts checks both.

export interface FeaturedName {
  label: string; // the name without .hex
  person?: string; // who it belongs to, for people
  x?: string; // their X handle, without @
}

export const featuredNames: FeaturedName[] = [
  { label: "richardheart", person: "Richard Heart", x: "RichardHeartWin" },
  { label: "yourfriendsommi", person: "Your Friend Sommi", x: "yourfriendSOMMI" },
  { label: "cryptocoffee", person: "Crypto Coffee", x: "CryptoCoffee369" },
  { label: "broots", person: "BRoots", x: "iambroots" },
  { label: "hexologist", person: "Hexologist", x: "Hexologist31" },
  { label: "dollarcostcrypto", person: "Dollar Cost Crypto", x: "dollarcostcrypt" },
  { label: "matiallin", person: "Mati Allin", x: "MatiAllin" },
  { label: "nineironcapital", person: "NineIronCapital", x: "NineIronCapital" },
];
