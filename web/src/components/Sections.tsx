import type { ReactNode } from "react";

import { GITHUB_URL, LAUNCHED } from "../site";
import { ChainsIcon, CheckIcon, CodeIcon, CoinsIcon, CrossIcon, GitHubIcon, ShieldIcon } from "./icons";

function SectionHeading({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="section__heading">
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {children ? <p className="section__intro">{children}</p> : null}
    </div>
  );
}

export function SendToNames() {
  return (
    <section className="section" aria-labelledby="send-title">
      <div className="container split">
        <div>
          <p className="kicker">Why a name</p>
          <h2 id="send-title">Send to names, not numbers</h2>
          <p className="section__intro">
            No more copying 42-character addresses and checking them three times. Send PLS, HEX and every other
            token to <b>yourname.hex</b> and it lands in your wallet, on PulseChain and on Ethereum.
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
            <CheckIcon size={16} /> 0x7a3F…91c2 on PulseChain
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
    title: "One name, both chains",
    text: "Your name lives on PulseChain and is copied to Ethereum automatically. Renew once on PulseChain and both stay yours.",
  },
  {
    icon: <CoinsIcon />,
    title: "Pay with your bag",
    text: "PLS, HEX, PLSX, ETH, USDC or any token with a pool. It's swapped at checkout, so the price stays $5 a year.",
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
    <section className="section section--tint" aria-labelledby="features-title">
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
  { title: "Search", text: "Find a name you like. Names of 5 characters or more are $5 a year." },
  { title: "Buy it in one go", text: "Pay from PulseChain or Ethereum with whatever you hold. No bridging, no swapping first." },
  { title: "Use it everywhere", text: "Share yourname.hex instead of your address. It points to your wallet on both chains." },
];

export function HowItWorks() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
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

export function EthWarning() {
  return (
    <section className="section section--tight" aria-labelledby="eth-title">
      <div className="container">
        <div className="card warning">
          <div>
            <p className="kicker kicker--warn">Read this once</p>
            <h2 id="eth-title">A .hex name never ends in .eth</h2>
            <p>
              <b>alice.hex</b> and <b>alice.hex.eth</b> are different names. HexNS doesn&rsquo;t control hex.eth, so
              whoever owns it decides where alice.hex.eth points. When you send to someone&rsquo;s .hex name, type it
              exactly as <b>name.hex</b>.
            </p>
          </div>
          <ul className="compare">
            <li className="compare__row compare__row--ok">
              <span className="compare__icon">
                <CheckIcon size={18} />
              </span>
              <span className="compare__name">alice.hex</span>
              <span className="compare__note">Alice&rsquo;s wallet</span>
            </li>
            <li className="compare__row compare__row--bad">
              <span className="compare__icon">
                <CrossIcon size={18} />
              </span>
              <span className="compare__name">alice.hex.eth</span>
              <span className="compare__note">Not HexNS. Someone else decides</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section className="section section--tint" id="pricing" aria-labelledby="pricing-title">
      <div className="container pricing">
        <div>
          <p className="kicker">Pricing</p>
          <h2 id="pricing-title">One simple price</h2>
          <p className="section__intro">The same price on both chains, whatever you pay with.</p>
        </div>
        <div className="card price-card">
          <p className="price">
            <span className="grad-text">$5</span>
            <span className="price__unit">a year</span>
          </p>
          <p className="price__for">for names of 5 characters or more</p>
          <ul className="ticks">
            <li>
              <CheckIcon size={18} /> Pay in PLS, HEX or any token, from PulseChain or Ethereum
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
    a: "PulseChain, where names live and are bought, and Ethereum, where every name is copied automatically. The Ethereum copy catches up about 15 minutes after a purchase or a sale.",
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
    <section className="section" id="faq" aria-labelledby="faq-title">
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
              ? "Search for it, pay with whatever you hold, and it's yours."
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
