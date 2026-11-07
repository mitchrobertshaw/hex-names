import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { GITHUB_URL } from "../site";
import { deployment, network } from "./network";
import { MyNamesPage, NamePage, SearchPage } from "./pages";
import { linkProps, useRoute } from "./router";
import { WalletButton } from "./WalletButton";

/** The homepage: hexns.domains from the live app, or the same site's root on a preview link. */
function homeUrl(): string {
  const { hostname, protocol } = window.location;
  return protocol === "file:" || hostname === "app.hexns.domains" ? "https://hexns.domains" : "/";
}

/** app.hexns.domains: find, buy and manage .hex names. */
export function App() {
  const route = useRoute();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <div className="container nav__inner">
          <a className="brand" href={homeUrl()} aria-label="HexNS home">
            <Logo height={30} />
            <span className="brand__name">HexNS</span>
          </a>
          <nav className="app-nav__links" aria-label="App">
            <a {...linkProps({ page: "search" })} aria-current={route.page !== "names" ? "page" : undefined}>
              Search
            </a>
            <a {...linkProps({ page: "names" })} aria-current={route.page === "names" ? "page" : undefined}>
              My names
            </a>
          </nav>
          <div className="nav__actions">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {!deployment ? (
        <p className="app-banner">
          <b>Preview.</b> The contracts aren&rsquo;t connected yet: search, prices and wallets work, and buying is a
          walkthrough that sends nothing.
        </p>
      ) : network === "testnet" ? (
        <p className="app-banner">
          <b>Testnet.</b> PulseChain Testnet v4 and Sepolia, with test coins. Nothing here costs real money.
        </p>
      ) : null}

      <main id="main" className="container app-main">
        {route.page === "name" ? (
          <NamePage label={route.label} />
        ) : route.page === "names" ? (
          <MyNamesPage />
        ) : (
          <SearchPage />
        )}
      </main>

      <footer className="app-footer container">
        <p>
          <a href={homeUrl()}>HexNS</a> · <a href={GITHUB_URL}>GitHub</a> · .hex names never end in .eth.
        </p>
      </footer>
    </>
  );
}
