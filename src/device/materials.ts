import { Color, MeshPhysicalMaterial, type Texture } from 'three';

// Colourway: natural titanium frame, frosted champagne back, black glass front.
export function createMaterials() {
  const titanium = new MeshPhysicalMaterial({
    color: 0xc9c2b6,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.15,
  });

  // Black glass around the displays (and the body's flat faces).
  const bezel = new MeshPhysicalMaterial({
    color: 0x040405,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  // Frosted back glass: matte base under a soft clear coat.
  const backGlass = new MeshPhysicalMaterial({
    color: 0xd6cfc3,
    roughness: 0.58,
    clearcoat: 0.45,
    clearcoatRoughness: 0.42,
    sheen: 0.4,
    sheenColor: new Color(0xffffff),
    sheenRoughness: 0.6,
  });

  // Camera plateau: same tint, polished.
  const plateau = new MeshPhysicalMaterial({
    color: 0xcfc8bc,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });

  // Lens cover glass with an anti-reflective coating sheen.
  const lensGlass = new MeshPhysicalMaterial({
    color: 0x030406,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 1,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [180, 520],
  });

  const lensCore = new MeshPhysicalMaterial({ color: 0x000000, roughness: 0.35 });

  const flash = new MeshPhysicalMaterial({
    color: 0xf4ead8,
    roughness: 0.45,
    emissive: 0x2a2116,
    clearcoat: 1,
  });

  return { titanium, bezel, backGlass, plateau, lensGlass, lensCore, flash };
}

/** Display: glossy black glass whose pixels come from an emissive map. */
export function screenMaterial(map: Texture) {
  return new MeshPhysicalMaterial({
    color: 0x000000,
    roughness: 0.14,
    // No reflections on the display: even a faint studio reflection hazes
    // the swinging half grey and drowns the fold effect.
    specularIntensity: 0,
    envMapIntensity: 0,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0,
    // Pixels go out untouched, so the screen shows the picture's exact colours.
    toneMapped: false,
    // The glass sits a hair above the body. From far away (narrow, phone-width views) depth
    // precision can't separate them and the body tears through the picture; always win.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
}

export type Materials = ReturnType<typeof createMaterials>;
