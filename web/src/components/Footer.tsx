import { GITHUB_URL } from "../site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <a className="brand" href="#top" aria-label="HexNS: back to the top">
            <Logo height={20} />
            <span className="brand__name">HexNS</span>
          </a>
          <p>Hex Name Service: names for Hexicans, on PulseChain and Ethereum.</p>
        </div>
        <nav className="footer__links" aria-label="Footer">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </div>
      <div className="container footer__small">
        <p>.hex names never end in .eth.</p>
        <p>An independent community project. Not run by, or affiliated with, HEX, PulseChain or ENS.</p>
      </div>
    </footer>
  );
}
