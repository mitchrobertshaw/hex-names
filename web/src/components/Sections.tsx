import type { ReactNode } from "react";

import { YEARLY_PRICE } from "../lib/names";
import { GITHUB_URL, LAUNCHED } from "../site";
import { ArrowIcon, ChainsIcon, CheckIcon, CodeIcon, CoinsIcon, GitHubIcon, ShieldIcon } from "./icons";

const PRICE = `$${YEARLY_PRICE}`;

function SectionHeading({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="section__heading">
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {children ? <p className="section__intro">{children}</p> : null}
    </div>
  );
}

function Resolves({ chain }: { chain: string }) {
  return (
    <p className="resolves">
      <span className="resolves__name">
        you<span className="pill__tld">.hex</span>
      </span>
      <span className="resolves__arrow" aria-hidden="true">
        →
      </span>
      <span className="resolves__address">0x7a3F…91c2</span>
      <span className="visually-hidden"> on {chain}</span>
    </p>
  );
}

export function BothChains() {
  return (
    <section className="section" id="chains" aria-labelledby="chains-title">
      <div className="container">
        <SectionHeading kicker="PulseChain and Ethereum" title={<span id="chains-title">One name, covered on both chains</span>}>
          Live on PulseChain, still on Ethereum, or somewhere in between? Your .hex name works on both, so you&rsquo;re
          covered wherever you end up. {PRICE} a year covers both chains.
        </SectionHeading>
        <div className="chains">
          <article className="card chain chain--pulsechain">
            <p className="chain__badge">Where your name lives</p>
            <h3>PulseChain</h3>
            <p>Buy, renew, sell and manage your name here. Changes show up straight away.</p>
            <Resolves chain="PulseChain" />
          </article>
          <div className="chains__link" aria-hidden="true">
            <ArrowIcon />
            <span>Copied automatically</span>
          </div>
          <article className="card chain chain--ethereum">
            <p className="chain__badge">Copied automatically</p>
            <h3>Ethereum</h3>
            <p>Every name is copied here about 15 minutes after a change, so Ethereum wallets and apps find it too.</p>
            <Resolves chain="Ethereum" />
          </article>
        </div>
        <ul className="ticks ticks--grid">
          <li>
            <CheckIcon size={18} /> Buy from either chain, with whatever you hold there
          </li>
          <li>
            <CheckIcon size={18} /> Points to your wallet on both chains
          </li>
          <li>
            <CheckIcon size={18} /> Renew once and both chains stay yours
          </li>
          <li>
            <CheckIcon size={18} /> Chain agnostic? You&rsquo;re covered either way, just in case
          </li>
        </ul>
      </div>
    </section>
  );
}

export function SendToNames() {
  return (
    <section className="section section--tint" aria-labelledby="send-title">
      <div className="container split">
        <div>
          <p className="kicker">Why a name</p>
          <h2 id="send-title">Send to names, not numbers</h2>
          <p className="section__intro">
            No more copying 42-character addresses and checking them three times. Send PLS, HEX, ETH and every other
            token to <b>yourname.hex</b> and it lands in your wallet.
          </p>
          <ul className="ticks">
            <li>
              <CheckIcon size={18} /> Easy to say, easy to share, hard to get wrong
            </li>
            <li>
              <CheckIcon size={18} /> Points to your wallet the moment you buy it
            </li>
            <li>
              <CheckIcon size={18} /> Sell your name and it points to the new owner instead
            </li>
          </ul>
        </div>
        <div className="send-card" aria-hidden="true">
          <div className="send-card__top">
            <span>Send</span>
            <span className="token">
              <span className="token__dot" />
              HEX
            </span>
          </div>
          <p className="send-card__amount">10,000</p>
          <div className="send-card__field">
            <span className="send-card__label">To</span>
            <span className="send-card__to">
              you<span className="pill__tld">.hex</span>
            </span>
          </div>
          <p className="send-card__resolved">
            <CheckIcon size={16} /> 0x7a3F…91c2
          </p>
          <span className="send-card__button">Send</span>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: <ChainsIcon />,
    title: "One price, both chains",
    text: `${PRICE} a year covers your name on PulseChain and Ethereum. No paying twice, no keeping two names in step.`,
  },
  {
    icon: <CoinsIcon />,
    title: "Pay with your bag",
    text: `PLS, HEX, PLSX, ETH, USDC or any token with a pool. It's swapped at checkout, so the price stays ${PRICE} a year.`,
  },
  {
    icon: <ShieldIcon />,
    title: "Nobody can take it",
    text: "Not us, not anyone. Your name is yours for as long as you renew it, and only you can move or sell it.",
  },
  {
    icon: <CodeIcon />,
    title: "Built on ENS v2",
    text: "Made from the open-source code of the next version of ENS, so wallets and apps can add .hex with lookups they already use.",
  },
];

export function Features() {
  return (
    <section className="section" aria-labelledby="features-title">
      <div className="container">
        <SectionHeading kicker="What you get" title={<span id="features-title">A name that works for Hexicans</span>} />
        <div className="features">
          {FEATURES.map((feature) => (
            <article className="card feature" key={feature.title}>
              <span className="feature__icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Search", text: `Find a name you like. Names of 5 characters or more are ${PRICE} a year, for both chains.` },
  { title: "Buy it in one go", text: "Pay from PulseChain or Ethereum with whatever you hold. No bridging, no swapping first." },
  { title: "Use it everywhere", text: "Share yourname.hex instead of your address. It points to your wallet on both chains." },
];

export function HowItWorks() {
  return (
    <section className="section section--tint" id="how" aria-labelledby="how-title">
      <div className="container">
        <SectionHeading kicker="How it works" title={<span id="how-title">Three steps to your name</span>} />
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li className="card step" key={step.title}>
              <span className="step__number">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section className="section" id="pricing" aria-labelledby="pricing-title">
      <div className="container pricing">
        <div>
          <p className="kicker">Pricing</p>
          <h2 id="pricing-title">One price for both chains</h2>
          <p className="section__intro">
            One name on PulseChain and Ethereum, for one yearly price, whatever you pay with.
          </p>
        </div>
        <div className="card price-card">
          <p className="price">
            <span className="grad-text">{PRICE}</span>
            <span className="price__unit">a year</span>
          </p>
          <p className="price__for">for names of 5 characters or more, on both chains</p>
          <ul className="ticks">
            <li>
              <CheckIcon size={18} /> Covers PulseChain and Ethereum: no paying twice
            </li>
            <li>
              <CheckIcon size={18} /> Pay in PLS, HEX or any token, from either chain
            </li>
            <li>
              <CheckIcon size={18} /> Names of 3 or 4 characters are premium, priced at launch
            </li>
            <li>
              <CheckIcon size={18} /> 28 days&rsquo; grace to renew if you forget
            </li>
            <li>
              <CheckIcon size={18} /> Names of 1 or 2 characters aren&rsquo;t for sale
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "What is a .hex name?",
    a: "A short, readable name like alice.hex that points to your wallet. People send to the name instead of copying your 0x… address.",
  },
  {
    q: "Which chains does it work on?",
    a: "PulseChain and Ethereum, for one price. Your name lives on PulseChain, where it's bought and managed, and is copied to Ethereum automatically, about 15 minutes after a purchase or a sale. If you use both chains, or might one day, you're covered either way.",
  },
  {
    q: `Why ${PRICE} a year?`,
    a: "It covers your name on both chains: on PulseChain, where it lives, and its copy on Ethereum, which costs gas to keep up to date.",
  },
  {
    q: "Which wallets will support it?",
    a: "We're bringing .hex to wallets, starting with a MetaMask Snap, then a library any wallet, explorer or app can use. Until yours supports .hex, keep using your 0x… address as normal.",
  },
  {
    q: "What can I pay with?",
    a: "On PulseChain: PLS, HEX, PLSX or any token with a PulseX pool. On Ethereum: ETH, USDC or any token with a Uniswap pool. It's swapped into a dollar stablecoin at checkout, so the price stays in dollars.",
  },
  {
    q: "What happens if I forget to renew?",
    a: "You get 28 days to renew. After that the name is released, and for 21 days its price starts very high and halves every day, so nobody can grab it the moment it lapses.",
  },
  {
    q: "Can anyone take my name?",
    a: "No. Nobody can take, move or redirect a name someone owns, including the HexNS team.",
  },
  {
    q: "Is alice.hex the same as alice.hex.eth?",
    a: "No. .hex names never end in .eth. alice.hex.eth is a different name that HexNS doesn't control, so always type a .hex name exactly as name.hex.",
  },
  {
    q: "Is it safe?",
    a: "HexNS is built on the code of ENS v2, which has been audited. HexNS's own contracts will be independently reviewed before launch.",
  },
  {
    q: "Is HexNS part of HEX or PulseChain?",
    a: "No. HexNS is an independent community project for Hexicans. It isn't run by, or affiliated with, HEX, PulseChain or ENS.",
  },
];

export function Faq() {
  return (
    <section className="section section--tint" id="faq" aria-labelledby="faq-title">
      <div className="container faq">
        <SectionHeading kicker="FAQ" title={<span id="faq-title">Questions, answered</span>} />
        <div className="faq__list">
          {FAQS.map((item) => (
            <details className="faq__item" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="section section--tight" aria-labelledby="cta-title">
      <div className="container">
        <div className="cta">
          <h2 id="cta-title">{LAUNCHED ? "Get your name today" : "Hexicans, get ready to claim your name"}</h2>
          <p>
            {LAUNCHED
              ? "Search for it, pay with whatever you hold, and it's yours on both chains."
              : "HexNS is launching soon. Follow the build on GitHub, and search above to see if your name is free."}
          </p>
          <div className="cta__actions">
            <a className="button button--primary" href="#top">
              Search for a name
            </a>
            <a className="button button--ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GitHubIcon /> Follow on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
