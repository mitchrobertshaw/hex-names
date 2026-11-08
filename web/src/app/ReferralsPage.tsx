import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { type Address, formatUnits, type Hex } from "viem";

import {
  dollarsText,
  findPayout,
  payoutCsv,
  payoutReport,
  type PayoutReport,
  type PayoutRow,
  payoutTransfers,
  type Transfer,
  usdcText,
} from "../lib/payouts";
import { LAUNCH_OFFER_DAYS, launchOffer, REFERRAL_PERCENT } from "../lib/referral";
import { erc20Abi, registrarAbi } from "./abis";
import { payReferrers, setBotBudget, type Step, usdcUnits } from "./flows";
import { CopyButton } from "./ManagePanel";
import { addressUrl, clients, deployment, network, txUrl } from "./network";
import { readPayoutTransfers, readReferredPayments, readReferrers, readTokens } from "./payouts";
import { Steps } from "./Steps";
import { short, useWallet } from "./wallet";
import { WalletChoices } from "./WalletButton";

const DAY = 86_400;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const startOf = (day: string) => Date.parse(`${day}T00:00:00Z`) / 1000;
const nextDay = (day: string) => isoDay(new Date((startOf(day) + DAY) * 1000));
const dayText = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const blockDay = async (block: bigint) =>
  isoDay(new Date(Number((await clients.pulsechain.getBlock({ blockNumber: block })).timestamp) * 1000));

// The last day paid for, remembered in this browser so the next report starts after it.
const paidKey = () => `hexns-referrals-paid-through:${network}:${deployment?.pulsechain.registrar.toLowerCase()}`;
function loadPaidThrough(): string | null {
  try {
    return localStorage.getItem(paidKey());
  } catch {
    return null;
  }
}
function savePaidThrough(day: string) {
  try {
    if ((loadPaidThrough() ?? "") < day) localStorage.setItem(paidKey(), day);
  } catch {
    // Without storage, the next report just starts at the beginning of the offer again.
  }
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

/** The wallet every payment goes to: the registrar's beneficiary, fixed at deployment. */
function usePaymentsWallet(): Address | null | undefined {
  const [payee, setPayee] = useState<Address | null | undefined>(deployment ? undefined : null);
  useEffect(() => {
    if (!deployment) return;
    clients.pulsechain
      .readContract({ address: deployment.pulsechain.registrar, abi: registrarAbi, functionName: "BENEFICIARY" })
      .then(setPayee, () => setPayee(null));
  }, []);
  return payee;
}

interface Done {
  report: PayoutReport;
  from: string;
  to: string;
  payments: number;
  decimals: number;
  /** A payout that already paid all of this, if there is one. */
  paid: { transfer: Transfer; day: string } | null;
}

type State =
  | { status: "idle" }
  | { status: "working"; percent: number }
  | ({ status: "done" } & Done)
  | { status: "failed"; message: string };

/**
 * app.hexns.domains/referrals: what each referrer is owed, worked out from the registrar's records,
 * and paid in one transaction. Shown only to the wallet that receives .hex's payments. That keeps it
 * out of casual view, though everything on it can be read from the chain by anyone.
 */
export function ReferralsPage() {
  const wallet = useWallet();
  const payee = usePaymentsWallet();
  const account = wallet.connected?.account;

  if (!deployment) {
    return (
      <Shell>
        <section className="card payouts__card">
          <p>
            This report reads the registrar&rsquo;s records on PulseChain, so it works once .hex is deployed and{" "}
            <code>web/src/deployment.ts</code> is filled in.
          </p>
        </section>
      </Shell>
    );
  }
  if (payee === undefined) {
    return (
      <Shell>
        <p className="name-page__loading">Checking…</p>
      </Shell>
    );
  }
  if (payee === null) {
    return (
      <Shell>
        <section className="card payouts__card" role="alert">
          <p>Couldn&rsquo;t read the registrar on PulseChain. Reload the page in a minute.</p>
        </section>
      </Shell>
    );
  }
  if (!account) {
    return (
      <Shell>
        <section className="card payouts__card">
          <p>
            This report is for the wallet that receives .hex&rsquo;s payments, <b>{short(payee)}</b>. Connect it to see
            who&rsquo;s owed what, and to pay them.
          </p>
          <WalletChoices />
        </section>
      </Shell>
    );
  }
  if (account.toLowerCase() !== payee.toLowerCase()) {
    return (
      <Shell>
        <section className="card payouts__card">
          <p>
            This report is for the wallet that receives .hex&rsquo;s payments, <b>{short(payee)}</b>. You&rsquo;re
            connected with {short(account)}: switch to the other one in your wallet.
          </p>
        </section>
      </Shell>
    );
  }
  return <Payouts />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="payouts">
      <h1>Referral payouts</h1>
      {children}
    </div>
  );
}

function Payouts() {
  const pulsechain = deployment!.pulsechain;
  const offer = launchOffer(deployment!.launchDate);
  const offerFrom = offer ? deployment!.launchDate! : "";
  const offerTo = offer ? isoDay(offer.lastDay) : "";
  const today = isoDay(new Date());
  const paidThrough = loadPaidThrough();
  const [from, setFrom] = useState(() => {
    const after = paidThrough ? nextDay(paidThrough) : "";
    return after && (!offer || after <= offerTo) ? after : offerFrom;
  });
  const [to, setTo] = useState(offer && offerTo < today ? offerTo : today);
  const [state, setState] = useState<State>({ status: "idle" });

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
      const { payments, blocks } = await readReferredPayments(client, pulsechain, startOf(first), startOf(last) + DAY, (p) =>
        setState({ status: "working", percent: p.total ? Number((p.done * 100n) / p.total) : 100 }),
      );
      const [referrers, tokens, decimals] = await Promise.all([
        readReferrers(client, pulsechain.registry, payments.map((payment) => payment.referrer)),
        readTokens(client, payments.map((payment) => payment.token)),
        client.readContract({ address: pulsechain.usdc, abi: erc20Abi, functionName: "decimals" }),
      ]);
      const report = payoutReport(payments, referrers, tokens);
      // Has this exact payout been sent already, from any device? Payouts come after their days.
      const transfers = await readPayoutTransfers(
        client,
        pulsechain.usdc,
        report.pay.flatMap((row) => (row.payTo ? [row.payTo] : [])),
        blocks.last + 1n,
      );
      const sent = findPayout(report, transfers, decimals);
      setState({
        status: "done",
        report,
        from: first,
        to: last,
        payments: payments.length,
        decimals,
        paid: sent ? { transfer: sent, day: await blockDay(sent.block) } : null,
      });
    } catch (error) {
      setState({ status: "failed", message: error instanceof Error ? error.message.split("\n")[0] : String(error) });
    }
  }

  return (
    <Shell>
      <p className="payouts__lede">
        What each referrer is owed: {REFERRAL_PERCENT}% of what the buyers they brought paid, for purchases and renewals
        made through their referral link. Worked out from the registrar&rsquo;s records on PulseChain.
      </p>
      <p className="payouts__offer">
        {offer
          ? `The launch offer runs from ${dayText(offerFrom)} to ${dayText(offerTo)}. Only purchases in those days earn the ${REFERRAL_PERCENT}%.`
          : `The launch offer runs for ${LAUNCH_OFFER_DAYS} days from launchDate in web/src/deployment.ts, which isn't set yet. Choose the days yourself.`}
        {paidThrough ? ` You've paid up to ${dayText(paidThrough)} from this browser.` : ""}
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

      {state.status === "done" ? <Report key={`${state.from}:${state.to}`} {...state} /> : null}

      <BotCard />
    </Shell>
  );
}

function Report({ report, from, to, payments, decimals, paid }: Done) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [sent, setSent] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const notPaid = [...report.selfReferrals, ...report.noOwner];
  const transfers = payoutTransfers(report, decimals);

  async function payAll() {
    setBusy(true);
    try {
      const hash = await payReferrers({ payments: transfers, report: setSteps });
      setSent(hash);
      savePaidThrough(to);
    } catch {
      // The steps show what went wrong.
    } finally {
      setBusy(false);
    }
  }

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

            {paid ? (
              <p className="payouts__paid">
                <b>Already paid</b> on {dayText(paid.day)}: every referrer exactly this, in{" "}
                <a href={txUrl("pulsechain", paid.transfer.tx)} target="_blank" rel="noreferrer">
                  one transaction
                </a>
                . Nothing more to send for these days.
              </p>
            ) : sent ? (
              <p className="payouts__paid">
                <b>Paid.</b> {transfers.length} {transfers.length === 1 ? "referrer" : "referrers"},{" "}
                {usdcText(report.total.owed)} USDC, in{" "}
                <a href={txUrl("pulsechain", sent)} target="_blank" rel="noreferrer">
                  one transaction
                </a>
                . Next time, start from {dayText(nextDay(to))}.
              </p>
            ) : transfers.length ? (
              <div className="payouts__pay">
                <p className="payouts__how">
                  <b>Pay all</b> sends every referrer their amount in USDC on PulseChain, from this wallet, in one
                  transaction. Your wallet asks twice: to allow the exact total, then to send it.
                </p>
                <button type="button" className="button button--primary" onClick={payAll} disabled={busy}>
                  {busy ? "Paying…" : `Pay all: ${usdcText(report.total.owed)} USDC`}
                </button>
              </div>
            ) : null}
            {steps ? <Steps steps={steps} /> : null}
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

interface BotBalances {
  float: bigint;
  pls: bigint;
  eth: bigint;
  ethUsdc: bigint;
  budget: bigint;
}

/**
 * The bot: its balances on both chains, and the budget this wallet allows it. It buys its own gas
 * with a small working balance of USDC, which it tops up from here, up to the budget; anything over
 * its working balance comes back here.
 */
function BotCard() {
  const d = deployment!;
  const bot = d.bot.address;
  const owner = useWallet().connected?.account;
  const [balances, setBalances] = useState<BotBalances | "failed" | null>(null);
  const [amount, setAmount] = useState("100");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!bot || !owner) return;
    let alive = true;
    Promise.all([
      clients.pulsechain.readContract({ address: d.pulsechain.usdc, abi: erc20Abi, functionName: "balanceOf", args: [bot] }),
      clients.pulsechain.getBalance({ address: bot }),
      clients.ethereum.getBalance({ address: bot }),
      clients.ethereum.readContract({ address: d.ethereum.usdc, abi: erc20Abi, functionName: "balanceOf", args: [bot] }),
      clients.pulsechain.readContract({ address: d.pulsechain.usdc, abi: erc20Abi, functionName: "allowance", args: [owner, bot] }),
    ])
      .then(([float, pls, eth, ethUsdc, budget]) => alive && setBalances({ float, pls, eth, ethUsdc, budget }))
      .catch(() => alive && setBalances("failed"));
    return () => {
      alive = false;
    };
  }, [bot, owner, version, d]);

  async function setBudget(usdc: bigint) {
    if (!bot) return;
    setBusy(true);
    try {
      await setBotBudget({ bot, usdc, report: setSteps });
      setVersion((v) => v + 1);
    } catch {
      // The steps show what went wrong.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card payouts__card" aria-labelledby="bot-title">
      <h2 id="bot-title" className="payouts__title">
        The bot
      </h2>
      <p className="payouts__how">
        It copies every name to Ethereum and pays its own gas, buying PLS and ETH with a small working balance of
        USDC. When that runs low, it draws what it needs from this wallet, up to the budget you set here; anything
        extra comes back. Only this wallet can change the budget.
      </p>
      {!bot ? (
        <p>
          Its balances show here once its address is in <code>web/src/deployment.ts</code>: <code>bot.address</code>, the
          address it prints when it starts.
        </p>
      ) : (
        <>
          {balances === "failed" ? (
            <p>Couldn&rsquo;t read the bot&rsquo;s balances just now. Reload the page in a minute.</p>
          ) : balances ? (
            <dl className="bot__balances">
              <div>
                <dt>Working balance, on PulseChain</dt>
                <dd>{usdcText(balances.float)} USDC</dd>
              </div>
              <div>
                <dt>Gas, on PulseChain</dt>
                <dd>{Math.round(Number(formatUnits(balances.pls, 18))).toLocaleString("en-US")} PLS</dd>
              </div>
              <div>
                <dt>Gas, on Ethereum</dt>
                <dd>{Number(formatUnits(balances.eth, 18)).toFixed(4)} ETH</dd>
              </div>
              <div>
                <dt>Budget left</dt>
                <dd>{usdcText(balances.budget)} USDC</dd>
              </div>
            </dl>
          ) : (
            <p className="name-page__loading">Reading the bot&rsquo;s balances…</p>
          )}
          <form
            className="bot__form"
            onSubmit={(event) => {
              event.preventDefault();
              const dollars = Number(amount);
              if (Number.isFinite(dollars) && dollars >= 0) void setBudget(usdcUnits(dollars));
            }}
          >
            <label>
              Budget, in USDC
              <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <button type="submit" className="button button--primary" disabled={busy}>
              Set the budget
            </button>
            <button
              type="button"
              className="button button--ghost"
              disabled={busy || !balances || balances === "failed" || balances.budget === 0n}
              onClick={() => void setBudget(0n)}
            >
              Stop it drawing
            </button>
          </form>
          {steps ? <Steps steps={steps} /> : null}
        </>
      )}
    </section>
  );
}

function notPaidReason(row: PayoutRow): string {
  return row.status === "self-referral"
    ? "a self-referral (the buyer also owns this name)"
    : row.referrer.startsWith("0x")
      ? "not a .hex name"
      : "nobody owns this name now";
}
