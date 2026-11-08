import { useState } from "react";
import { type Address, isAddress } from "viem";

import { formatUsd } from "../lib/quotes";
import { captureReferral, launchOffer, referralLink, referralOfferText } from "../lib/referral";
import { MAX_YEARS, priceFor } from "../lib/names";
import { renew, send, type Step } from "./flows";
import { deployment, PAY } from "./network";
import { referralTag } from "./order";
import { Steps } from "./Steps";

const yearsText = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;
const YEAR = 365 * 86_400;
const dayText = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * How many whole years a name expiring at `expiry` can be renewed for now: a name can be paid for
 * at most 5 years ahead (HexNameRules), so a name with 4½ years left can't add a whole year yet.
 */
export function renewableYears(expiry: number, now = Math.floor(Date.now() / 1000)): number {
  return Math.max(0, Math.min(MAX_YEARS, Math.floor((now + MAX_YEARS * YEAR - expiry) / YEAR)));
}

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

/** Renew a name for more years, up to 5 years ahead. Anyone may; it stays its owner's. */
export function RenewPanel({
  label,
  length,
  expiry,
  mine = false,
  onChanged,
}: {
  label: string;
  length: number;
  /** When the name expires now, in unix seconds. */
  expiry: number;
  /** Whether the connected wallet owns it: anyone else renewing is told it stays the owner's. */
  mine?: boolean;
  onChanged?: () => void;
}) {
  const most = renewableYears(expiry);
  const [chosen, setYears] = useState(1);
  const years = Math.max(1, Math.min(chosen, most));
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
            onClick={() => setYears(Math.min(most, years + 1))}
            disabled={years >= most || busy}
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
      {!mine ? (
        <p className="manage__note">
          Anyone can renew a name, but it stays its owner&rsquo;s: this adds time for them, it doesn&rsquo;t buy it.
        </p>
      ) : null}
      {most === 0 ? (
        <p className="manage__note">
          It&rsquo;s paid up more than {MAX_YEARS - 1} years ahead, and a name can be paid for at most {MAX_YEARS}{" "}
          years ahead. It can be renewed again from {dayText(expiry - (MAX_YEARS - 1) * YEAR)}.
        </p>
      ) : null}
      {steps ? <Steps steps={steps} /> : null}
      <button
        type="button"
        className="button button--primary"
        disabled={busy || most === 0}
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
export function OwnerPanel({
  label,
  canSend = true,
  onChanged,
}: {
  label: string;
  /** False while the name is in its grace period: the registry won't move an expired name. */
  canSend?: boolean;
  onChanged?: () => void;
}) {
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
        <p className="manage__text">{referralOfferText(launchOffer(deployment?.launchDate))}</p>
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
          {canSend
            ? "It moves for good: only the new owner can send it back. Its Ethereum copy follows by itself, about 15 minutes later."
            : "Renew it first: an expired name can't be sent."}
        </p>
        {canSend ? (
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
        ) : null}
        {steps ? <Steps steps={steps} /> : null}
      </section>
    </>
  );
}
