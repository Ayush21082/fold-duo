export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smootherstep on [0, 1]: starts and ends with zero speed and zero acceleration. */
export function smootherstep(p: number) {
  const t = clamp(p, 0, 1);
  return Math.min(1, t * t * t * (t * (6 * t - 15) + 10)); // rounding can land a hair above 1
}

/** Damped spring, integrated in fixed sub-steps so it behaves the same at any frame rate. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  stiffness: number;
  damping: number;

  constructor(value: number, stiffness = 120, damping = 20) {
    this.value = this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  /** Advance by dt seconds. `afterSubstep` runs after every sub-step (used for hard stops). */
  step(dt: number, afterSubstep?: () => void) {
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
      afterSubstep?.();
    }
  }

  snap(v: number) {
    this.value = this.target = v;
    this.velocity = 0;
  }

  get settled() {
    return Math.abs(this.value - this.target) < 1e-5 && Math.abs(this.velocity) < 1e-4;
  }
}
