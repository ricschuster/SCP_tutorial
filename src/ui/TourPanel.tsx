import type { TourStep } from './tour.ts';

interface TourPanelProps {
  readonly step: TourStep;
  readonly index: number;
  readonly total: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onClose: () => void;
}

// A fixed bar at the bottom of the screen driving the guided tour.
export function TourPanel({
  step,
  index,
  total,
  onBack,
  onNext,
  onClose,
}: TourPanelProps) {
  const isLast = index === total - 1;
  return (
    <aside className="tour-panel" role="dialog" aria-label="Guided tour">
      <div className="tour-content">
        <div className="tour-progress">
          <span className="tour-count">
            Step {index + 1} of {total}
          </span>
          <ol className="tour-dots">
            {Array.from({ length: total }, (_, i) => (
              <li
                key={i}
                className={i === index ? 'tour-dot tour-dot-active' : 'tour-dot'}
              />
            ))}
          </ol>
        </div>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>
      </div>
      <div className="tour-actions">
        <button type="button" className="tour-btn" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="tour-btn"
          onClick={onBack}
          disabled={index === 0}
        >
          Back
        </button>
        <button type="button" className="tour-btn tour-btn-primary" onClick={onNext}>
          {isLast ? 'Finish' : 'Next'}
        </button>
      </div>
    </aside>
  );
}
