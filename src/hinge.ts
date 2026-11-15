import { Spring } from './motion.ts';

/**
 * Hinge mechanics: a spring between 0 (flat) and π (closed) with hard mechanical stops.
 * Hitting a stop kills most of the velocity and bounces the rest back, which gives the
 * small "thunk" of a real hinge instead of a spring wobbling through the end positions.
 */
export class Hinge {
  readonly spring = new Spring(Math.PI, 42, 9.5);
  onStop?: (impact: number) => void;

  get value() {
    return this.spring.value;
  }
  /** 0 = closed, 1 = fully open. */
  get openness() {
    return 1 - this.spring.value / Math.PI;
  }
  get isOpening() {
    return this.spring.target === 0;
  }

  open() {
    this.spring.target = 0;
  }
  close() {
    this.spring.target = Math.PI;
  }
  toggle() {
    this.isOpening ? this.close() : this.open();
  }

  snap(fold: number) {
    this.spring.snap(fold);
  }

  step(dt: number) {
    const s = this.spring;
    s.step(dt, () => {
      if (s.value < 0) this.hit(0, -1);
      else if (s.value > Math.PI) this.hit(Math.PI, 1);
    });
  }

  private hit(stop: number, dir: number) {
    const s = this.spring;
    s.value = stop;
    if (s.velocity * dir > 0) {
      const impact = Math.abs(s.velocity);
      s.velocity = -s.velocity * 0.2;
      if (impact > 0.6) this.onStop?.(impact);
    }
  }
}
