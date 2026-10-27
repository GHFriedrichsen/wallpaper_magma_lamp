// Esquemas de cores e transições suaves entre eles.

export type RGB = [number, number, number];

export interface Palette {
  /** Cor da cera. */
  wax: RGB;
  /** Cor do núcleo quente da cera. */
  hot: RGB;
  /** Líquido no alto da lâmpada. */
  top: RGB;
  /** Líquido embaixo, perto da lâmpada que aquece. */
  bottom: RGB;
  /** Halo em volta da cera. */
  glow: RGB;
}

export const PRESETS: Record<string, Palette> = {
  classic: { wax: [1, 0.3, 0.04], hot: [1, 0.75, 0.25], top: [0.06, 0.01, 0.1], bottom: [0.3, 0.03, 0.2], glow: [1, 0.3, 0.1] },
  magma: { wax: [0.85, 0.08, 0.02], hot: [1, 0.6, 0.1], top: [0.01, 0.005, 0.005], bottom: [0.14, 0.02, 0.01], glow: [1, 0.15, 0.02] },
  ocean: { wax: [0.1, 0.75, 0.85], hot: [0.75, 1, 0.95], top: [0.01, 0.03, 0.12], bottom: [0.02, 0.15, 0.3], glow: [0.1, 0.6, 1] },
  neon: { wax: [1, 0.1, 0.65], hot: [1, 0.7, 0.95], top: [0.02, 0, 0.08], bottom: [0.05, 0.1, 0.35], glow: [0.4, 0.2, 1] },
  sunset: { wax: [1, 0.55, 0.15], hot: [1, 0.92, 0.6], top: [0.25, 0.05, 0.25], bottom: [0.85, 0.3, 0.28], glow: [1, 0.5, 0.3] },
  acid: { wax: [0.55, 1, 0.1], hot: [0.95, 1, 0.6], top: [0.02, 0.06, 0.02], bottom: [0.1, 0.05, 0.25], glow: [0.4, 1, 0.2] },
  lavender: { wax: [0.75, 0.55, 1], hot: [1, 0.9, 1], top: [0.08, 0.05, 0.18], bottom: [0.3, 0.2, 0.45], glow: [0.8, 0.5, 1] },
  mercury: { wax: [0.7, 0.72, 0.78], hot: [1, 1, 1], top: [0.03, 0.03, 0.05], bottom: [0.12, 0.12, 0.16], glow: [0.6, 0.7, 1] },
};

export function clonePalette(p: Palette): Palette {
  return { wax: [...p.wax], hot: [...p.hot], top: [...p.top], bottom: [...p.bottom], glow: [...p.glow] };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function scale(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

function luminance(c: RGB): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Puxa a cor para longe do cinza, para a cera não ficar apagada. */
function saturate(c: RGB, k: number): RGB {
  const l = luminance(c);
  return [c[0], c[1], c[2]].map((v) => Math.max(0, Math.min(1, l + (v - l) * k))) as RGB;
}

/**
 * Paleta a partir das cores da capa da música: a cor principal vira a cera e
 * a secundária, escurecida, vira o líquido.
 */
export function paletteFromMedia(primary: RGB, secondary: RGB): Palette {
  const wax = saturate(primary, 1.3);
  const liquid = saturate(secondary, 1.2);
  // Se as duas cores forem parecidas, o líquido usa o complemento da cera.
  const same = Math.abs(luminance(wax) - luminance(liquid)) < 0.08 &&
    Math.hypot(wax[0] - liquid[0], wax[1] - liquid[1], wax[2] - liquid[2]) < 0.25;
  const base = same ? ([1 - wax[0], 1 - wax[1], 1 - wax[2]] as RGB) : liquid;
  return {
    wax,
    hot: mix(wax, [1, 1, 0.9], 0.65),
    top: scale(base, 0.12),
    bottom: scale(base, 0.45),
    glow: mix(wax, [1, 1, 1], 0.1),
  };
}

/** Aproxima `current` de `target`; `t` de 0 a 1 por quadro. */
export function approachPalette(current: Palette, target: Palette, t: number): void {
  for (const key of ['wax', 'hot', 'top', 'bottom', 'glow'] as const) {
    const c = current[key];
    const g = target[key];
    for (let i = 0; i < 3; i++) c[i] += (g[i] - c[i]) * t;
  }
}

/** Gira o matiz de uma cor (em radianos), mantendo a luminosidade. */
export function rotateHue(c: RGB, angle: number): RGB {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const k = 1 / 3;
  const s = Math.sqrt(k);
  const a = cos + (1 - cos) * k;
  const b = k * (1 - cos) - s * sin;
  const d = k * (1 - cos) + s * sin;
  return [
    Math.max(0, c[0] * a + c[1] * b + c[2] * d),
    Math.max(0, c[0] * d + c[1] * a + c[2] * b),
    Math.max(0, c[0] * b + c[1] * d + c[2] * a),
  ];
}

export function rotatePalette(p: Palette, angle: number): Palette {
  return {
    wax: rotateHue(p.wax, angle),
    hot: rotateHue(p.hot, angle),
    top: rotateHue(p.top, angle),
    bottom: rotateHue(p.bottom, angle),
    glow: rotateHue(p.glow, angle),
  };
}
