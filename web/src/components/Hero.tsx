import { LAUNCHED } from "../site";
import { FloatingNames } from "./FloatingNames";
import { NameSearch } from "./NameSearch";

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <FloatingNames variant="scatter" />
      <div className="container hero__content">
        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          <span>
            Made for Hexicans
            <span className="eyebrow__more"> · {LAUNCHED ? "Live on PulseChain" : "Coming soon to PulseChain"}</span>
          </span>
        </p>
        <h1 id="hero-title">
          Swap your 0x… for <span className="grad-text">yourname.hex</span>
        </h1>
        <p className="lede">
          One name for your wallet on PulseChain and Ethereum. $5&nbsp;a&nbsp;year, paid in PLS, HEX or any token.
        </p>
        <NameSearch />
      </div>
      <FloatingNames variant="marquee" />
    </section>
  );
}
