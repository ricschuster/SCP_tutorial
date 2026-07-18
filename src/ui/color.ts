// Small colour helpers for the maps. No dependency on the DOM.

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Linear interpolation between two colours; t is clamped to [0, 1].
export function mix(from: Rgb, to: Rgb, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * k);
  const g = Math.round(from[1] + (to[1] - from[1]) * k);
  const b = Math.round(from[2] + (to[2] - from[2]) * k);
  return `rgb(${r} ${g} ${b})`;
}
