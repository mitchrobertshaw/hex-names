import { appUrl } from "../site";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <a className="brand" href="#top" aria-label="HexNS, Hex Name Service: back to the top">
          <Logo height={30} />
          <span className="brand__name">HexNS</span>
        </a>
        <nav className="nav__links" aria-label="Sections">
          <a href="#chains">Both chains</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav__actions">
          <ThemeToggle />
          <a className="button button--primary button--small" href={appUrl()}>
            Launch app
          </a>
        </div>
      </div>
    </header>
  );
}
