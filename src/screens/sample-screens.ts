import { CanvasTexture, SRGBColorSpace, type WebGLRenderer } from 'three';
import { COVER_BEZEL, H, HALF_W, INNER_BEZEL } from '../device/dimensions.ts';

/*
  Placeholder pictures for the two displays, painted with Canvas 2D. Replace them with your
  own canvases (or video / image textures) of the same aspect ratio.
*/

const PX_PER_UNIT = 200;
const INNER_SIZE = [(2 * HALF_W - 2 * INNER_BEZEL) * PX_PER_UNIT, (H - 2 * INNER_BEZEL) * PX_PER_UNIT].map(Math.round);
const COVER_SIZE = [(HALF_W - 2 * COVER_BEZEL) * PX_PER_UNIT, (H - 2 * COVER_BEZEL) * PX_PER_UNIT].map(Math.round);

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const TILES = ['#ff7a59', '#ffb547', '#5fd38d', '#41b6ff', '#7d6bff', '#ff5fa2', '#2fd1c5', '#f2f2f2'];

function canvas([w, h]: number[]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function wallpaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#0d1424');
  base.addColorStop(0.55, '#241631');
  base.addColorStop(1, '#a8532d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.75, h * 1.05, 0, w * 0.75, h * 1.05, h * 0.9);
  glow.addColorStop(0, 'rgba(255, 170, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 170, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function paintCover() {
  const { c, ctx } = canvas(COVER_SIZE);
  const [w, h] = COVER_SIZE;
  wallpaper(ctx, w, h);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `500 ${w * 0.06}px ${FONT}`;
  ctx.fillText('Tuesday, 9 June', w / 2, h * 0.17);
  ctx.font = `600 ${w * 0.26}px ${FONT}`;
  ctx.fillText('9:41', w / 2, h * 0.34);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 ${w * 0.045}px ${FONT}`;
  ctx.fillText('Unfold to open', w / 2, h * 0.93);
  return c;
}

function paintInner() {
  const { c, ctx } = canvas(INNER_SIZE);
  const [w, h] = INNER_SIZE;
  wallpaper(ctx, w, h);

  // Left page: a headline and a card.
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${h * 0.085}px ${FONT}`;
  ctx.fillText('Fold Duo', w * 0.06, h * 0.22);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `400 ${h * 0.032}px ${FONT}`;
  ctx.fillText('A foldable phone in three.js.', w * 0.06, h * 0.3);
  ctx.fillText('Drag to turn it. Scrub to fold it.', w * 0.06, h * 0.35);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(w * 0.06, h * 0.58, w * 0.36, h * 0.3, h * 0.04);
  ctx.fill();

  // Right page: a grid of app tiles.
  const size = w * 0.075;
  const gap = w * 0.03;
  const x0 = w * 0.55;
  const y0 = h * 0.14;
  TILES.forEach((color, i) => {
    const x = x0 + (i % 4) * (size + gap);
    const y = y0 + Math.floor(i / 4) * (size + gap * 1.6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, size * 0.24);
    ctx.fill();
  });
  return c;
}

/** Draws `shape` as a die-cut sticker: white border, soft lift shadow, then the art. */
function sticker(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, border: number, shape: () => void, art: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = border * 2.4;
  ctx.shadowOffsetY = border;
  ctx.fillStyle = '#f6f3ee';
  ctx.strokeStyle = '#f6f3ee';
  ctx.lineWidth = border * 2;
  ctx.lineJoin = 'round';
  shape();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  art();
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
}

/** The back of the cover while the device lies open: a sticker wall on graphite glass. */
function paintBackArt() {
  const { c, ctx } = canvas(COVER_SIZE);
  const [w, h] = COVER_SIZE;
  ctx.fillStyle = '#141416';
  ctx.fillRect(0, 0, w, h);
  const sheen = ctx.createRadialGradient(w * 0.25, h * 0.15, 0, w * 0.25, h * 0.15, h * 0.75);
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const u = w / 100; // layout unit: 1% of the width
  const edge = 1.6 * u;
  const label = (text: string, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, size * 0.05);
  };
  const roundRect = (rw: number, rh: number, r: number) => () => {
    ctx.beginPath();
    ctx.roundRect(-rw / 2, -rh / 2, rw, rh, r);
  };
  const circle = (r: number) => () => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  };

  // "60 fps" pill.
  sticker(ctx, w * 0.36, h * 0.16, -0.12, edge, roundRect(44 * u, 18 * u, 9 * u), () => {
    roundRect(44 * u, 18 * u, 9 * u)();
    ctx.fillStyle = '#ff7a45';
    ctx.fill();
    label('60 fps', 9 * u, '#1b0d05');
  });
  // Star.
  sticker(ctx, w * 0.74, h * 0.27, 0.2, edge, () => star(ctx, 15 * u), () => {
    star(ctx, 15 * u);
    ctx.fillStyle = '#ffc93c';
    ctx.fill();
  });
  // GLSL tile.
  sticker(ctx, w * 0.32, h * 0.42, 0.1, edge, roundRect(34 * u, 34 * u, 8 * u), () => {
    roundRect(34 * u, 34 * u, 8 * u)();
    ctx.fillStyle = '#3d7bff';
    ctx.fill();
    label('GLSL', 9 * u, '#fff');
  });
  // Smiley.
  sticker(ctx, w * 0.72, h * 0.55, -0.15, edge, circle(17 * u), () => {
    circle(17 * u)();
    ctx.fillStyle = '#4fd18b';
    ctx.fill();
    ctx.fillStyle = '#0d2a1a';
    ctx.beginPath();
    ctx.arc(-5.5 * u, -4 * u, 2.2 * u, 0, Math.PI * 2);
    ctx.arc(5.5 * u, -4 * u, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.4 * u;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0d2a1a';
    ctx.beginPath();
    ctx.arc(0, 1 * u, 8 * u, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  });
  // three.js disc.
  sticker(ctx, w * 0.34, h * 0.69, -0.08, edge, circle(20 * u), () => {
    circle(20 * u)();
    ctx.fillStyle = '#18181b';
    ctx.fill();
    label('three.js', 7.5 * u, '#f6f3ee');
  });
  // "fold me" label.
  sticker(ctx, w * 0.66, h * 0.82, 0.14, edge, roundRect(46 * u, 15 * u, 3 * u), () => {
    roundRect(46 * u, 15 * u, 3 * u)();
    ctx.fillStyle = '#ff5fa2';
    ctx.fill();
    label('fold me ↺', 7.5 * u, '#2a0716');
  });
  return c;
}

export function createSampleScreens(renderer: WebGLRenderer) {
  const texture = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  return { inner: texture(paintInner()), cover: texture(paintCover()), back: texture(paintBackArt()) };
}
