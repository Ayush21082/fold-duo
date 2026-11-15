import {
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  PlaneGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  ShapeGeometry,
  type Material,
  type Texture,
} from 'three';
import { BEVEL, CORNER, COVER_BEZEL, H, HALF_W, INNER_BEZEL, T } from './dimensions.ts';
import { createMaterials, screenMaterial } from './materials.ts';
import { planarUV, roundedRect, type Radii } from './shapes.ts';
import { COVER_Z, INNER_Z, createFoldGlass } from './fold-glass.ts';

/*
  Layout (local space, device open, inner display facing +z):

    left half  x ∈ [-W, 0]      right half x ∈ [0, W]
    body z ∈ [-T, 0]; the inner display sits on z = 0.

  The hinge axis is the line x = 0, z = 0 (the display plane), so the two halves of the
  inner display always meet exactly at the crease. Folding rotates the right half by -fold
  around Y; at fold = π it lies on top of the left half, displays facing each other, and its
  back (the cover display) faces +z.
*/

const W = HALF_W;
const HINGE_R = 0.012; // small radius on the hinge-side corners

export type Device = ReturnType<typeof createDevice>;

export function createDevice(innerMap: Texture, coverMap: Texture, backArt?: Texture) {
  const m = createMaterials();
  const innerScreen = screenMaterial(innerMap);
  const coverScreen = screenMaterial(coverMap);
  const glass = createFoldGlass();
  // Blur at full turn-away: a fixed physical size (4% of the open display's width), converted
  // to each picture's own pixels.
  const blurWorld = 0.04 * (2 * W - 2 * INNER_BEZEL);
  const pxPerUnit = (t: Texture, width: number) => (t.image as HTMLCanvasElement).width / width;
  glass.apply(innerScreen, 'inner', innerMap, blurWorld * pxPerUnit(innerMap, 2 * W - 2 * INNER_BEZEL), CORNER - INNER_BEZEL);
  glass.apply(coverScreen, 'cover', coverMap, blurWorld * pxPerUnit(coverMap, W - 2 * COVER_BEZEL));
  if (backArt) glass.setBackArt(backArt);

  const root = new Group(); // pose (rotation / float) is applied here
  const body = new Group(); // re-centres the device as its footprint changes
  const left = new Group();
  const right = new Group();
  const spine = new Group();
  root.add(body);
  body.add(left, right, spine);

  const outer = CORNER - BEVEL;
  const leftR: Radii = { tl: outer, bl: outer, tr: HINGE_R, br: HINGE_R };
  const rightR: Radii = { tl: HINGE_R, bl: HINGE_R, tr: outer, br: outer };

  // ---- Bodies: rounded slabs with a rolled titanium edge ----
  const slab = (x0: number, x1: number, r: Radii) => {
    const depth = T - 2 * BEVEL;
    const g = new ExtrudeGeometry(roundedRect(x0, -H / 2 + BEVEL, x1, H / 2 - BEVEL, r), {
      depth,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 8,
      curveSegments: 32,
    });
    g.translate(0, 0, -(depth + BEVEL)); // span z ∈ [-T, 0]
    return new Mesh(g, [m.bezel, m.titanium]);
  };
  left.add(slab(-W + BEVEL, -BEVEL, leftR));
  right.add(slab(BEVEL, W - BEVEL, rightR));

  // ---- Inner display: one flexible panel across both halves; it bends around the hinge in
  // the vertex shader (see fold-glass.ts), so it lives in body space, not on either half. ----
  {
    const ix0 = -W + INNER_BEZEL;
    const ix1 = W - INNER_BEZEL;
    const iy = H / 2 - INNER_BEZEL;
    const g = new PlaneGeometry(ix1 - ix0, 2 * iy, 192, 1);
    g.translate(0, 0, INNER_Z);
    const panel = new Mesh(g, innerScreen);
    panel.frustumCulled = false; // vertices move in the shader
    body.add(panel);
  }

  // ---- Back faces (built facing +z, then flipped to face -z) ----
  const backFace = (x0: number, x1: number, y: number, r: Radii | number, mat: Material, uv = false) => {
    const g = new ShapeGeometry(roundedRect(x0, -y, x1, y, r), 32);
    g.rotateX(Math.PI); // faces -z; shape is symmetric in y so its outline is unchanged
    if (uv) planarUV(g, x0, -y, x1, y, true); // seen from behind, +x runs right-to-left
    g.translate(0, 0, COVER_Z); // baked in: the cover shader reads positions in the half's own space
    return new Mesh(g, mat);
  };
  // Left half: frosted glass back.
  left.add(backFace(-W + BEVEL, -BEVEL, H / 2 - BEVEL, leftR, m.backGlass));
  // Right half: the cover display.
  const cy = H / 2 - COVER_BEZEL;
  const cr = CORNER - COVER_BEZEL;
  right.add(backFace(COVER_BEZEL, W - COVER_BEZEL, cy, { tl: 0.18, bl: 0.18, tr: cr, br: cr }, coverScreen, true));

  // ---- Camera plateau on the left back, top corner nearest the hinge ----
  const cam = new Group();
  cam.position.set(-1.38, H / 2 - 0.78, -T);
  left.add(cam);
  {
    const pw = 1.95;
    const ph = 0.86;
    const depth = 0.05;
    const bt = 0.03;
    const g = new ExtrudeGeometry(roundedRect(-pw / 2, -ph / 2, pw / 2, ph / 2, ph / 2, 0.56), {
      depth,
      bevelEnabled: true,
      bevelThickness: bt,
      bevelSize: 0.03,
      bevelSegments: 6,
      curveSegments: 32,
    });
    g.rotateX(Math.PI); // extrude towards -z
    const plate = new Mesh(g, m.plateau);
    plate.position.z = bt; // tuck the inner bevel into the body
    cam.add(plate);
    const face = -(depth + bt) + bt; // outer face of the plateau, relative to cam

    const lens = (x: number) => {
      const lg = new Group();
      lg.position.set(x, 0, face);
      const ring = new Mesh(new CylinderGeometry(0.3, 0.31, 0.07, 64), m.titanium);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = -0.035;
      const glass = new Mesh(new CylinderGeometry(0.245, 0.245, 0.05, 64), m.lensGlass);
      glass.rotation.x = Math.PI / 2;
      glass.position.z = -0.03;
      const core = new Mesh(new CircleGeometry(0.11, 48), m.lensCore);
      core.rotation.x = Math.PI; // face -z
      core.position.z = -0.056;
      lg.add(ring, glass, core);
      return lg;
    };
    cam.add(lens(-0.5), lens(0.5));

    const flash = new Mesh(new CylinderGeometry(0.075, 0.075, 0.02, 32), m.flash);
    flash.rotation.x = Math.PI / 2;
    flash.position.set(0, 0.17, face - 0.008);
    const mic = new Mesh(new CircleGeometry(0.028, 24), m.lensCore);
    mic.rotation.x = Math.PI;
    mic.position.set(0, -0.2, face - 0.002);
    cam.add(flash, mic);
  }

  // ---- Buttons on the outer edges ----
  const button = (len: number, x: number, y: number, parent: Group) => {
    const b = new Mesh(new CapsuleGeometry(0.055, len, 8, 24), m.titanium);
    b.scale.set(1, 1, 0.75);
    b.position.set(x, y, -T / 2);
    parent.add(b);
  };
  button(0.62, W + 0.018, 1.35, right); // side button
  button(0.42, -W - 0.018, 1.75, left); // volume up
  button(0.42, -W - 0.018, 1.05, left); // volume down

  // ---- Hinge spine: a half cylinder that turns at half the fold angle ----
  {
    const g = new CylinderGeometry(T, T, H - 0.006, 64, 1, false, Math.PI / 2, Math.PI); // fills the groove between the halves
    spine.add(new Mesh(g, m.titanium)); // reads as part of the frame in the groove between the halves
  }

  /** fold: 0 = flat open, π = closed. */
  function setFold(fold: number) {
    right.rotation.y = -fold;
    spine.rotation.y = -fold / 2;
    // The left half never moves (as on the real device): nothing re-centres during the fold.
    glass.setFold(fold);
  }
  setFold(Math.PI);

  return {
    root,
    left,
    right,
    setFold,
    setInnerBrightness: (v: number) => (innerScreen.emissiveIntensity = v),
    setCoverBrightness: (v: number) => (coverScreen.emissiveIntensity = v),
    /** 0 = cover shows its screen … 1 = cover shows the back art (use while open). */
    setBackMix: (v: number) => glass.setBackMix(v),
  };
}
