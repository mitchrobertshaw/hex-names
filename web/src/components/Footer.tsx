import { Brand } from "./Brand";

/** The footer. On a page other than the homepage, `home` ("/") points its links at the homepage. */
export function Footer({ home = "" }: { home?: string }) {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Brand href={home || "#top"} label={home ? "HexNS: the homepage" : "HexNS: back to the top"} tagline={false} />
          <p>HEX Name Service: names for Hexicans, on PulseChain and Ethereum.</p>
        </div>
        <nav className="footer__links" aria-label="Footer">
          <a href={`${home}#how`}>How it works</a>
          <a href={`${home}#pricing`}>Pricing</a>
          <a href={`${home}#faq`}>FAQ</a>
        </nav>
      </div>
      <div className="container footer__small">
        <p>.hex names never end in .eth.</p>
        <p>An independent community project. Not run by, or affiliated with, HEX, PulseChain or ENS.</p>
      </div>
    </footer>
  );
}
