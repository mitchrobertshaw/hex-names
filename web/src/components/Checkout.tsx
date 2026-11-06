import { useEffect, useRef, useState } from "react";

import { priceFor } from "../lib/names";
import { formatToken, formatUsd, quoteIn } from "../lib/quotes";
import { type ChainKey, PAY_CHAINS } from "../lib/tokens";
import { LAUNCHED } from "../site";

type Quote = { status: "loading" } | { status: "ok"; text: string } | { status: "error" };

const STEPS: Record<ChainKey, { title: string; text: string }[]> = {
  pulsechain: [
    { title: "Reserve it", text: "Your wallet sends a sealed claim on the name, so nobody watching can see which name it is." },
    { title: "Wait a minute", text: "A short pause that stops anyone copying your purchase." },
    { title: "Pay", text: "In one transaction it's swapped, paid for and yours: on PulseChain straight away, on Ethereum about 15 minutes later." },
  ],
  ethereum: [
    { title: "Place your order", text: "One transaction. The name stays sealed until it's registered, so nobody can grab it first." },
    { title: "We register it", text: "Within about two minutes, on PulseChain, straight to your wallet." },
    { title: "It's yours", text: "On both chains. If it can't be registered, your money comes back automatically." },
  ],
};

const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

/** The checkout: how long, which chain, which token, and exactly what it costs. */
export function Checkout({ name, length, onClose }: { name: string; length: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [duration, setDuration] = useState(1);
  const [chainKey, setChainKey] = useState<ChainKey>("pulsechain");
  const chain = PAY_CHAINS[chainKey];
  const [symbol, setSymbol] = useState(chain.tokens[0].symbol);
  const token = chain.tokens.find((t) => t.symbol === symbol) ?? chain.tokens[0];
  const price = priceFor(length, duration);
  const subtotal = Math.round(price.total * 100) / 100; // to the cent, so the rows add up to the total
  const total = subtotal + chain.fee;
  const [quote, setQuote] = useState<Quote>({ status: "loading" });

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  useEffect(() => {
    const usdc = BigInt(Math.ceil(total * 1e6));
    if (!token.path) {
      setQuote({ status: "ok", text: `= ${formatToken(usdc, 6)} USDC` });
      return;
    }
    const controller = new AbortController();
    setQuote({ status: "loading" });
    const timer = setTimeout(() => {
      quoteIn(chain, token, usdc, controller.signal)
        .then((amount) =>
          setQuote({ status: "ok", text: `≈ ${formatToken(amount, token.decimals)} ${token.symbol} on ${chain.dex} right now` }),
        )
        .catch(() => {
          if (!controller.signal.aborted) setQuote({ status: "error" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chain, token, total]);

  function chooseChain(key: ChainKey) {
    setChainKey(key);
    setSymbol(PAY_CHAINS[key].tokens[0].symbol);
  }

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className="checkout"
      aria-labelledby="checkout-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) close(); // a click on the backdrop
      }}
    >
      <div className="checkout__panel">
        <header className="checkout__head">
          <div>
            <p className="kicker">{LAUNCHED ? "Register" : "Checkout preview"}</p>
            <h2 id="checkout-title">{name}</h2>
            <p className="checkout__sub">
              {length < 5 ? `Premium name, ${length} characters` : LAUNCHED ? "Available" : "Available at launch"} · works on
              PulseChain and Ethereum
            </p>
          </div>
          <button type="button" className="checkout__close" onClick={close} aria-label="Close">
            ×
          </button>
        </header>

        <div className="checkout__field">
          <span className="checkout__label" id="checkout-years">
            How long
          </span>
          <div className="stepper" role="group" aria-labelledby="checkout-years">
            <button
              type="button"
              onClick={() => setDuration(Math.max(1, duration - 1))}
              disabled={duration <= 1}
              aria-label="One year less"
            >
              −
            </button>
            <output aria-live="polite">{years(duration)}</output>
            <button
              type="button"
              onClick={() => setDuration(Math.min(10, duration + 1))}
              disabled={duration >= 10}
              aria-label="One year more"
            >
              +
            </button>
          </div>
          <p className="checkout__hint">Save 12.5% from 2 years, 31.25% from 3 and 43.75% from 6.</p>
        </div>

        <div className="checkout__field">
          <span className="checkout__label" id="checkout-chain">
            Pay from
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="checkout-chain">
            {(Object.keys(PAY_CHAINS) as ChainKey[]).map((key) => (
              <button key={key} type="button" role="radio" aria-checked={key === chainKey} onClick={() => chooseChain(key)}>
                {PAY_CHAINS[key].name}
              </button>
            ))}
          </div>
        </div>

        <div className="checkout__field">
          <span className="checkout__label" id="checkout-token">
            Pay with
          </span>
          <div className="chips" role="radiogroup" aria-labelledby="checkout-token">
            {chain.tokens.map((t) => (
              <button
                key={t.symbol}
                type="button"
                role="radio"
                aria-checked={t.symbol === token.symbol}
                onClick={() => setSymbol(t.symbol)}
              >
                {t.symbol}
              </button>
            ))}
          </div>
          <p className="checkout__hint">Or any token with a {chain.dex} pool.</p>
        </div>

        <dl className="breakdown">
          <div>
            <dt>
              {name}, {years(duration)}
            </dt>
            <dd>{formatUsd(price.full)}</dd>
          </div>
          {price.discount > 0 ? (
            <div className="breakdown__saving">
              <dt>Multi-year discount ({Math.round(price.discount * 10000) / 100}%)</dt>
              <dd>−{formatUsd(price.full - subtotal)}</dd>
            </div>
          ) : null}
          {chain.fee > 0 ? (
            <div>
              <dt>Order fee, for registering it on PulseChain for you</dt>
              <dd>{formatUsd(chain.fee)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Network fee</dt>
            <dd className="breakdown__note">{chain.network}</dd>
          </div>
          <div className="breakdown__total">
            <dt>Total</dt>
            <dd>
              {formatUsd(total)}
              <span className="breakdown__quote" aria-live="polite">
                {quote.status === "ok"
                  ? quote.text
                  : quote.status === "loading"
                    ? "Getting the live price…"
                    : "Live price unavailable; your wallet shows the exact amount"}
              </span>
            </dd>
          </div>
        </dl>
        {token.path ? (
          <p className="checkout__hint">
            Your wallet sends about 2% extra in case the price moves. Whatever isn&rsquo;t needed comes straight back.
          </p>
        ) : null}

        <ol className="checkout__steps">
          {STEPS[chainKey].map((step) => (
            <li key={step.title}>
              <b>{step.title}.</b> {step.text}
            </li>
          ))}
        </ol>

        <button type="button" className="button button--primary checkout__cta" disabled={!LAUNCHED}>
          {LAUNCHED ? "Connect wallet" : "Connect wallet · opens at launch"}
        </button>
      </div>
    </dialog>
  );
}
