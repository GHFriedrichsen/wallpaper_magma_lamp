// Cimática no ferrofluido. Sob um ímã, o ferrofluido levanta espinhos
// (instabilidade de Rosensweig) arrumados numa grade. Aqui cada nota escolhe a
// figura dessa grade, e a mesma nota desenha sempre a mesma figura:
//
// - Favo: espinhos numa grade hexagonal, como o ferrofluido faz sozinho sob
//   um campo uniforme.
// - Mandala: um espinho no centro e anéis com s, 2s, 3s... espinhos, como a
//   cimática vista de cima.
//
// Nota grave = poucos espinhos grandes; nota aguda = muitos espinhos pequenos.
// Quando a nota muda, os espinhos da figura velha afundam enquanto os da nova
// sobem.

import type { Note } from '../wallpaper/audio';
import { BANDS } from '../wallpaper/audio';

export const HEX = 0;
export const MANDALA = 1;

export interface Pattern {
  type: typeof HEX | typeof MANDALA;
  /** Distância entre espinhos, em raios da poça. */
  spacing: number;
  /** Mandala: espinhos no primeiro anel (o anel k tem k vezes isso). */
  symmetry: number;
  /** Mandala: quanto cada anel gira em relação ao anterior (fração do setor). */
  twist: number;
  /** Ângulo fixo da figura. */
  angle: number;
}

/** Figuras na ordem do grave para o agudo: [tipo, simetria]. */
const SHAPES: [Pattern['type'], number][] = [
  [MANDALA, 3], [MANDALA, 5], [HEX, 0], [MANDALA, 4],
  [MANDALA, 6], [HEX, 0], [MANDALA, 7], [MANDALA, 5],
  [HEX, 0], [MANDALA, 8], [MANDALA, 6], [HEX, 0],
  [MANDALA, 9], [MANDALA, 7], [HEX, 0], [MANDALA, 10],
];

/** Distância entre espinhos da nota mais grave e da mais aguda. */
const WIDEST = 0.34;
const DENSEST = 0.11;

export const PATTERNS: Pattern[] = SHAPES.map(([type, symmetry], i) => {
  const t = i / (SHAPES.length - 1);
  return {
    type,
    spacing: WIDEST * Math.pow(DENSEST / WIDEST, t),
    symmetry,
    twist: (i * 0.37) % 1,
    angle: (i * 0.41) % (Math.PI * 2),
  };
});

const FIXED: Record<'hex' | 'mandala', Pattern> = {
  hex: { type: HEX, spacing: 0.17, symmetry: 0, twist: 0, angle: 0 },
  mandala: { type: MANDALA, spacing: 0.18, symmetry: 6, twist: 0.5, angle: 0 },
};

/** Quão rápido a nota que soa ganha força (por leitura de áudio). */
const ATTACK = 0.35;
/** Quão rápido a nota que parou perde força. */
const RELEASE = 0.06;
/** Força mínima para uma nota trocar a figura. */
const MIN_STRENGTH = 0.2;
/** Tempo que uma nota precisa dominar antes de trocar a figura (s). */
const HOLD = 0.3;
/** Duração da troca de figura (s). */
const MORPH = 0.7;

export class Patterns {
  private readonly strength = new Float32Array(PATTERNS.length);
  private readonly target = new Float32Array(PATTERNS.length);
  private current = 0;
  private previous = 0;
  /** De 0 (só a figura anterior) a 1 (só a atual). */
  private blend = 1;
  private candidate = -1;
  private held = 0;

  /** Chamado a cada leitura de áudio (~30 por segundo). */
  hear(notes: Note[]): void {
    this.target.fill(0);
    for (const note of notes) {
      const i = Math.min(PATTERNS.length - 1, Math.max(0, Math.floor((note.band / BANDS) * PATTERNS.length)));
      this.target[i] = Math.max(this.target[i], note.strength);
    }
    for (let i = 0; i < PATTERNS.length; i++) {
      const goal = this.target[i];
      this.strength[i] += (goal - this.strength[i]) * (goal > this.strength[i] ? ATTACK : RELEASE);
    }
  }

  update(dt: number, speed: number): void {
    let dominant = 0;
    for (let i = 1; i < PATTERNS.length; i++) if (this.strength[i] > this.strength[dominant]) dominant = i;

    if (dominant !== this.current && this.strength[dominant] > MIN_STRENGTH) {
      this.held = dominant === this.candidate ? this.held + dt * speed : 0;
      this.candidate = dominant;
      if (this.held > HOLD) {
        // No meio de uma troca, a figura que estava mais visível vira a anterior.
        this.previous = this.blend > 0.5 ? this.current : this.previous;
        this.current = dominant;
        this.blend = 0;
        this.held = 0;
      }
    } else {
      this.held = 0;
    }
    this.blend = Math.min(1, this.blend + (dt * speed) / MORPH);
  }

  /** Figura anterior, figura atual e quanto da atual aparece (0 a 1). */
  shapes(mode: 'notes' | 'hex' | 'mandala'): [Pattern, Pattern, number] {
    if (mode !== 'notes') return [FIXED[mode], FIXED[mode], 1];
    const b = this.blend;
    return [PATTERNS[this.previous], PATTERNS[this.current], b * b * (3 - 2 * b)];
  }
}
