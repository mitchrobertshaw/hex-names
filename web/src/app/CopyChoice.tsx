// The Ethereum copy fee on the page (copy.ts): the choice when buying or renewing while Ethereum is
// busy, the token to pay it with, and a name's copy on Ethereum with a way to copy it at once.

import { useState } from "react";
import type { Address } from "viem";

import type { PayToken } from "../lib/tokens";
import { type CopyFee, feeText, useCopyFee, useEthereumCopy } from "./copy";
import { copyNow, type Step } from "./flows";
import { PAY } from "./network";
import { Steps } from "./Steps";
import { useWallet } from "./wallet";

/**
 * While Ethereum is busy, the choice of when to copy a name there: free once its fees fall, or now
 * for the copy fee. Nothing to choose otherwise.
 */
export function CopyChoice({
  copy,
  now,
  onChange,
  disabled,
  what,
}: {
  copy: CopyFee | null;
  now: boolean;
  onChange: (now: boolean) => void;
  disabled?: boolean;
  /** What's copied: "your name", or "the new date". */
  what: string;
}) {
  if (copy?.kind === "busy") {
    return (
      <p className="checkout__hint copy-choice__busy" role="status">
        Ethereum is very busy right now, so {what} is copied there once its fees fall. It works on PulseChain straight
        away.
      </p>
    );
  }
  if (copy?.kind !== "offered") return null;
  return (
    <div className="checkout__field">
      <span className="checkout__label" id="copy-when">
        Copy to Ethereum
      </span>
      <div className="copy-choice" role="radiogroup" aria-labelledby="copy-when">
        <button type="button" role="radio" aria-checked={!now} disabled={disabled} onClick={() => onChange(false)}>
          <b>Later, free</b>
          <span>once Ethereum&rsquo;s fees fall</span>
        </button>
        <button type="button" role="radio" aria-checked={now} disabled={disabled} onClick={() => onChange(true)}>
          <b>Now, +{feeText(copy.fee)}</b>
          <span>in about 15 minutes</span>
        </button>
      </div>
      <p className="checkout__hint">
        Ethereum is busy, so copying there costs more than usual. It works on PulseChain straight away either way.
      </p>
    </div>
  );
}

/** What the copy fee can be paid with on its own: PLS, which every wallet here has for gas, or USDC. */
export const FEE_TOKENS: PayToken[] = PAY.pulsechain.tokens.filter((t) => t.native || !t.path);

/** Choose the token to pay the copy fee with. */
export function FeeTokens({
  token,
  onChange,
  disabled,
}: {
  token: PayToken;
  onChange: (token: PayToken) => void;
  disabled?: boolean;
}) {
  return (
    <div className="chips chips--small" role="radiogroup" aria-label="Pay the copy fee with">
      {FEE_TOKENS.map((t) => (
        <button
          key={t.symbol}
          type="button"
          role="radio"
          aria-checked={t.symbol === token.symbol}
          disabled={disabled}
          onClick={() => onChange(t)}
        >
          {t.label ?? t.symbol}
        </button>
      ))}
    </div>
  );
}

/**
 * A name's copy on Ethereum, for its page: up to date, or on its way. While Ethereum is busy and a
 * copy is behind, anyone connected can pay the copy fee to have it copied at once.
 */
export function EthereumCopyRow({
  label,
  owner,
  expiry,
  version,
  onChanged,
}: {
  label: string;
  owner: Address;
  expiry: number;
  version: number;
  onChanged?: () => void;
}) {
  const copy = useEthereumCopy(label, owner, expiry, version);
  const fee = useCopyFee();
  const wallet = useWallet();
  const [token, setToken] = useState(FEE_TOKENS[0]);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  if (copy === null || copy === "unknown") return null;

  const text =
    copy === "same"
      ? "Up to date"
      : paid
        ? "Paid for: copied in about 15 minutes"
        : fee?.kind === "offered"
          ? "Not yet: Ethereum is busy, so it's copied once its fees fall"
          : fee?.kind === "busy"
            ? "Not yet: Ethereum is very busy, so it's copied once its fees fall"
            : "On its way: usually within half an hour";
  const offer = copy === "behind" && !paid && fee?.kind === "offered" && wallet.connected ? fee.fee : null;
  return (
    <div className={offer !== null || steps ? "details__wide" : undefined}>
      <dt>On Ethereum</dt>
      <dd>
        {text}
        {offer !== null || steps ? (
          <div className="copy-now">
            {offer !== null ? (
              <div className="copy-now__row">
                <FeeTokens token={token} onChange={setToken} disabled={busy} />
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if ((await copyNow({ label, token, report: setSteps })) > 0n) setPaid(true);
                      onChanged?.();
                    } catch {
                      // Shown in the steps.
                    }
                    setBusy(false);
                  }}
                >
                  Copy it now, {feeText(offer)}
                </button>
              </div>
            ) : null}
            {steps ? <Steps steps={steps} /> : null}
          </div>
        ) : null}
      </dd>
    </div>
  );
}
