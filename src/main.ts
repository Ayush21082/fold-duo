import { NeutralToneMapping, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { CameraRig } from './camera-rig.ts';
import { createDevice } from './device/device.ts';
import { H, HALF_W } from './device/dimensions.ts';
import { Hinge } from './hinge.ts';
import { contactShadow, studioEnvironment } from './lighting.ts';
import { clamp, smootherstep, Spring } from './motion.ts';
import { createSampleScreens } from './screens/sample-screens.ts';
import { loopFold, loopTimeFor, loopTurn } from './timeline.ts';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const playButton = document.querySelector<HTMLButtonElement>('#play')!;
const range = document.querySelector<HTMLInputElement>('#fold')!;
const controls = document.querySelector<HTMLElement>('.controls')!;

const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NeutralToneMapping;

const scene = new Scene();
scene.environment = studioEnvironment(renderer);

const rig = new CameraRig();
const screens = createSampleScreens(renderer);
const device = createDevice(screens.inner, screens.cover, screens.back);
device.setInnerBrightness(1);
device.setCoverBrightness(1);
scene.add(device.root);

const shadow = contactShadow();
shadow.mesh.position.y = -H / 2 - 0.35;
scene.add(shadow.mesh);

const hinge = new Hinge();
const turnY = new Spring(0, 40, 11);
const turnX = new Spring(0, 40, 11);

// ---- Playback state ----
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let playing = false;
let loopTime = 0;

function setPlaying(value: boolean) {
  if (value && !playing) loopTime = loopTimeFor(hinge.value);
  // Stopping mid-turn hands the loop's turn to the drag spring, so the device doesn't jump.
  if (!value && playing) turnY.snap(turnY.value + loopTurn(loopTime));
  playing = value;
  playButton.setAttribute('aria-pressed', String(value));
  playButton.setAttribute('aria-label', value ? 'Pause' : 'Play');
}

playButton.addEventListener('click', () => setPlaying(!playing));
range.addEventListener('input', () => {
  setPlaying(false);
  hinge.snap(Math.PI * (1 - Number(range.value) / 1000));
});

// ---- Input: drag turns the device, a tap folds it ----
let lastTouch = -Infinity;
let drag: { x: number; y: number; moved: number } | null = null;

canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY, moved: drag.moved + Math.abs(dx) + Math.abs(dy) };
  turnY.target += dx * 0.009;
  turnX.target = clamp(turnX.target + dy * 0.006, -0.6, 0.6);
  lastTouch = performance.now();
});
const endDrag = () => {
  if (drag && drag.moved < 6) toggleFold();
  drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => (drag = null));

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    toggleFold();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    turnY.target += e.key === 'ArrowLeft' ? -0.5 : 0.5;
    lastTouch = performance.now();
  }
});

function toggleFold() {
  setPlaying(false);
  hinge.toggle();
}

// ---- Layout ----
function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  rig.resize(w, h);
  rig.reserveBottom = (controls.offsetHeight + 32) / h;
}
new ResizeObserver(resize).observe(canvas);
resize();

// ---- Frame loop ----
const DRIFT_BACK_AFTER = 2500; // ms after the last drag before the device turns back to face you
let previous = performance.now();

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  if (playing) {
    loopTime += dt;
    hinge.snap(loopFold(loopTime));
  } else {
    hinge.step(dt);
  }

  if (now - lastTouch > DRIFT_BACK_AFTER) {
    turnY.target = Math.round(turnY.value / (Math.PI * 2)) * Math.PI * 2;
    turnX.target = 0;
  }
  turnY.step(dt);
  turnX.step(dt);

  const open = hinge.openness;
  device.setFold(hinge.value);
  // The sticker wall appears on the back only once the device lies (almost) flat open.
  device.setBackMix(smootherstep((open - 0.9) / 0.1));
  device.root.rotation.set(turnX.value, turnY.value + (playing ? loopTurn(loopTime) : 0), 0);
  // Closed, the device covers only the fixed half; slide it so it stays centred.
  device.root.position.x = (HALF_W / 2) * (1 - open);
  shadow.mesh.scale.set(HALF_W * (1 + open) * 1.3, 1.6, 1);
  shadow.material.opacity = 0.55;

  if (document.activeElement !== range) range.value = String(Math.round(open * 1000));
  rig.update(open, 1, 0, 0, dt);
  renderer.render(scene, rig.camera);
});

hinge.snap(Math.PI);
if (!reducedMotion) setPlaying(true);
