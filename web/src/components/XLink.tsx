import { X_URL } from "../site";
import { XIcon } from "./icons";

/** A round button to HexNS on X, beside the light and dark switch. Opens in a new tab. */
export function XLink() {
  return (
    <a className="icon-button" href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="HexNS on X (opens in a new tab)" title="HexNS on X">
      <XIcon />
    </a>
  );
}
