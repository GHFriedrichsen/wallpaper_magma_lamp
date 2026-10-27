// Esfera geodésica de fluido denso. A superfície é dividida em células
// (Voronoi de pontos em anéis de latitude, o mesmo arranjo que o shader
// refaz). Cada célula é uma janela que o som abre: onde a vibração da nota é
// forte (ventres) a célula vira buraco; nas linhas nodais o fluido fica
// fechado. Sem som todas fecham e a esfera fica lisa.
//
// Dos buracos mais abertos saem gotas que sobem, perdem velocidade e caem de
// volta na esfera.

import { MODES, legendre, type Harmonics } from './harmonics';
import { add, normalize, type Vec3 } from '../ferro/math3';

/** Lado da textura com a abertura de cada célula (linha = anel, coluna = célula). */
export const CELL_TEX = 64;
export const MAX_DROPS = 24;
/** Giro das células de um anel em relação ao anterior, em fração do setor. */
export const TWIST = 0.5;
/** Inclinação do eixo das figuras: com o polo quase de frente, a figura vira mandala. */
const TILT = 1.25;
/** Aceleração que puxa as gotas de volta, em raios/s². */
const GRAVITY = 4;

interface Drop {
  /** Posição em relação ao centro da esfera, em unidades do mundo. */
  rel: Vec3;
  vel: Vec3;
  radius: number;
  age: number;
}

export interface GeoInput {
  harmonics: Harmonics;
  /** Raio da esfera no mundo. */
  radius: number;
  /** Leva direções do mundo para o referencial da esfera (coluna). */
  rotation: Float32Array;
  /** Quanto os buracos abrem (0 a 1,5). */
  holeSize: number;
  /** Abertura mínima, mesmo em silêncio (0 a 1). */
  idle: number;
  /** Quantidade de gotas (0 a 3). */
  drops: number;
  /** Altura das gotas (0,2 a 3). */
  dropHeight: number;
  beat: number;
  energy: number;
}

export class Geodesic {
  /** Distância angular entre células (rad). */
  spacing = 0;
  rings = 0;
  private dirs: Vec3[] = [];
  private texIndex: number[] = [];
  private values = new Map<number, Float32Array>();
  private open = new Float32Array(0);
  readonly texture = new Uint8Array(CELL_TEX * CELL_TEX * 4);
  private readonly drops: Drop[] = [];
  private spawnDebt = 0;

  /** Refaz as células se a densidade mudou. `spacing` em radianos. */
  build(spacing: number): void {
    const K = Math.max(2, Math.min(CELL_TEX - 1, Math.round(Math.PI / spacing)));
    if (K === this.rings) return;
    this.rings = K;
    this.spacing = Math.PI / K;
    const D = this.spacing;
    this.dirs = [];
    this.texIndex = [];
    for (let k = 0; k <= K; k++) {
      const th = k * D;
      const sk = Math.sin(th);
      const n = k === 0 || k === K ? 1 : Math.max(1, Math.floor((2 * Math.PI * sk) / D + 0.5));
      const sector = (2 * Math.PI) / n;
      for (let i = 0; i < Math.min(n, CELL_TEX); i++) {
        const a = i * sector + TWIST * sector * k;
        this.dirs.push([sk * Math.cos(a), Math.cos(th), sk * Math.sin(a)]);
        this.texIndex.push(k * CELL_TEX + i);
      }
    }
    this.open = new Float32Array(this.dirs.length);
    this.values.clear();
    this.texture.fill(0);
  }

  /** Vibração de um modo em cada célula, entre -1 e 1. */
  private modeValues(index: number): Float32Array {
    let v = this.values.get(index);
    if (v) return v;
    const { l, m } = MODES[index];
    v = new Float32Array(this.dirs.length);
    let max = 1e-6;
    const c = Math.cos(TILT);
    const s = Math.sin(TILT);
    this.dirs.forEach((d, i) => {
      const y = d[1] * c - d[2] * s;
      const z = d[1] * s + d[2] * c;
      const value = legendre(l, m, y) * Math.cos(m * Math.atan2(z, d[0]));
      v![i] = value;
      max = Math.max(max, Math.abs(value));
    });
    for (let i = 0; i < v.length; i++) v[i] /= max;
    this.values.set(index, v);
    return v;
  }

  update(dt: number, f: GeoInput): void {
    const h = f.harmonics;
    const mixes = h.active.map((a) => ({ values: this.modeValues(a.index), weight: a.weight }));
    // A amplitude já passou pela curva do material (volume médio dá ~0,4):
    // dobrada, uma música normal abre os ventres quase por inteiro.
    const amount = Math.min(1.2, h.amplitude * 2.2) * f.holeSize;

    let best = 0;
    for (let c = 0; c < this.open.length; c++) {
      let v = 0;
      for (const m of mixes) v += m.values[c] * m.weight;
      const x = Math.min(1, Math.max(0, (Math.abs(v) - 0.25) / 0.5));
      const goal = Math.min(1, f.idle + amount * x * x * (3 - 2 * x));
      const rate = goal > this.open[c] ? 7 : 2.5;
      this.open[c] += (goal - this.open[c]) * (1 - Math.exp(-rate * dt));
      this.texture[this.texIndex[c] * 4] = Math.round(this.open[c] * 255);
      best = Math.max(best, this.open[c]);
    }

    this.moveDrops(dt, f, best);
  }

  private moveDrops(dt: number, f: GeoInput, best: number): void {
    const R = f.radius;
    if (f.drops > 0 && best > 0.35) {
      this.spawnDebt += dt * f.drops * (f.energy * 3 + 1) * best;
      this.spawnDebt += f.beat * f.drops * 2.5;
    } else {
      this.spawnDebt = 0;
    }
    while (this.spawnDebt >= 1) {
      this.spawnDebt -= 1;
      this.spawn(f, best);
    }

    for (const d of this.drops) {
      d.age += dt;
      const dist = Math.hypot(...d.rel) || 1;
      const g = (GRAVITY * R) / dist;
      d.vel = add(d.vel, d.rel, -g * dt);
      d.rel = add(d.rel, d.vel, dt);
    }
    // A gota volta para a esfera quando entra nela descendo.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dist = Math.hypot(...d.rel);
      const falling = d.rel[0] * d.vel[0] + d.rel[1] * d.vel[1] + d.rel[2] * d.vel[2] < 0;
      if ((falling && dist < R * 0.98) || d.age > 5) this.drops.splice(i, 1);
    }
  }

  /** Solta uma gota de uma das células mais abertas. */
  private spawn(f: GeoInput, best: number): void {
    if (this.drops.length >= MAX_DROPS) return;
    const candidates: number[] = [];
    for (let c = 0; c < this.open.length; c++) if (this.open[c] > best * 0.7) candidates.push(c);
    if (!candidates.length) return;
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    // Direção da célula no mundo: Mᵀ leva do referencial da esfera para o mundo.
    const m = f.rotation;
    const d = this.dirs[c];
    const dir = normalize([
      m[0] * d[0] + m[1] * d[1] + m[2] * d[2],
      m[3] * d[0] + m[4] * d[1] + m[5] * d[2],
      m[6] * d[0] + m[7] * d[1] + m[8] * d[2],
    ]);
    const R = f.radius;
    const height = R * 0.45 * f.dropHeight * (0.6 + Math.random() * 0.6);
    const speed = Math.sqrt(2 * GRAVITY * R * height) * 1.05;
    const jitter: Vec3 = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    this.drops.push({
      rel: dir.map((v) => v * R * 0.92) as Vec3,
      vel: add(dir.map((v) => v * speed) as Vec3, jitter, speed * 0.15),
      radius: R * (0.05 + Math.random() * 0.05) * (0.6 + 0.4 * this.open[c]),
      age: 0,
    });
  }

  /** Gotas para o shader: centro (x, y, z) no mundo e raio. */
  dropUniforms(center: Vec3, out: Float32Array): number {
    out.fill(0);
    this.drops.forEach((d, i) => out.set([center[0] + d.rel[0], center[1] + d.rel[1], center[2] + d.rel[2], d.radius], i * 4));
    return this.drops.length;
  }

  /** Distância máxima de uma gota ao centro, para o volume de busca do shader. */
  reach(): number {
    let r = 0;
    for (const d of this.drops) r = Math.max(r, Math.hypot(...d.rel) + d.radius);
    return r;
  }
}
