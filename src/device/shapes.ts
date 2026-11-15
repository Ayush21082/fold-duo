import { BufferAttribute, BufferGeometry, Shape } from 'three';

export type Radii = { tl: number; tr: number; br: number; bl: number };

/**
 * Rounded rectangle with "continuous" corners: cubic handles a little longer than a
 * circular arc, which gives the softer, squircle-like curve of modern hardware.
 */
export function roundedRect(x0: number, y0: number, x1: number, y1: number, r: Radii | number, k = 0.62) {
  const c = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  const s = new Shape();
  s.moveTo(x0 + c.bl, y0);
  s.lineTo(x1 - c.br, y0);
  if (c.br) s.bezierCurveTo(x1 - c.br + c.br * k, y0, x1, y0 + c.br - c.br * k, x1, y0 + c.br);
  s.lineTo(x1, y1 - c.tr);
  if (c.tr) s.bezierCurveTo(x1, y1 - c.tr + c.tr * k, x1 - c.tr + c.tr * k, y1, x1 - c.tr, y1);
  s.lineTo(x0 + c.tl, y1);
  if (c.tl) s.bezierCurveTo(x0 + c.tl - c.tl * k, y1, x0, y1 - c.tl + c.tl * k, x0, y1 - c.tl);
  s.lineTo(x0, y0 + c.bl);
  if (c.bl) s.bezierCurveTo(x0, y0 + c.bl - c.bl * k, x0 + c.bl - c.bl * k, y0, x0 + c.bl, y0);
  return s;
}

/** Replace a geometry's UVs with a planar projection onto the box [x0..x1] × [y0..y1]. */
export function planarUV(g: BufferGeometry, x0: number, y0: number, x1: number, y1: number, mirrorX = false) {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - x0) / (x1 - x0);
    uv[i * 2] = mirrorX ? 1 - u : u;
    uv[i * 2 + 1] = (pos.getY(i) - y0) / (y1 - y0);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}
