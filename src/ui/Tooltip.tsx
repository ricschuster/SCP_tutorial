import { useId, useState } from 'react';
import { HELP, type HelpKey } from './help.ts';

interface TooltipProps {
  readonly term: HelpKey;
}

// A small, accessible info affordance for a control or term. Shows on hover and
// on keyboard focus (so it is reachable without a mouse), works on touch via tap
// (which focuses the button), and dismisses with Esc. The bubble is a real
// role="tooltip" element referenced by aria-describedby, not a title attribute,
// so assistive tech announces it. Content is self-contained (from help.ts), no
// external requests.
export function Tooltip({ term }: TooltipProps) {
  const { label, text } = HELP[term];
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const id = useId();
  const open = hovered || focused;

  return (
    <span
      className="tooltip"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="tooltip-btn"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={(e) => {
          // The button lives inside labels; do not let the click reach the
          // associated form control. Focus already reveals the bubble.
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setFocused(false);
            e.currentTarget.blur();
          }
        }}
      >
        i
      </button>
      {open && (
        <span role="tooltip" id={id} className="tooltip-bubble">
          {text}
        </span>
      )}
    </span>
  );
}
