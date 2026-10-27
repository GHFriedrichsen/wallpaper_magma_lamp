// Cores das luzes que o ferrofluido reflete. O fluido é quase preto e
// espelhado: a cor da cena vem toda das luzes e do fundo.

export type RGB = [number, number, number];

export interface Palette {
  light1: RGB;
  light2: RGB;
  light3: RGB;
  background: RGB;
}

const KEYS = ['light1', 'light2', 'light3', 'background'] as const;

export const PRESETS: Record<string, Palette> = {
  aurora: { light1: [0.1, 0.8, 1], light2: [1, 0.15, 0.65], light3: [0.5, 0.3, 1], background: [0.012, 0.012, 0.025] },
  fire: { light1: [1, 0.45, 0.05], light2: [1, 0.1, 0.05], light3: [1, 0.8, 0.4], background: [0.025, 0.008, 0.005] },
  ice: { light1: [0.4, 0.75, 1], light2: [0.9, 0.95, 1], light3: [0.1, 0.3, 1], background: [0.008, 0.015, 0.03] },
  gold: { light1: [1, 0.75, 0.3], light2: [1, 0.55, 0.15], light3: [1, 0.95, 0.8], background: [0.02, 0.015, 0.008] },
  neon: { light1: [0.3, 1, 0.3], light2: [0.7, 0.2, 1], light3: [0.1, 0.9, 0.8], background: [0.01, 0.015, 0.015] },
  studio: { light1: [1, 1, 1], light2: [0.85, 0.88, 0.95], light3: [0.6, 0.6, 0.65], background: [0.02, 0.02, 0.022] },
};

export function clonePalette(p: Palette): Palette {
  return { light1: [...p.light1], light2: [...p.light2], light3: [...p.light3], background: [...p.background] };
}

function luminance(c: RGB): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Puxa a cor para longe do cinza e para o brilho máximo: luz, não tinta. */
function asLight(c: RGB): RGB {
  const l = luminance(c);
  const sat = c.map((v) => Math.max(0, l + (v - l) * 1.4)) as RGB;
  const peak = Math.max(...sat, 1e-3);
  return sat.map((v) => Math.min(1, v / peak)) as RGB;
}

/** Luzes a partir das cores da capa da música. */
export function paletteFromMedia(primary: RGB, secondary: RGB): Palette {
  const a = asLight(primary);
  const b = asLight(secondary);
  return {
    light1: a,
    light2: b,
    light3: [(a[0] + b[0]) / 2 + 0.2, (a[1] + b[1]) / 2 + 0.2, (a[2] + b[2]) / 2 + 0.2].map((v) => Math.min(1, v)) as RGB,
    background: [a[0] * 0.025 + 0.005, a[1] * 0.025 + 0.005, a[2] * 0.025 + 0.008],
  };
}

/** Aproxima `current` de `target`; `t` de 0 a 1 por quadro. */
export function approachPalette(current: Palette, target: Palette, t: number): void {
  for (const key of KEYS) {
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
    light1: rotateHue(p.light1, angle),
    light2: rotateHue(p.light2, angle),
    light3: rotateHue(p.light3, angle),
    background: rotateHue(p.background, angle),
  };
}
