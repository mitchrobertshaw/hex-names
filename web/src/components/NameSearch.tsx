import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import { checkName, type NameCheck, YEARLY_PRICE } from "../lib/names";
import { LAUNCHED } from "../site";
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

function Result({ check }: { check: NameCheck }) {
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
          <button type="button" className="button button--primary button--small" disabled={!LAUNCHED}>
            {LAUNCHED ? "Register" : "Opens at launch"}
          </button>
        </Card>
      );
    case "premium":
      return (
        <Card tone="info" icon={<StarIcon />} title={<><b>{check.name}</b> is a premium name</>}>
          <p>
            Names of {check.length} characters cost more than ${YEARLY_PRICE}. Their prices are announced at launch.
          </p>
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
          <Result check={check.hex} />
        </>
      );
  }
}

/** The search box: checks a name as you type, against the same rules the contracts use. */
export function NameSearch() {
  const [query, setQuery] = useState("");
  const check = useMemo(() => checkName(query), [query]);

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
        <Result check={check} />
      </div>
    </div>
  );
}
