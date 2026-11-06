import { useState } from "react";

import { Footer } from "./components/Footer";
import { HeadlinePicker } from "./components/HeadlinePicker";
import { Hero } from "./components/Hero";
import { Messages } from "./components/Messages";
import { Nav } from "./components/Nav";
import { Ownership } from "./components/Ownership";
import { BothChains, Cta, Faq, Features, HowItWorks, Pricing } from "./components/Sections";
import { DEFAULT_HEADLINE, HEADLINES } from "./hero/headlines";
import { SHOW_HEADLINE_PICKER } from "./site";

/** The headline from the address, e.g. ?headline=B, so a choice can be shared. */
function fromAddress(): string {
  const wanted = new URLSearchParams(window.location.search).get("headline")?.toUpperCase();
  return HEADLINES.find((h) => h.id === wanted)?.id ?? DEFAULT_HEADLINE;
}

function toAddress(headline: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("design");
    url.searchParams.set("headline", headline);
    window.history.replaceState(null, "", url);
  } catch {
    // A page opened from a file may not allow it; the choice still applies.
  }
}

export function App() {
  const [headline, setHeadline] = useState(fromAddress);

  function choose(next: string) {
    setHeadline(next);
    toAddress(next);
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero headline={headline} />
        <BothChains />
        <Messages />
        <Features />
        <HowItWorks />
        <Ownership />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
      {SHOW_HEADLINE_PICKER ? <HeadlinePicker headline={headline} onHeadline={choose} /> : null}
    </>
  );
}
