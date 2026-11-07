import { useState } from "react";
import { type Address, isAddress } from "viem";

import { formatUsd } from "../lib/quotes";
import { captureReferral, referralLink } from "../lib/referral";
import { priceFor } from "../lib/names";
import { renew, send, type Step } from "./flows";
import { PAY } from "./network";
import { referralTag } from "./order";
import { Steps } from "./Steps";

const yearsText = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

/** Copies text, and says so for a moment. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button button--ghost button--small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard blocked: the text is on the page to copy by hand.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/** Renew a name for more years. Anyone may; it stays its owner's. */
export function RenewPanel({ label, length, onChanged }: { label: string; length: number; onChanged?: () => void }) {
  const [years, setYears] = useState(1);
  const tokens = PAY.pulsechain.tokens;
  const [symbol, setSymbol] = useState(tokens[0].symbol);
  const token = tokens.find((t) => t.symbol === symbol) ?? tokens[0];
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const price = priceFor(length, years);

  return (
    <section className="card manage" aria-labelledby="renew-title">
      <h2 id="renew-title" className="manage__title">
        Renew
      </h2>
      <div className="manage__row">
        <div className="stepper" role="group" aria-label="How long to renew for">
          <button
            type="button"
            onClick={() => setYears(Math.max(1, years - 1))}
            disabled={years <= 1 || busy}
            aria-label="One year less"
          >
            −
          </button>
          <output>{yearsText(years)}</output>
          <button
            type="button"
            onClick={() => setYears(Math.min(10, years + 1))}
            disabled={years >= 10 || busy}
            aria-label="One year more"
          >
            +
          </button>
        </div>
        <div className="chips" role="radiogroup" aria-label="Pay with">
          {tokens.map((t) => (
            <button
              key={t.symbol}
              type="button"
              role="radio"
              aria-checked={t.symbol === token.symbol}
              disabled={busy}
              onClick={() => setSymbol(t.symbol)}
            >
              {t.label ?? t.symbol}
            </button>
          ))}
        </div>
      </div>
      {steps ? <Steps steps={steps} /> : null}
      <button
        type="button"
        className="button button--primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await renew({ label, years, token, referrer: referralTag(captureReferral(), label), report: setSteps });
            onChanged?.();
          } catch {
            // Shown in the steps.
          }
          setBusy(false);
        }}
      >
        Renew for {yearsText(years)}, {formatUsd(Math.round(price.total * 100) / 100)}
      </button>
    </section>
  );
}

/** For the owner: send the name to another wallet, and their referral link. */
export function OwnerPanel({ label, onChanged }: { label: string; onChanged?: () => void }) {
  const [to, setTo] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = isAddress(to.trim());
  const link = referralLink(label);

  return (
    <>
      <section className="card manage" aria-labelledby="referral-title">
        <h2 id="referral-title" className="manage__title">
          Your referral link
        </h2>
        <p className="manage__text">Share it. When someone buys a name through it, you earn 10% of what they pay.</p>
        <div className="manage__row">
          <code className="manage__link">{link}</code>
          <CopyButton text={link} />
        </div>
      </section>

      <section className="card manage" aria-labelledby="send-title">
        <h2 id="send-title" className="manage__title">
          Send it to another wallet
        </h2>
        <p className="manage__text">
          It moves for good: only the new owner can send it back. Its Ethereum copy follows by itself, about 15 minutes
          later.
        </p>
        <div className="manage__row">
          <input
            className="manage__input"
            type="text"
            placeholder="0x… wallet address"
            spellCheck={false}
            autoComplete="off"
            value={to}
            disabled={busy}
            onChange={(event) => setTo(event.target.value)}
          />
          <button
            type="button"
            className="button button--primary button--small"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await send({ label, to: to.trim() as Address, report: setSteps });
                onChanged?.();
              } catch {
                // Shown in the steps.
              }
              setBusy(false);
            }}
          >
            Send
          </button>
        </div>
        {steps ? <Steps steps={steps} /> : null}
      </section>
    </>
  );
}
