import { LAUNCHED } from "../site";
import { Logo } from "./Logo";

export function Nav() {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <a className="brand" href="#top" aria-label="HexNS, Hex Name Service: back to the top">
          <Logo size={30} />
          <span className="brand__name">HexNS</span>
        </a>
        <nav className="nav__links" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <span className="nav__status">{LAUNCHED ? "Live on PulseChain" : "Launching soon"}</span>
      </div>
    </header>
  );
}
