import { appUrl } from "../site";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { XLink } from "./XLink";

/** The top bar. On a page other than the homepage, `home` ("/") points its links at the homepage. */
export function Nav({ home = "" }: { home?: string }) {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <Brand
          href={home || "#top"}
          label={home ? "HexNS, HEX Name Service: the homepage" : "HexNS, HEX Name Service: back to the top"}
        />
        <nav className="nav__links" aria-label="Sections">
          <a href={`${home}#chains`}>Both chains</a>
          <a href={`${home}#how`}>How it works</a>
          <a href={`${home}#pricing`}>Pricing</a>
          <a href={`${home}#faq`}>FAQ</a>
        </nav>
        <div className="nav__actions">
          <XLink />
          <ThemeToggle />
          <a className="button button--primary button--small" href={appUrl()}>
            Launch app
          </a>
        </div>
      </div>
    </header>
  );
}
