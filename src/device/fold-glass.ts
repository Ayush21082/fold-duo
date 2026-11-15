import { Vector2, Vector4, type MeshPhysicalMaterial, type Texture } from 'three';
import { COVER_BEZEL, H, HALF_W, INNER_BEZEL, T } from './dimensions.ts';

/*
  Display shading for the fold.

  Body space: the hinge is the line x = 0, z = 0. The left half never moves; the right half
  turns about the hinge (three.js rotation.y = −fold; 0 = flat open, π = closed), which takes
  a right-half point (x, z) to turnAboutHinge((x, z), fold).

  Screen lock. Each display reads its picture through a front-on orthographic view of the
  device: a fragment's body-space (x, y) picks the pixel. While a half turns, its picture
  stays put and the glass sweeps across it, so the content seems to float in place as the
  device opens. The cover's picture is pinned to the cover's hinge-side edge instead of the
  open frame, so it slides away with that edge.

  Turn-away. As a half turns away from the viewer its far side dims and softens, scaled by
  how foreshortened the glass is (1 − cos tilt) and by the distance from the hinge.

  Back art. When the device lies open the cover faces away, and its screen-locked picture
  has slid off the glass. It can then show a second picture laid flat on the glass, mapped
  by the cover's own UVs so it reads from any angle (a sticker wall, say).

  Hinge strip. The inner panel is one flexible sheet. Within FLEX_HALF of the hinge it
  follows a quadratic Bézier whose middle control point sits on the hinge line, rotated by
  half the fold, so the strip leaves the fixed half and meets the turning half tangentially.
*/

const W = HALF_W;
const INNER_W = 2 * W - 2 * INNER_BEZEL;
/** Half-width of the inner panel's flexible strip around the hinge. */
export const FLEX_HALF = 0.02 * INNER_W;
/** z of the inner glass (body space) and of the cover glass (right-half local space). */
export const INNER_Z = 0.0015;
export const COVER_Z = -T - 0.0012;
/** Strongest dimming at the far edge of a fully turned half (0 = none, 1 = black). */
const MAX_DIM = 0.92;

const ROTATE = /* glsl */ `
uniform float uFoldAngle;
vec2 turnAboutHinge(vec2 p, float angle) {
  float c = cos(angle), s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
`;

const BEND = /* glsl */ `
// Inner panel vertex (x, z) → bent (x, z) and the unit tangent along the panel.
void bendPanel(vec2 p, out vec2 bent, out vec2 tangent) {
  float h = ${FLEX_HALF.toFixed(5)};
  if (p.x <= -h) { bent = p; tangent = vec2(1.0, 0.0); return; }
  if (p.x >= h) {
    bent = turnAboutHinge(p, uFoldAngle);
    tangent = vec2(cos(uFoldAngle), sin(uFoldAngle));
    return;
  }
  vec2 a = vec2(-h, p.y);
  vec2 b = turnAboutHinge(vec2(h, p.y), uFoldAngle);
  vec2 c = turnAboutHinge(vec2(0.0, p.y), 0.5 * uFoldAngle);
  float t = (p.x + h) / (2.0 * h);
  float u = 1.0 - t;
  bent = u * u * a + 2.0 * u * t * c + t * t * b;
  vec2 d = 2.0 * u * (c - a) + 2.0 * t * (b - c);
  tangent = length(d) > 1e-6 ? normalize(d) : vec2(cos(uFoldAngle), sin(uFoldAngle));
}
`;

const SHADE = /* glsl */ `
uniform sampler2D uScreenMap;
uniform vec2 uTexel;       // 1 / picture size
uniform vec4 uRect;        // picture rectangle in body space: xy = min corner, zw = size
uniform float uMaxBlur;    // blur radius at full turn-away, in picture pixels
varying vec3 vBodyPos;
varying vec2 vPanelPos;
varying float vTilt;       // how far this bit of glass has turned from facing the viewer

float insideRect(vec2 uv, vec2 soft) {
  vec2 lo = smoothstep(-soft, soft, uv);
  vec2 hi = 1.0 - smoothstep(1.0 - soft, 1.0 + soft, uv);
  return lo.x * lo.y * hi.x * hi.y;
}

vec3 sampleScreen() {
  vec2 uv = (vBodyPos.xy - uRect.xy) / uRect.zw;
#ifdef INNER_PANEL
  float fromHinge = clamp(vPanelPos.x / ${(W - INNER_BEZEL).toFixed(4)}, 0.0, 1.0);
#else
  vec2 edge = turnAboutHinge(vec2(${COVER_BEZEL.toFixed(4)}, ${COVER_Z.toFixed(4)}), uFoldAngle);
  uv.x = 1.0 + (vBodyPos.x - edge.x) / uRect.z;
  float fromHinge = clamp(1.0 - uv.x, 0.0, 1.0);
#endif
  float foreshorten = 1.0 - cos(clamp(vTilt, 0.0, 1.5707963));
  float away = foreshorten * fromHinge * fromHinge;

  vec2 soft = max(fwidth(uv), uTexel * 0.5);
  float footprint = max(length(dFdx(uv) / uTexel), length(dFdy(uv) / uTexel));
  float radius = uMaxBlur * away;
  float lod = log2(max(1.0, max(footprint, radius * 0.8)));

  vec3 color = textureLod(uScreenMap, clamp(uv, 0.0, 1.0), lod).rgb;
  if (radius <= 0.5) {
    color *= insideRect(uv, soft);
  } else {
    // Centre plus an 8-tap golden-angle spiral; the mip level smooths between taps. The
    // edge mask widens with the blur so the picture bleeds softly into the bezel.
    vec2 edgeSoft = max(soft, uTexel * radius * 0.6);
    vec3 sum = color * insideRect(uv, edgeSoft);
    for (int i = 1; i <= 8; i++) {
      float r = sqrt(float(i) / 8.0) * radius;
      float a = float(i) * 2.3999632;
      vec2 s = uv + vec2(cos(a), sin(a)) * r * uTexel;
      sum += textureLod(uScreenMap, clamp(s, 0.0, 1.0), lod).rgb * insideRect(s, edgeSoft);
    }
    color = sum / 9.0;
  }
  return color * (1.0 - ${MAX_DIM.toFixed(2)} * smoothstep(0.0, 1.0, away));
}
`;

export type FoldGlass = ReturnType<typeof createFoldGlass>;

export function createFoldGlass() {
  const foldAngle = { value: Math.PI };
  // Until back art is set, the sampler points at the cover's own picture (it is never mixed in).
  const backMap: { value: Texture | null } = { value: null };
  const backMix = { value: 0 };

  /**
   * Patch a display material.
   * inner: one mesh in body space spanning the whole open display (it bends at the hinge).
   * cover: the cover glass, geometry in the right half's local space.
   */
  function apply(material: MeshPhysicalMaterial, kind: 'inner' | 'cover', picture: Texture, maxBlurPx: number, cornerRadius = 0) {
    const image = picture.image as { width: number; height: number };
    const rect =
      kind === 'inner'
        ? new Vector4(-W + INNER_BEZEL, -H / 2 + INNER_BEZEL, INNER_W, H - 2 * INNER_BEZEL)
        : new Vector4(0, -H / 2 + COVER_BEZEL, W - 2 * COVER_BEZEL, H - 2 * COVER_BEZEL);
    const uniforms = {
      uFoldAngle: foldAngle,
      uScreenMap: { value: picture },
      uTexel: { value: new Vector2(1 / image.width, 1 / image.height) },
      uRect: { value: rect },
      uMaxBlur: { value: maxBlurPx },
      ...(kind === 'cover' && { uBackMap: backMap, uBackMix: backMix }),
    };
    const inner = kind === 'inner';
    if (!inner) backMap.value ??= picture;
    material.customProgramCacheKey = () => `fold-glass-${kind}`;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      const varyings = 'varying vec3 vBodyPos;\nvarying vec2 vPanelPos;\nvarying float vTilt;';
      let vs = shader.vertexShader.replace('#include <common>', `#include <common>\n${ROTATE}\n${inner ? BEND : ''}\n${varyings}`);
      if (inner) {
        vs = vs
          .replace(
            '#include <beginnormal_vertex>',
            `vec2 panelBent, panelTangent;
bendPanel(position.xz, panelBent, panelTangent);
vec3 objectNormal = vec3(panelTangent.x * normal.x - panelTangent.y * normal.z, normal.y, panelTangent.y * normal.x + panelTangent.x * normal.z);`,
          )
          .replace(
            '#include <begin_vertex>',
            `vec3 transformed = vec3(panelBent.x, position.y, panelBent.y);
vBodyPos = transformed;
vPanelPos = position.xy;
vTilt = atan(panelTangent.y, panelTangent.x);`,
          );
      } else {
        vs = vs.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vec2 coverXZ = turnAboutHinge(transformed.xz, uFoldAngle);
vBodyPos = vec3(coverXZ.x, transformed.y, coverXZ.y);
vPanelPos = position.xy;
vTilt = 3.14159265 - uFoldAngle;`,
        );
      }
      shader.vertexShader = vs;

      const corners = inner
        ? `vec2 q = abs(vPanelPos) - vec2(${(W - INNER_BEZEL).toFixed(4)}, ${(H / 2 - INNER_BEZEL).toFixed(4)}) + ${cornerRadius.toFixed(4)};
  if (length(max(q, 0.0)) > ${cornerRadius.toFixed(4)}) discard;`
        : '';
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\n${inner ? '#define INNER_PANEL' : 'uniform sampler2D uBackMap;\nuniform float uBackMix;'}\n${ROTATE}\n${SHADE}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          inner
            ? `{\n  ${corners}\n  totalEmissiveRadiance *= sampleScreen();\n}`
            : `{
  vec3 screen = uBackMix < 1.0 ? sampleScreen() : vec3(0.0);
  vec3 back = uBackMix > 0.0 ? texture2D(uBackMap, vEmissiveMapUv).rgb : vec3(0.0);
  totalEmissiveRadiance *= mix(screen, back, uBackMix);
}`,
        );
    };
    material.needsUpdate = true;
  }

  return {
    apply,
    /** 0 = flat open … π = closed. */
    setFold(angle: number) {
      foldAngle.value = angle;
    },
    /** Cover only: the picture shown flat on the glass while the device lies open. */
    setBackArt(map: Texture) {
      backMap.value = map;
    },
    /** Cover only: 0 = screen-locked picture … 1 = back art. */
    setBackMix(v: number) {
      backMix.value = v;
    },
  };
}
