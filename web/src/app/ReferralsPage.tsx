import { type FormEvent, useState } from "react";

import { dollarsText, payoutCsv, payoutReport, type PayoutReport, type PayoutRow } from "../lib/payouts";
import { LAUNCH_OFFER_DAYS, launchOffer, REFERRAL_PERCENT } from "../lib/referral";
import { CopyButton } from "./ManagePanel";
import { addressUrl, clients, deployment } from "./network";
import { readReferredPayments, readReferrers, readTokens } from "./payouts";
import { short } from "./wallet";

const DAY = 86_400;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const startOf = (day: string) => Date.parse(`${day}T00:00:00Z`) / 1000;
const dayText = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** USDC to send, without trailing zeros past the cents: "3.25", "0.000007". */
export function usdcText(micro: bigint): string {
  const whole = micro / 1_000_000n;
  const fraction = (micro % 1_000_000n).toString().padStart(6, "0").replace(/0{1,4}$/, "");
  return `${whole.toLocaleString("en-US")}.${fraction.padEnd(2, "0")}`;
}

function download(report: PayoutReport, from: string, to: string) {
  const url = URL.createObjectURL(new Blob([payoutCsv(report)], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `hexns-referral-payouts-${from}-to-${to}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type State =
  | { status: "idle" }
  | { status: "working"; percent: number }
  | { status: "done"; report: PayoutReport; from: string; to: string; payments: number }
  | { status: "failed"; message: string };

/** app.hexns.domains/referrals: what each referrer is owed, worked out from the registrar's records. */
export function ReferralsPage() {
  const offer = launchOffer(deployment?.launchDate);
  const offerFrom = offer ? deployment!.launchDate! : "";
  const offerTo = offer ? isoDay(offer.lastDay) : "";
  const today = isoDay(new Date());
  const [from, setFrom] = useState(offerFrom);
  const [to, setTo] = useState(offer && offerTo < today ? offerTo : today);
  const [state, setState] = useState<State>({ status: "idle" });

  if (!deployment) {
    return (
      <div className="payouts">
        <h1>Referral payouts</h1>
        <section className="card payouts__card">
          <p>
            This report reads the registrar&rsquo;s records on PulseChain, so it works once .hex is deployed and{" "}
            <code>web/src/deployment.ts</code> is filled in.
          </p>
        </section>
      </div>
    );
  }
  const pulsechain = deployment.pulsechain;

  // Only purchases during the launch offer earn the 10%, so the report keeps to its days.
  const first = offer && from < offerFrom ? offerFrom : from;
  const last = offer && to > offerTo ? offerTo : to;
  const kept = offer && (first !== from || last !== to);
  const ready = !!first && !!last && first <= last && state.status !== "working";

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setState({ status: "working", percent: 0 });
    try {
      const client = clients.pulsechain;
      const { payments } = await readReferredPayments(client, pulsechain, startOf(first), startOf(last) + DAY, (p) =>
        setState({ status: "working", percent: p.total ? Number((p.done * 100n) / p.total) : 100 }),
      );
      const [referrers, tokens] = await Promise.all([
        readReferrers(client, pulsechain.registry, payments.map((payment) => payment.referrer)),
        readTokens(client, payments.map((payment) => payment.token)),
      ]);
      setState({ status: "done", report: payoutReport(payments, referrers, tokens), from: first, to: last, payments: payments.length });
    } catch (error) {
      setState({ status: "failed", message: error instanceof Error ? error.message.split("\n")[0] : String(error) });
    }
  }

  return (
    <div className="payouts">
      <h1>Referral payouts</h1>
      <p className="payouts__lede">
        What each referrer is owed: {REFERRAL_PERCENT}% of what the buyers they brought paid, for purchases and renewals
        made through their referral link. Worked out from the registrar&rsquo;s records on PulseChain.
      </p>
      <p className="payouts__offer">
        {offer
          ? `The launch offer runs from ${dayText(offerFrom)} to ${dayText(offerTo)}. Only purchases in those days earn the ${REFERRAL_PERCENT}%.`
          : `The launch offer runs for ${LAUNCH_OFFER_DAYS} days from launchDate in web/src/deployment.ts, which isn't set yet. Choose the days yourself.`}
      </p>

      <form className="card payouts__card payouts__form" onSubmit={run}>
        <label>
          From
          <input type="date" value={from} min={offerFrom || undefined} max={offerTo || undefined} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label>
          To (included)
          <input type="date" value={to} min={offerFrom || undefined} max={offerTo || undefined} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <button type="submit" className="button button--primary" disabled={!ready}>
          {state.status === "working" ? `Reading PulseChain… ${state.percent}%` : "Work it out"}
        </button>
        {kept ? <p className="payouts__note">Kept to the launch offer: {dayText(first)} to {dayText(last)}.</p> : null}
        {first && last && first > last ? <p className="payouts__note">The first day is after the last.</p> : null}
      </form>

      {state.status === "failed" ? (
        <section className="card payouts__card" role="alert">
          <p>
            <b>Couldn&rsquo;t read PulseChain.</b> {state.message}
          </p>
          <p>Nothing was sent anywhere. Try again in a minute: public RPCs sometimes turn requests away.</p>
        </section>
      ) : null}

      {state.status === "done" ? <Report {...state} /> : null}
    </div>
  );
}

function Report({ report, from, to, payments }: { report: PayoutReport; from: string; to: string; payments: number }) {
  const notPaid = [...report.selfReferrals, ...report.noOwner];
  return (
    <>
      <section className="card payouts__card" aria-labelledby="to-pay">
        <h2 id="to-pay" className="payouts__title">
          To pay, {dayText(from)} to {dayText(to)}
        </h2>
        {report.pay.length === 0 ? (
          <p>
            {payments === 0
              ? "No purchases or renewals came through a referral link in these days."
              : "Nobody to pay for these days: see what was set aside below."}
          </p>
        ) : (
          <>
            <p className="payouts__summary">
              {report.pay.length} {report.pay.length === 1 ? "referrer" : "referrers"} to pay,{" "}
              <b>{usdcText(report.total.owed)} USDC</b> in all, {REFERRAL_PERCENT}% of the{" "}
              {dollarsText(report.total.paid)} their buyers paid.
            </p>
            <div className="payouts__scroll">
              <table className="payouts__table">
                <thead>
                  <tr>
                    <th scope="col">Referrer</th>
                    <th scope="col">Pay to</th>
                    <th scope="col">Bought</th>
                    <th scope="col">Renewed</th>
                    <th scope="col">Their buyers paid</th>
                    <th scope="col">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pay.map((row) => (
                    <tr key={row.tag}>
                      <th scope="row">{row.referrer}</th>
                      <td data-label="Pay to">
                        <span className="payouts__wallet">
                          <a href={addressUrl("pulsechain", row.payTo!)} target="_blank" rel="noreferrer">
                            {short(row.payTo!)}
                          </a>
                          <CopyButton text={row.payTo!} />
                        </span>
                      </td>
                      <td data-label="Bought">{row.purchases}</td>
                      <td data-label="Renewed">{row.renewals}</td>
                      <td data-label="Their buyers paid">{dollarsText(row.paid)}</td>
                      <td data-label="Owed" className="payouts__owed">
                        <b>{usdcText(row.owed)} USDC</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="payouts__how">
              Send each referrer&rsquo;s amount in USDC on PulseChain to the wallet shown for them: whoever owns the
              referring name now. The spreadsheet has the same, with every referrer and exact amounts.
            </p>
          </>
        )}
        <button
          type="button"
          className="button button--ghost button--small payouts__download"
          onClick={() => download(report, from, to)}
        >
          Download the spreadsheet (CSV)
        </button>
      </section>

      {notPaid.length ? (
        <section className="card payouts__card" aria-labelledby="not-paid">
          <h2 id="not-paid" className="payouts__title">
            Not paid
          </h2>
          <ul className="payouts__list">
            {notPaid.map((row) => (
              <li key={`${row.status}:${row.tag}`}>
                <b>{row.referrer.startsWith("0x") ? `${row.referrer.slice(0, 10)}…` : row.referrer}</b>: {notPaidReason(row)},{" "}
                {row.purchases + row.renewals} {row.purchases + row.renewals === 1 ? "payment" : "payments"} of{" "}
                {dollarsText(row.paid)}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.otherTokens.length ? (
        <section className="card payouts__card">
          <p>
            {report.otherTokens.length} payments in a token the report couldn&rsquo;t read are left out. Ask for help
            with these.
          </p>
        </section>
      ) : null}
    </>
  );
}

function notPaidReason(row: PayoutRow): string {
  return row.status === "self-referral"
    ? "a self-referral (the buyer also owns this name)"
    : row.referrer.startsWith("0x")
      ? "not a .hex name"
      : "nobody owns this name now";
}
