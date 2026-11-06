import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { checkName, type NameCheck } from "../lib/names";
import { onSearchFor } from "../lib/playName";
import { LAUNCHED } from "../site";
import { Checkout } from "./Checkout";
import { AlertIcon, CheckIcon, CrossIcon, LockIcon, SearchIcon, StarIcon } from "./icons";

type Tone = "ok" | "info" | "neutral" | "bad" | "warn";

function Card({ tone, icon, title, children }: { tone: Tone; icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <div className={`result result--${tone}`}>
      <span className="result__icon">{icon}</span>
      <div className="result__body">
        <p className="result__title">{title}</p>
        <div className="result__detail">{children}</div>
      </div>
    </div>
  );
}

type OpenCheckout = (name: string, length: number) => void;

function Result({ check, onCheckout }: { check: NameCheck; onCheckout: OpenCheckout }) {
  switch (check.kind) {
    case "empty":
      return null;
    case "available":
      return (
        <Card tone="ok" icon={<CheckIcon />} title={<><b>{check.name}</b> is available</>}>
          <p>
            ${check.yearlyPrice} a year for both chains, paid in PLS, HEX or any token.{" "}
            {LAUNCHED ? null : "Registration opens at launch."}
          </p>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => onCheckout(check.name, check.length)}
          >
            {LAUNCHED ? "Register" : "See price"}
          </button>
        </Card>
      );
    case "premium":
      return (
        <Card tone="info" icon={<StarIcon />} title={<><b>{check.name}</b> is a premium name</>}>
          <p>
            Names of {check.length} characters are rarer, so they cost ${check.yearlyPrice} a year for both chains.
          </p>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => onCheckout(check.name, check.length)}
          >
            {LAUNCHED ? "Register" : "See price"}
          </button>
        </Card>
      );
    case "reserved":
      return (
        <Card tone="neutral" icon={<LockIcon />} title={<><b>{check.name}</b> is reserved</>}>
          <p>
            {check.given
              ? `Reserved for ${check.reservedFor}. It's theirs from launch.`
              : `Held for ${check.reservedFor} until they claim it.`}
          </p>
        </Card>
      );
    case "too-short":
      return (
        <Card tone="bad" icon={<CrossIcon />} title={<><b>{check.name}</b> is too short</>}>
          <p>Names need at least 3 characters.</p>
        </Card>
      );
    case "invalid":
      return (
        <Card tone="bad" icon={<CrossIcon />} title="That name won't work">
          <p>{check.reason}</p>
        </Card>
      );
    case "eth":
      return (
        <>
          <Card tone="warn" icon={<AlertIcon />} title={<><b>{check.name}</b> is a .eth name</>}>
            <p>.hex names never end in .eth. Here&rsquo;s the .hex one:</p>
          </Card>
          <Result check={check.hex} onCheckout={onCheckout} />
        </>
      );
  }
}

/** The search box: checks a name as you type, against the same rules the contracts use. */
export function NameSearch() {
  const [query, setQuery] = useState("");
  const check = useMemo(() => checkName(query), [query]);
  const [checkout, setCheckout] = useState<{ name: string; length: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // "See if it's free" further down the page fills the box in.
  useEffect(
    () =>
      onSearchFor((name) => {
        setQuery(name);
        // With a mouse, ready to edit; on a phone, no keyboard popping up over the result.
        if (window.matchMedia("(pointer: fine)").matches) input.current?.focus({ preventScroll: true });
      }),
    [],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur(); // closes the keyboard on phones
  }

  return (
    <div className="search">
      <form className="search__form" role="search" onSubmit={onSubmit}>
        <label htmlFor="name-search" className="visually-hidden">
          Search for a .hex name
        </label>
        <span className="search__icon">
          <SearchIcon />
        </span>
        <input
          ref={input}
          id="name-search"
          type="search"
          placeholder="Find your name"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={255}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="button button--primary">
          Search
        </button>
      </form>
      <div className="search__results" aria-live="polite">
        <Result check={check} onCheckout={(name, length) => setCheckout({ name, length })} />
      </div>
      {checkout ? <Checkout name={checkout.name} length={checkout.length} onClose={() => setCheckout(null)} /> : null}
    </div>
  );
}
