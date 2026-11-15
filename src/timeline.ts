import { smootherstep } from './motion.ts';

/** Seconds the hinge takes to swing fully open or fully closed when timed. */
export const SWING = 2.8;

/** Timed fold from `from` to `to` (radians), `t` seconds after it started. */
export function swing(from: number, to: number, t: number, duration = SWING) {
  return from + (to - from) * smootherstep(t / duration);
}

/** The auto-play loop: closed → opens → holds open (turning once to show the back) → closes. */
export const LOOP = {
  closed: 1.0,
  open: 5.4,
  /** The turn, within the open hold: it starts `turnAt` seconds after opening. */
  turnAt: 1.0,
  turnFor: 3.6,
  get length() {
    return this.closed + SWING + this.open + SWING;
  },
  /** When the device has just finished opening. */
  get openedAt() {
    return this.closed + SWING;
  },
};

/** Fold angle (π closed … 0 open) at time t into the loop. */
export function loopFold(t: number) {
  const time = ((t % LOOP.length) + LOOP.length) % LOOP.length;
  if (time < LOOP.closed) return Math.PI;
  if (time < LOOP.openedAt + LOOP.open) return swing(Math.PI, 0, time - LOOP.closed);
  return swing(0, Math.PI, time - LOOP.openedAt - LOOP.open);
}

/** Extra turn about the vertical axis (radians, 0 … 2π) at time t into the loop. */
export function loopTurn(t: number) {
  const time = ((t % LOOP.length) + LOOP.length) % LOOP.length;
  return 2 * Math.PI * smootherstep((time - LOOP.openedAt - LOOP.turnAt) / LOOP.turnFor);
}

/** Where in the loop to resume so playback starts from the hinge's current side. */
export function loopTimeFor(fold: number) {
  return fold < Math.PI / 2 ? LOOP.openedAt : 0;
}
