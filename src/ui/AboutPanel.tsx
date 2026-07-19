import { useEffect, useRef } from 'react';

interface AboutPanelProps {
  readonly onClose: () => void;
  // Let the "guided tour" pointer start the tour and close the panel in one go.
  readonly onStartTour: () => void;
}

const REPO_URL = 'https://github.com/ricschuster/SCP_tutorial';
const PRIORITIZR_URL = 'https://prioritizr.net';

// A modal explaining what the app is, what it teaches, and its (honest) scope.
// Keyboard-accessible: focus moves in on open and is trapped, Esc closes, and a
// click on the backdrop closes. Copy is sourced from docs/design/00_project_brief.md
// and CLAUDE.md; kept concise, no external assets loaded beyond the two links.
export function AboutPanel({ onClose, onStartTour }: AboutPanelProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Move focus into the dialog on open and restore it to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Esc closes; Tab is trapped within the dialog so focus cannot escape to the
  // page behind it.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={onKeyDown}
      role="presentation"
    >
      <div
        className="modal about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="about-title">About this app</h2>
          <button
            type="button"
            className="tool"
            onClick={onClose}
            ref={closeRef}
            aria-label="Close about"
          >
            Close
          </button>
        </div>

        <p>
          An interactive tutorial for the core ideas of{' '}
          <strong>Systematic Conservation Planning (SCP)</strong>: the structured
          process of deciding where to invest limited conservation resources so a set of
          biodiversity goals is met as efficiently as possible.
        </p>

        <p>
          Set a representation target for each species, paint land cover on a small
          grid, and a solver picks the lowest-cost set of areas that meets every target,
          re-solving as you change things. That makes three ideas visible rather than
          abstract: <strong>complementarity</strong> (areas are chosen for what they
          add, not their standalone value), the{' '}
          <strong>cost-versus-target tradeoff</strong>, and{' '}
          <strong>irreplaceability</strong> (how often an area shows up across
          near-optimal plans).
        </p>

        <h3>Three depth layers, one engine</h3>
        <ul>
          <li>
            <strong>Explore</strong>: the core loop of targets, cost, solve, and
            solution.
          </li>
          <li>
            <strong>Guided tour</strong>: a walkthrough that narrates the workflow step
            by step.
          </li>
          <li>
            <strong>Method (advanced)</strong>: the optimizer's knobs, including
            minimum-set versus maximum-coverage under a budget, compactness and
            connectivity penalties, feature weights, and greedy versus near-optimal
            solving.
          </li>
        </ul>

        <h3>Honest scope</h3>
        <p>
          This is a teaching tool on a small <strong>synthetic</strong> landscape, not a
          production reserve-design tool and not a replacement for prioritizr or Marxan.
          The prioritization math follows the standard minimum-set formulation; the data
          is simplified and illustrative, not authoritative. Everything runs in your
          browser, with no external data loaded at runtime.
        </p>

        <p className="about-links">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          <a href={PRIORITIZR_URL} target="_blank" rel="noreferrer">
            prioritizr.net (reference package)
          </a>
        </p>

        <p className="hint">
          New here? The{' '}
          <button type="button" className="link-button" onClick={onStartTour}>
            guided tour
          </button>{' '}
          walks you through it.
        </p>
      </div>
    </div>
  );
}
