// Cimática em fluidos. Cada nota faz o fluido vibrar num modo próprio, e a
// mesma nota desenha sempre a mesma figura, de dois jeitos:
//
// - Gota estrela: uma gota vibrada vira uma estrela de m pontas que alterna
//   com a estrela girada, r(θ) = R·(1 + A·cos(mθ)·cos(ωt)). Nota mais aguda,
//   mais pontas. Aplicado nas bolhas de cera e na superfície da poça.
// - Ondas de Faraday: um líquido vibrado de baixo forma ondas estacionárias
//   na superfície, a soma de n ondas planas em direções igualmente espaçadas:
//   n = 2 desenha quadrados, 3 hexágonos, 4 e 5 quase-cristais. Nota mais
//   aguda, onda mais curta.

import type { Note } from '../wallpaper/audio';
import { BANDS } from '../wallpaper/audio';

export const MODES = 24;
/** Quantos modos se somam ao mesmo tempo (acordes). */
export const ACTIVE = 3;

/** Quão rápido uma nota nova assume a figura (por leitura de áudio). */
const ATTACK = 0.35;
/** Quanto a nota anterior continua valendo; maior = troca mais rápida. */
const RELEASE = 0.06;

/** Direções da onda de Faraday por modo, num ciclo fixo. */
const FARADAY_DIRECTIONS = [2, 3, 4, 3, 2, 5, 3, 4];

export interface Mode {
  /** Pontas da gota estrela. */
  lobes: number;
  /** Direções das ondas de Faraday. */
  directions: number;
  /** Número de onda das ondas de Faraday (rad por altura de tela, antes da escala). */
  k: number;
  /** Ângulo fixo da figura de Faraday. */
  angle: number;
  /** Frequência visual da onda estacionária (rad/s). */
  omega: number;
}

export interface ActiveMode {
  mode: Mode;
  /** Peso no acorde; os pesos ativos somam 1. */
  weight: number;
  /** Fase temporal da onda estacionária. */
  phase: number;
}

function buildModes(): Mode[] {
  const modes: Mode[] = [];
  for (let i = 0; i < MODES; i++) {
    const t = i / (MODES - 1);
    modes.push({
      lobes: 2 + Math.round(t * 10),
      directions: FARADAY_DIRECTIONS[i % FARADAY_DIRECTIONS.length],
      k: 55 * Math.pow(3.2, t),
      // Ângulo pseudoaleatório fixo: a mesma nota sempre na mesma posição.
      angle: ((i * 2.399963) % Math.PI),
      omega: 4 + t * 7,
    });
  }
  return modes;
}

/** Curva do material: volume baixo quase não mexe; perto do máximo cresce mais. */
export function nonlinear(a: number): number {
  return (a + a * a * a) / 2;
}

export class Cymatics {
  readonly modes = buildModes();
  private readonly strength = new Float32Array(MODES);
  private readonly target = new Float32Array(MODES);
  private readonly phase = new Float32Array(MODES);
  /** Amplitude geral, de 0 a 1, já com a curva do material. */
  amplitude = 0;
  private volume = 0;
  readonly active: ActiveMode[] = [];

  /** Chamado a cada leitura de áudio (~30 por segundo). */
  hear(notes: Note[], energy: number): void {
    this.target.fill(0);
    for (const note of notes) {
      const i = Math.min(MODES - 1, Math.max(0, Math.floor((note.band / BANDS) * MODES)));
      this.target[i] = Math.max(this.target[i], note.strength);
    }
    for (let i = 0; i < MODES; i++) {
      const goal = this.target[i];
      const rate = goal > this.strength[i] ? ATTACK : RELEASE;
      this.strength[i] += (goal - this.strength[i]) * rate;
    }
    this.volume = energy;
  }

  /** Avança as fases e escolhe os modos mais fortes. `dt` em segundos. */
  update(dt: number, speed: number): void {
    for (let i = 0; i < MODES; i++) {
      this.phase[i] = (this.phase[i] + this.modes[i].omega * dt * speed) % (Math.PI * 2);
    }

    const order = Array.from({ length: MODES }, (_, i) => i)
      .sort((a, b) => this.strength[b] - this.strength[a])
      .slice(0, ACTIVE)
      .filter((i) => this.strength[i] > 0.002);
    const total = order.reduce((sum, i) => sum + this.strength[i], 0);

    this.active.length = 0;
    for (const i of order) {
      this.active.push({ mode: this.modes[i], weight: this.strength[i] / total, phase: this.phase[i] });
    }

    // A amplitude acompanha o volume e a nota mais forte, suavizada.
    const strongest = order.length ? this.strength[order[0]] : 0;
    const goal = nonlinear(Math.min(1, 0.5 * this.volume + 0.6 * strongest));
    const rate = goal > this.amplitude ? 10 : 2.5;
    this.amplitude += (goal - this.amplitude) * Math.min(1, rate * dt);
  }
}
