import { MathUtils, PerspectiveCamera } from 'three';
import { H, HALF_W } from './device/dimensions.ts';
import { lerp } from './motion.ts';

/** Long-lens product camera that frames the device as its footprint changes. */
export class CameraRig {
  // Near plane at 1: the camera never comes closer, and it keeps depth precision high.
  readonly camera = new PerspectiveCamera(24, 1, 1, 200);
  private px = 0;
  private py = 0;

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Distance that fits a w × h box in view. */
  private fit(w: number, h: number) {
    const t = Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    return Math.max(h / 2 / t, w / 2 / (t * this.camera.aspect));
  }

  /**
   * Fractions of the view height kept free for page chrome: the header (top) and the
   * playback controls (bottom). The device is framed into the space between them.
   */
  reserveTop = 0;
  reserveBottom = 0;

  /** open: 0..1 hinge openness; dolly: <1 pushes in; pointer: -1..1 for a little parallax. */
  update(open: number, dolly: number, pointerX: number, pointerY: number, dt: number) {
    // Open, frame tighter so the display's UI is large enough to use.
    const width = lerp(HALF_W + 1.6, HALF_W * 2 + 0.7, open);
    const free = Math.max(0.35, 1 - this.reserveTop - this.reserveBottom);
    const height = (H + lerp(2.8, 1.7, open)) / free;
    const dist = this.fit(width, height) * dolly;
    // Centre the device in the free band: look below it by half the imbalance of the reserves.
    const viewH = 2 * dist * Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    const drop = -((this.reserveBottom - this.reserveTop) / 2) * viewH;
    const k = 1 - Math.exp(-dt * 3);
    this.px += (pointerX - this.px) * k;
    this.py += (pointerY - this.py) * k;
    // Land exactly, so a resting camera is truly still.
    if (Math.abs(pointerX - this.px) < 1e-4) this.px = pointerX;
    if (Math.abs(pointerY - this.py) < 1e-4) this.py = pointerY;
    this.camera.position.set(this.px * 0.6, 0.35 + drop + this.py * 0.4, dist);
    this.camera.lookAt(0, drop, 0);
  }
}
