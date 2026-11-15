import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type WebGLRenderer,
} from 'three';

/**
 * A procedural photo studio rendered into an environment map: a large overhead softbox,
 * two tall strip lights and a rim light, in a black room. Metal and glass pick up these
 * shapes as long, clean highlights, which is what makes product renders read as "real".
 */
export function studioEnvironment(renderer: WebGLRenderer) {
  const studio = new Scene();
  studio.background = new Color(0x010102);
  const panel = (w: number, h: number, power: number, x: number, y: number, z: number, tint = 0xffffff) => {
    const mesh = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(tint).multiplyScalar(power), side: DoubleSide, toneMapped: false }),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  };
  panel(7, 5, 3.2, 0, 9, 1); // overhead softbox
  panel(1.1, 12, 9, -8, 0.5, 2.5); // key strip, left
  panel(0.8, 12, 6, 8, 0.5, -1.5, 0xfff1e0); // warm strip, right
  panel(12, 0.9, 5, 0, 3, -9); // rim from behind
  panel(9, 3, 0.5, 0, -2, 10, 0xdfe8ff); // faint cool front fill
  panel(20, 20, 0.04, 0, -9, 0); // floor bounce

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, 0.025).texture;
  pmrem.dispose();
  return texture;
}

/** Soft contact shadow under the device (a blurred ellipse on an invisible floor). */
export function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const mat = new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, material: mat };
}
