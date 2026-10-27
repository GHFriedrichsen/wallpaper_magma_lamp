// Cimática na esfera: cada nota faz a esfera vibrar num modo próprio, uma
// onda estacionária descrita por um harmônico esférico Y(l, m), na forma real
// e sem a constante de normalização:
//
//   Y(θ, φ) = P_l^m(cos θ) · cos(m φ)
//
// l = quantas linhas nodais (nota mais aguda, l maior); m = tipo de figura
// (0 anéis, l gomos, no meio grade). Mesmo modelo do wallpaper Grãos: 36
// modos de l = 2 a 11; até l = 5 todas as variações de m, de 6 em diante só
// anéis, grade e gomos.

import type { Note } from '../wallpaper/audio';
import { BANDS } from '../wallpaper/audio';

export interface Mode {
  l: number;
  m: number;
}

function buildModes(): Mode[] {
  const modes: Mode[] = [];
  for (let l = 2; l <= 11; l++) {
    const ms = l <= 5 ? Array.from({ length: l + 1 }, (_, m) => m) : [0, Math.floor(l / 2), l];
    for (const m of ms) modes.push({ l, m });
  }
  return modes;
}

export const MODES = buildModes();
/** Quantos modos se somam ao mesmo tempo (acordes). */
export const ACTIVE = 3;

/** Quão rápido uma nota nova assume a figura (por leitura de áudio). */
const ATTACK = 0.35;
/** Quanto a nota anterior continua valendo; maior = troca mais rápida. */
const RELEASE = 0.06;

/** Polinômio associado de Legendre P_l^m(x), pela recorrência padrão. */
export function legendre(l: number, m: number, x: number): number {
  let pmm = 1;
  const s = Math.sqrt(Math.max(0, 1 - x * x));
  for (let i = 1; i <= m; i++) pmm *= (2 * i - 1) * s;
  if (l === m) return pmm;
  let pmm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmm1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmm1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmm1;
    pmm1 = pll;
  }
  return pll;
}

/** Curva do material: volume baixo quase não mexe; perto do máximo cresce mais. */
export function nonlinear(a: number): number {
  return (a + a * a * a) / 2;
}

export interface ActiveMode {
  index: number;
  /** Peso no acorde; os pesos ativos somam 1. */
  weight: number;
}

export class Harmonics {
  private readonly strength = new Float32Array(MODES.length);
  private readonly target = new Float32Array(MODES.length);
  private volume = 0;
  /** Amplitude geral, de 0 a 1, já com a curva do material. */
  amplitude = 0;
  readonly active: ActiveMode[] = [];

  /** Chamado a cada leitura de áudio (~30 por segundo). */
  hear(notes: Note[], energy: number): void {
    this.target.fill(0);
    for (const note of notes) {
      const i = Math.min(MODES.length - 1, Math.max(0, Math.floor((note.band / BANDS) * MODES.length)));
      this.target[i] = Math.max(this.target[i], note.strength);
    }
    for (let i = 0; i < MODES.length; i++) {
      const goal = this.target[i];
      this.strength[i] += (goal - this.strength[i]) * (goal > this.strength[i] ? ATTACK : RELEASE);
    }
    this.volume = energy;
  }

  update(dt: number): void {
    const order = Array.from({ length: MODES.length }, (_, i) => i)
      .sort((a, b) => this.strength[b] - this.strength[a])
      .slice(0, ACTIVE)
      .filter((i) => this.strength[i] > 0.002);
    const total = order.reduce((sum, i) => sum + this.strength[i], 0);
    this.active.length = 0;
    for (const i of order) this.active.push({ index: i, weight: this.strength[i] / total });

    const strongest = order.length ? this.strength[order[0]] : 0;
    const goal = nonlinear(Math.min(1, 0.5 * this.volume + 0.6 * strongest));
    const rate = goal > this.amplitude ? 8 : 1.5;
    this.amplitude += (goal - this.amplitude) * Math.min(1, rate * dt);
  }
}
