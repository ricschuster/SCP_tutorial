// The teaching connectivity matrix c_ij. Synthetic and illustrative, like all
// data in the app. See docs/decisions/2026-07-18_connectivity-penalty.md and
// docs/design/07_connectivity.md.
//
// c_ij is symmetric and bounded to a small neighbourhood so scoring stays fast.
// Structural connectivity is distance decay: nearby cells are more connected.
// Functional connectivity is an optional same-cover boost, so the app can show
// "link like habitat to like habitat" on top of the land-cover model.

import type { ConnectivityLink, ConnectivityMatrix } from '../engine/greedy.ts';
import type { CoverId } from './land-cover.ts';
import { SCENARIO } from './scenario.ts';

export type { ConnectivityLink, ConnectivityMatrix };

// Neighbourhood radius in cells. Small so a candidate's connectivity sum is
// O(radius^2) and stays fast at 30x30 and beyond.
export const CONNECTIVITY_RADIUS = 3;
// Distance-decay length scale (cells): strength = exp(-distance / scale). Chosen
// so an adjacent cell contributes ~0.37 and the decay keeps a fully surrounded
// cell's total roughly in line with the compactness penalty's range.
export const DECAY_SCALE = 1;
// Multiplier added to a link when both cells share land cover (functional
// connectivity). 1 means a same-cover link counts double.
export const SAME_COVER_BOOST = 1;

interface HasCover {
  readonly cover: CoverId;
}

// Build the symmetric connectivity matrix over the landscape. Distance decay is
// purely geometric; the optional same-cover boost depends on the (possibly
// edited) cover of each cell, so rebuild it when covers change.
export function buildConnectivity(
  units: readonly HasCover[],
  options: { readonly sameCover?: boolean } = {},
): ConnectivityMatrix {
  const n = SCENARIO.gridSize;
  const r = CONNECTIVITY_RADIUS;
  const sameCover = options.sameCover ?? false;

  const map = new Map<number, ConnectivityLink[]>();
  for (let id = 0; id < units.length; id++) map.set(id, []);

  for (let id = 0; id < units.length; id++) {
    const row = Math.floor(id / n);
    const col = id % n;
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const other = nr * n + nc;
        // Visit each unordered pair once, then push both directions (symmetry).
        if (other <= id) continue;
        const dist = Math.hypot(dr, dc);
        if (dist > r) continue; // circular neighbourhood, not a square
        let strength = Math.exp(-dist / DECAY_SCALE);
        if (sameCover && units[id]!.cover === units[other]!.cover) {
          strength *= 1 + SAME_COVER_BOOST;
        }
        map.get(id)!.push({ to: other, strength });
        map.get(other)!.push({ to: id, strength });
      }
    }
  }
  return map;
}

// Per-unit connectivity potential: the total strength of a cell's links, i.e.
// how connected it is to its whole neighbourhood. Used to shade a connectivity
// surface layer so the well-connected areas are visible before solving.
export function connectivityPotential(
  matrix: ConnectivityMatrix,
): ReadonlyMap<number, number> {
  const potential = new Map<number, number>();
  for (const [id, links] of matrix) {
    let total = 0;
    for (const link of links) total += link.strength;
    potential.set(id, total);
  }
  return potential;
}
