import { useEffect, useState } from "react";

import { CheckIcon } from "../components/icons";
import { formatToken, formatUsd, quoteIn } from "../lib/quotes";
import { captureReferral, referralLink } from "../lib/referral";
import type { ChainKey, PayToken } from "../lib/tokens";
import { buyFromEthereum, buyOnPulseChain, type Step } from "./flows";
import type { NameInfo } from "./lookup";
import { priceOf } from "./lookup";
import { deployment, PAY } from "./network";
import { referralTag } from "./order";
import { linkProps } from "./router";
import { Steps } from "./Steps";
import { WalletChoices } from "./WalletButton";
import { useWallet } from "./wallet";

type Quote = { status: "loading" } | { status: "ok"; text: string } | { status: "error" };
const yearsText = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

/** The live price of `dollars` in `token` on `chain`, refreshed as the choices change. */
function useQuote(chainKey: ChainKey, token: PayToken, dollars: number): Quote {
  const [quote, setQuote] = useState<Quote>({ status: "loading" });
  useEffect(() => {
    const chain = PAY[chainKey];
    const usdc = BigInt(Math.ceil(dollars * 1e6));
    if (!token.path) {
      setQuote({ status: "ok", text: `= ${formatToken(usdc, 6)} ${token.label ?? token.symbol}` });
      return;
    }
    const controller = new AbortController();
    setQuote({ status: "loading" });
    const timer = setTimeout(() => {
      quoteIn(chain, token, usdc, controller.signal)
        .then((amount) =>
          setQuote({
            status: "ok",
            text: `≈ ${formatToken(amount, token.decimals)} ${token.symbol} on ${chain.dex} right now`,
          }),
        )
        .catch(() => !controller.signal.aborted && setQuote({ status: "error" }));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chainKey, token, dollars]);
  return quote;
}

/** Before the contracts are deployed: the steps of a purchase, played through without sending anything. */
async function walkthrough(chainKey: ChainKey, token: PayToken, report: (steps: Step[]) => void) {
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const titles: [string, string][] =
    chainKey === "pulsechain"
      ? [
          ["chain", `Switch to ${PAY.pulsechain.name}`],
          ["commit", "Reserve the name"],
          ...(token.native ? [] : ([["approve", `Allow ${token.label ?? token.symbol}`]] as [string, string][])),
          ["wait", "Wait a minute"],
          ["pay", "Pay and register"],
        ]
      : [
          ["chain", `Switch to ${PAY.ethereum.name}`],
          ...(token.native ? [] : ([["approve", `Allow ${token.symbol}`]] as [string, string][])),
          ["order", "Place the order"],
          ["fill", "Registered on PulseChain"],
        ];
  let steps: Step[] = titles.map(([key, title]) => ({ key, title, status: "todo" }));
  const set = (key: string, patch: Partial<Step>) => {
    steps = steps.map((s) => (s.key === key ? { ...s, ...patch } : s));
    report(steps);
  };
  report(steps);
  for (const [key] of titles) {
    const wait = key === "wait" ? 6000 : key === "fill" ? 4000 : 1300;
    set(key, {
      status: "active",
      until: key === "wait" ? Date.now() + wait : undefined,
      detail:
        key === "wait"
          ? "A minute on the live site."
          : key === "fill"
            ? "Within about a minute and a half on the live site."
            : undefined,
    });
    await pause(wait);
    set(key, { status: "done", detail: undefined });
  }
}

/** Choose how long and how to pay, see exactly what it costs, and buy. */
export function BuyPanel({ info }: { info: Extract<NameInfo, { kind: "available" }> }) {
  const wallet = useWallet();
  const name = `${info.label}.hex`;
  const [years, setYears] = useState(1);
  const [chainKey, setChainKey] = useState<ChainKey>("pulsechain");
  const chain = PAY[chainKey];
  const [symbol, setSymbol] = useState(chain.tokens[0].symbol);
  const token = chain.tokens.find((t) => t.symbol === symbol) ?? chain.tokens[0];
  const price = priceOf(info, years);
  const subtotal = Math.round(price.total * 100) / 100;
  const fee = chainKey === "ethereum" ? (deployment?.bot.minFee ?? chain.fee) : 0;
  const total = subtotal + fee;
  const quote = useQuote(chainKey, token, total);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [phase, setPhase] = useState<"choose" | "buying" | "done" | "failed">("choose");

  function chooseChain(key: ChainKey) {
    setChainKey(key);
    setSymbol(PAY[key].tokens[0].symbol);
  }

  async function buy() {
    setPhase("buying");
    const referrer = referralTag(captureReferral(), info.label);
    try {
      if (!deployment) await walkthrough(chainKey, token, setSteps);
      else if (chainKey === "pulsechain")
        await buyOnPulseChain({ label: info.label, years, token, referrer, report: setSteps });
      else await buyFromEthereum({ label: info.label, years, token, referrer, report: setSteps });
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  }

  const choosing = phase === "choose";
  return (
    <section className="card buy" aria-labelledby="buy-title">
      <h2 id="buy-title" className="buy__title">
        Register {name}
      </h2>

      <fieldset className="buy__choices" disabled={!choosing}>
        <div className="checkout__field">
          <span className="checkout__label" id="buy-years">
            How long
          </span>
          <div className="stepper" role="group" aria-labelledby="buy-years">
            <button
              type="button"
              onClick={() => setYears(Math.max(1, years - 1))}
              disabled={years <= 1}
              aria-label="One year less"
            >
              −
            </button>
            <output aria-live="polite">{yearsText(years)}</output>
            <button
              type="button"
              onClick={() => setYears(Math.min(10, years + 1))}
              disabled={years >= 10}
              aria-label="One year more"
            >
              +
            </button>
          </div>
          <p className="checkout__hint">Save 12.5% from 2 years, 31.25% from 3 and 43.75% from 6.</p>
        </div>

        <div className="checkout__field">
          <span className="checkout__label" id="buy-chain">
            Pay from
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="buy-chain">
            {(Object.keys(PAY) as ChainKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === chainKey}
                onClick={() => chooseChain(key)}
              >
                {PAY[key].name}
              </button>
            ))}
          </div>
        </div>

        <div className="checkout__field">
          <span className="checkout__label" id="buy-token">
            Pay with
          </span>
          <div className="chips" role="radiogroup" aria-labelledby="buy-token">
            {chain.tokens.map((t) => (
              <button
                key={t.symbol}
                type="button"
                role="radio"
                aria-checked={t.symbol === token.symbol}
                onClick={() => setSymbol(t.symbol)}
              >
                {t.label ?? t.symbol}
              </button>
            ))}
          </div>
          <p className="checkout__hint">{token.note ?? `Or any token with a ${chain.dex} pool.`}</p>
        </div>
      </fieldset>

      <dl className="breakdown">
        <div>
          <dt>
            {name}, {yearsText(years)}
          </dt>
          <dd>{formatUsd(price.full)}</dd>
        </div>
        {price.discount > 0 ? (
          <div className="breakdown__saving">
            <dt>Multi-year discount ({Math.round(price.discount * 10000) / 100}%)</dt>
            <dd>−{formatUsd(price.full - (price.total - info.premium))}</dd>
          </div>
        ) : null}
        {info.premium > 0 ? (
          <div>
            <dt>Recently expired: a premium that halves every day</dt>
            <dd>{formatUsd(info.premium)}</dd>
          </div>
        ) : null}
        {fee > 0 ? (
          <div>
            <dt>Order fee, for registering it on PulseChain for you</dt>
            <dd>{formatUsd(fee)}</dd>
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

      {steps ? <Steps steps={steps} /> : null}

      {phase === "done" ? (
        <div className="buy__done">
          <span className="buy__done-icon">
            <CheckIcon size={20} />
          </span>
          <div>
            <p className="buy__done-title">{deployment ? `${name} is yours.` : "That's the whole purchase."}</p>
            <p>
              {deployment
                ? chainKey === "pulsechain"
                  ? "It works on PulseChain now, and on Ethereum in about 15 minutes."
                  : "It's yours on PulseChain, and on Ethereum in about 15 minutes."
                : "On the live site each step is a real transaction, confirmed in your wallet."}
            </p>
            {deployment ? (
              <p className="buy__share">
                Your referral link: <code>{referralLink(info.label)}</code>
              </p>
            ) : null}
            <div className="buy__actions">
              {deployment ? (
                <a className="button button--primary button--small" {...linkProps({ page: "names" })}>
                  See my names
                </a>
              ) : (
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => {
                    setSteps(null);
                    setPhase("choose");
                  }}
                >
                  Start again
                </button>
              )}
            </div>
          </div>
        </div>
      ) : phase === "failed" ? (
        <button
          type="button"
          className="button button--primary buy__cta"
          onClick={() => {
            setSteps(null);
            setPhase("choose");
          }}
        >
          Try again
        </button>
      ) : !deployment ? (
        <button type="button" className="button button--primary buy__cta" disabled={!choosing} onClick={buy}>
          {choosing ? "Walk through buying it" : "Walking through…"}
        </button>
      ) : !wallet.connected ? (
        <div className="buy__connect">
          <p className="checkout__label">Connect a wallet to buy it</p>
          <WalletChoices />
        </div>
      ) : (
        <button type="button" className="button button--primary buy__cta" disabled={!choosing} onClick={buy}>
          {choosing ? `Buy ${name} for ${formatUsd(total)}` : "Follow the steps in your wallet…"}
        </button>
      )}
      {!deployment && choosing ? (
        <p className="checkout__hint buy__preview-note">A walkthrough: nothing is sent, and no wallet is needed.</p>
      ) : null}
    </section>
  );
}
