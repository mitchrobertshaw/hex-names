import { YEARLY_PRICE } from "../lib/names";
import { LAUNCHED } from "../site";
import { FloatingNames } from "./FloatingNames";
import { HeroScene } from "./HeroScene";
import { NameSearch } from "./NameSearch";

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <HeroScene />
      <FloatingNames variant="scatter" />
      <div className="container hero__content">
        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          <span>
            Made for Hexicans
            <span className="eyebrow__more">
              {" "}
              · {LAUNCHED ? "Live on PulseChain and Ethereum" : "Coming soon to PulseChain and Ethereum"}
            </span>
          </span>
        </p>
        <h1 id="hero-title">
          The <span className="grad-text">.hex</span> name service for PulseChain and Ethereum
        </h1>
        <p className="lede">
          Swap your 0x… for yourname.hex: one name for your wallet on both chains. ${YEARLY_PRICE}&nbsp;a&nbsp;year
          covers both, paid in PLS, HEX or any token.
        </p>
        <NameSearch />
      </div>
      <FloatingNames variant="marquee" />
    </section>
  );
}
