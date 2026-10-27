// Movimento do ferrofluido: altura dos espinhos (o fluido tem inércia, então
// a altura segue o campo por uma mola e passa um pouco do ponto), posição do
// ímã, da poça e da esfera, giro da esfera e ondas.

import { axisAngle, cross, identity, multiply, normalize, orthonormalize, transpose, type Vec3 } from './math3';

export const MAX_RIPPLES = 8;

/** Raio da poça e da esfera com Tamanho 100%, em unidades do mundo. */
export const PUDDLE_RADIUS = 1;
export const SPHERE_RADIUS = 0.55;

/** Rigidez e amortecimento da mola dos espinhos (1/s², 1/s). */
const SPIKE_K = 70;
const SPIKE_C = 10;
/** Mola do inchaço da esfera nas batidas. */
const PULSE_K = 140;
const PULSE_C = 7;

export interface Ripple {
  x: number;
  z: number;
  age: number;
  strength: number;
}

export interface FerroInput {
  shape: 'puddle' | 'sphere';
  /** Raio da poça ou da esfera, já com o Tamanho. */
  radius: number;
  /** Altura máxima dos espinhos, em unidades do mundo. */
  maxSpike: number;
  /** Força do ímã, de 0 a ~1,5. */
  field: number;
  /** Batida desta leitura, já com a força escolhida (0 = sem batida). */
  beat: number;
  /** Ponto do mundo para onde o mouse aponta, ou null se parado. */
  mouse: Vec3 | null;
  /** Quanto o ímã / a esfera seguem o mouse (0 a 3). */
  follow: number;
  sphereMotion: 'spin' | 'mouse' | 'both' | 'still';
  /** Velocidade do giro da esfera (rad/s). */
  spinSpeed: number;
}

export class Ferro {
  spike = 0;
  private spikeV = 0;
  pulse = 0;
  private pulseV = 0;
  magnet = { x: 0, z: 0 };
  center = { x: 0, z: 0 };
  sphere: Vec3 = [0, 0, 0];
  private sphereV: Vec3 = [0, 0, 0];
  /** Leva direções do mundo para o referencial da esfera. */
  rotation = identity();
  readonly ripples: Ripple[] = [];
  private spinAxis = normalize([0.25, 1, 0.15]);

  /** Onda (poça) ou inchaço (esfera) a partir de um ponto. */
  splash(x: number, z: number, strength: number): void {
    if (strength <= 0) return;
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, z, age: 0, strength });
    this.pulseV += strength * 0.6;
    this.spikeV += strength * 0.6;
  }

  update(dt: number, f: FerroInput): void {
    // Espinhos: mola puxando para a altura que o campo pede.
    const goal = f.maxSpike * f.field;
    this.spikeV += (SPIKE_K * (goal - this.spike) - SPIKE_C * this.spikeV) * dt;
    if (f.beat > 0) this.spikeV += f.beat * f.maxSpike * 4;
    this.spike = Math.max(0, this.spike + this.spikeV * dt);

    if (f.shape === 'puddle') this.movePuddle(dt, f);
    else this.moveSphere(dt, f);

    for (const r of this.ripples) r.age += dt;
    while (this.ripples.length && this.ripples[0].age > 3.5) this.ripples.shift();
  }

  private movePuddle(dt: number, f: FerroInput): void {
    if (f.beat > 0.3) this.splash(this.magnet.x, this.magnet.z, f.beat * 0.6);

    // O ímã vai até o mouse (dentro da poça) e a poça vai atrás, mais devagar.
    let tx = 0;
    let tz = 0;
    if (f.mouse && f.follow > 0) {
      const amount = Math.min(1, f.follow);
      tx = f.mouse[0] * amount;
      tz = f.mouse[2] * amount;
      const limit = f.radius * 0.6;
      const d = Math.hypot(tx, tz);
      if (d > limit) {
        tx *= limit / d;
        tz *= limit / d;
      }
    }
    const k = 1 - Math.exp(-dt * 3 * Math.max(0.3, f.follow));
    this.magnet.x += (tx - this.magnet.x) * k;
    this.magnet.z += (tz - this.magnet.z) * k;
    const k2 = 1 - Math.exp(-dt * 0.8);
    this.center.x += (this.magnet.x * 0.5 - this.center.x) * k2;
    this.center.z += (this.magnet.z * 0.5 - this.center.z) * k2;
  }

  private moveSphere(dt: number, f: FerroInput): void {
    // Batida: a esfera incha e volta, como gelatina.
    if (f.beat > 0) this.pulseV += f.beat * 0.9;
    this.pulseV += (-PULSE_K * this.pulse - PULSE_C * this.pulseV) * dt;
    this.pulse = Math.max(-0.15, Math.min(0.25, this.pulse + this.pulseV * dt));

    const follows = f.sphereMotion === 'mouse' || f.sphereMotion === 'both';
    let target: Vec3 = [0, 0, 0];
    if (follows && f.mouse && f.follow > 0) {
      const amount = Math.min(1, f.follow);
      target = [f.mouse[0] * amount, f.mouse[1] * amount, f.mouse[2] * amount];
      const d = Math.hypot(...target);
      const limit = 1.6;
      if (d > limit) target = target.map((v) => (v * limit) / d) as Vec3;
    }
    // Mola com amortecimento: a esfera chega um pouco atrasada e balança.
    const stiff = 10 * Math.max(0.3, Math.min(3, f.follow || 1));
    for (let i = 0; i < 3; i++) {
      this.sphereV[i] += (stiff * (target[i] - this.sphere[i]) - 5 * this.sphereV[i]) * dt;
      this.sphere[i] += this.sphereV[i] * dt;
    }

    // Giro em torno de si e rolamento quando anda.
    let delta = identity();
    if (f.sphereMotion === 'spin' || f.sphereMotion === 'both') {
      delta = axisAngle(this.spinAxis, f.spinSpeed * dt);
    }
    const speed = Math.hypot(...this.sphereV);
    if (speed > 1e-3) {
      const axis = normalize(cross([0, 1, 0], this.sphereV));
      if (Math.hypot(...axis) > 0.5) {
        delta = multiply(axisAngle(axis, (speed * dt) / f.radius), delta);
      }
    }
    // Girar o corpo por Q faz o referencial do corpo virar M·Qᵀ.
    this.rotation = multiply(this.rotation, transpose(delta));
    orthonormalize(this.rotation);
  }
}
