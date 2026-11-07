import { YEARLY_PRICE } from "../lib/names";
import { LAUNCHED } from "../site";
import { FloatingNames } from "./FloatingNames";
import { LiveStrip } from "./LiveStrip";
import { NameSearch } from "./NameSearch";

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <FloatingNames variant="scatter" />
      <div className="container hero__content">
        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          <span>
            Built on <b>ENSv2</b>
            <span className="eyebrow__more">
              {" "}
              · {LAUNCHED ? "Live on PulseChain and Ethereum" : "Coming soon to PulseChain and Ethereum"}
            </span>
          </span>
        </p>
        <h1 id="hero-title">
          Your <span className="grad-text">.hex</span> name on PulseChain and Ethereum
        </h1>
        <p className="lede">
          Swap your 0x… for yourname.hex: one name for your wallet on both chains. ${YEARLY_PRICE}&nbsp;a&nbsp;year
          covers both, paid in PLS, HEX or any token.
        </p>
        <NameSearch />
        <p className="hero__note">
          <b>Every name exists once.</b> First come, first served.
        </p>
        <LiveStrip />
      </div>
      <FloatingNames variant="marquee" />
    </section>
  );
}
