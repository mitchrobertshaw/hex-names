import { useState } from "react";

import { HEADLINES } from "../hero/headlines";

/** A small panel for trying the headlines, while one is being chosen. */
export function HeadlinePicker({ headline, onHeadline }: { headline: string; onHeadline: (headline: string) => void }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="picker" role="region" aria-label="Preview options">
        <button type="button" onClick={() => setOpen(true)}>
          Show headline options
        </button>
      </div>
    );
  }

  return (
    <div className="picker" role="region" aria-label="Preview options">
      <div className="picker__row">
        <span className="picker__label">Headline</span>
        {HEADLINES.map((h) => (
          <button
            key={h.id}
            type="button"
            aria-pressed={h.id === headline}
            title={h.text}
            onClick={() => onHeadline(h.id)}
          >
            {h.id}
          </button>
        ))}
        <button type="button" className="picker__hide" onClick={() => setOpen(false)} aria-label="Hide the options">
          Hide
        </button>
      </div>
    </div>
  );
}
