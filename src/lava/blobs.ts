// Física das bolhas de cera. Coordenadas de tela com y para cima: y vai de 0
// (embaixo) a 1 (em cima) e x de -aspecto/2 a +aspecto/2, em alturas de tela.
//
// A lâmpada é um oscilador de relaxação: embaixo a lâmpada aquece a cera, que
// fica menos densa e sobe; em cima ela esfria, fica mais densa e desce. A cera
// só se solta do fundo quando está bem quente e só afunda quando está bem
// fria (histerese), então cada bolha faz a viagem inteira em vez de ficar
// parada na borda da zona quente.

export interface Container {
  bottom: number;
  top: number;
  halfWidth(y: number): number;
  /** Escala das bolhas em relação à tela cheia. */
  scale: number;
}

/** Vidro da lâmpada; o shader desenha o mesmo contorno (lampHalfWidth). */
export const LAMP = {
  glassBottom: 0.2,
  glassTop: 0.86,
  baseWidth: 0.125,
  bellyWidth: 0.16,
  bellyAt: 0.22,
  topWidth: 0.07,
};

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function lampHalfWidth(y: number): number {
  const v = (y - LAMP.glassBottom) / (LAMP.glassTop - LAMP.glassBottom);
  if (v < LAMP.bellyAt) return LAMP.baseWidth + (LAMP.bellyWidth - LAMP.baseWidth) * smooth(v / LAMP.bellyAt);
  return LAMP.bellyWidth + (LAMP.topWidth - LAMP.bellyWidth) * ((v - LAMP.bellyAt) / (1 - LAMP.bellyAt));
}

export function makeContainer(shape: 'full' | 'lamp', aspect: number): Container {
  if (shape === 'lamp') {
    return { bottom: LAMP.glassBottom, top: LAMP.glassTop, halfWidth: lampHalfWidth, scale: 0.5 };
  }
  return { bottom: 0, top: 1, halfWidth: () => aspect / 2, scale: 1 };
}

/** Raio base de uma bolha em tela cheia, em alturas de tela. */
const BASE_RADIUS = 0.075;
/** Aceleração máxima do empuxo (alturas de tela/s²). */
const BUOYANCY = 0.3;
/** Temperatura em que a cera se solta do fundo e sobe. */
const MELT = 0.85;
/** Temperatura em que a cera fica densa e afunda. */
const SET = 0.3;
/** Arrasto do líquido viscoso (1/s). */
const DRAG = 2.2;
const HEAT = 0.28;
const COOL = 0.24;
/** Frequência do balanço de gelatina (rad/s). */
const JELLY_W = 9;
/** Quanto a mola da gelatina endurece com a amplitude (oscilador de Duffing). */
const JELLY_HARDEN = 9;
const JELLY_DAMP = 3.2;

export interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Tamanho relativo (multiplica o raio base). */
  size: number;
  /** Temperatura de 0 (fria) a 1 (quente). */
  temp: number;
  /** Subindo (passou de MELT) ou descendo (caiu abaixo de SET). */
  rising: boolean;
  /** Quão rápido esta bolha troca calor, para as bolhas não andarem em fila. */
  conduct: number;
  /** Achatamento da gelatina: > 0 alarga, < 0 estica. */
  squash: number;
  squashV: number;
  /** Rotação da figura da gota estrela nesta bolha. */
  spin: number;
  spinV: number;
  /** Fase própria do movimento lateral. */
  seed: number;
  /** Quanto esta bolha vibra em relação às outras. */
  vibration: number;
}

export interface Forces {
  /** Graves suavizados, de 0 a 1. */
  bass: number;
  /** Batida desta leitura, de 0 a 1 (0 = sem batida). */
  beat: number;
  bassHeat: number;
  beatBounce: number;
  mouse: { x: number; y: number; vx: number; vy: number; active: boolean };
  mouseMode: 'push' | 'heat' | 'ripple' | 'off';
  mouseStrength: number;
  mouseRadius: number;
}

export class Lava {
  readonly blobs: Blob[] = [];
  container: Container;
  sizeScale = 1;
  private time = 0;

  constructor(container: Container) {
    this.container = container;
  }

  /** Raio de uma bolha de tamanho 1, em alturas de tela. */
  baseRadius(): number {
    return BASE_RADIUS * this.container.scale * this.sizeScale;
  }

  radius(b: Blob): number {
    return this.baseRadius() * b.size;
  }

  setCount(count: number): void {
    while (this.blobs.length > count) this.blobs.pop();
    while (this.blobs.length < count) this.blobs.push(this.spawn(this.blobs.length === 0));
  }

  /** Nova bolha em qualquer altura, para a lâmpada já começar em movimento. */
  private spawn(first: boolean): Blob {
    const c = this.container;
    const y = c.bottom + (c.top - c.bottom) * (first ? 0.5 : Math.random());
    const w = c.halfWidth(y) * 0.8;
    const temp = Math.random();
    return {
      x: (Math.random() * 2 - 1) * w,
      y,
      vx: 0,
      vy: 0,
      size: 0.6 + Math.random() * 0.8,
      temp,
      rising: temp > 0.6,
      conduct: 0.75 + Math.random() * 0.5,
      squash: 0,
      squashV: 0,
      spin: Math.random() * Math.PI * 2,
      spinV: (Math.random() - 0.5) * 0.3,
      seed: Math.random() * 100,
      vibration: 0.7 + Math.random() * 0.6,
    };
  }

  /** Reposiciona as bolhas quando o recipiente muda (formato ou tela). */
  setContainer(container: Container): void {
    const old = this.container;
    this.container = container;
    for (const b of this.blobs) {
      const v = (b.y - old.bottom) / (old.top - old.bottom);
      const u = b.x / Math.max(1e-3, old.halfWidth(b.y));
      b.y = container.bottom + v * (container.top - container.bottom);
      b.x = u * container.halfWidth(b.y);
    }
  }

  /**
   * `dt` em segundos. `motion` é a Velocidade escolhida: escala o fluxo da
   * cera, mas a gelatina e a vibração seguem no tempo real.
   */
  update(dt: number, f: Forces, motion: number): void {
    if (dt <= 0) return;
    this.time += dt;
    const c = this.container;
    const height = c.top - c.bottom;
    const blobs = this.blobs;

    for (const b of blobs) {
      const r = this.radius(b);
      const v = (b.y - c.bottom) / height;

      // Temperatura: aquece embaixo (mais com graves), esfria em cima.
      const heater = 1 - smooth(v / 0.22);
      const cooler = smooth((v - 0.72) / 0.28);
      b.temp += (HEAT * heater * (1 + f.bass * f.bassHeat * 1.5) - COOL * cooler) * b.conduct * dt * motion;
      b.temp += (0.5 - b.temp) * 0.01 * dt * motion;
      if (b.temp > MELT) b.rising = true;
      else if (b.temp < SET) b.rising = false;

      // Empuxo: mais forte quanto mais longe do ponto de virada, e bolhas
      // grandes andam mais rápido (lei de Stokes, mais branda).
      const push = b.rising ? 0.35 + 0.65 * b.temp : -(0.3 + 0.7 * (1 - b.temp)) * 0.8;
      const buoy = BUOYANCY * push * Math.sqrt(b.size);
      // Deriva lateral lenta, de correntes de convecção.
      const drift =
        0.035 * Math.sin(this.time * 0.23 + b.seed) + 0.02 * Math.sin(this.time * 0.61 + b.seed * 1.7);

      b.vx += (drift - DRAG * b.vx) * dt * motion;
      b.vy += (buoy - DRAG * b.vy) * dt * motion;

      // Batida: pancada para cima nas bolhas de baixo e balanço em todas.
      if (f.beat > 0 && f.beatBounce > 0) {
        const kick = f.beat * f.beatBounce;
        b.vy += kick * 0.05 * heater;
        b.vx += (Math.random() - 0.5) * kick * 0.02;
        b.squashV += (Math.random() < 0.5 ? -1 : 1) * kick * 2.2 * b.vibration;
      }

      // Mouse.
      if (f.mouse.active && f.mouseMode !== 'off' && f.mouseStrength > 0) {
        const dx = b.x - f.mouse.x;
        const dy = b.y - f.mouse.y;
        const reach = f.mouseRadius + r;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach * reach) {
          const d = Math.sqrt(d2) + 1e-4;
          const fall = 1 - d / reach;
          if (f.mouseMode === 'push') {
            const push = fall * fall * f.mouseStrength * 2.5;
            b.vx += ((dx / d) * push + f.mouse.vx * fall * 0.6 * f.mouseStrength) * dt;
            b.vy += ((dy / d) * push + f.mouse.vy * fall * 0.6 * f.mouseStrength) * dt;
          } else if (f.mouseMode === 'heat') {
            b.temp += fall * f.mouseStrength * 0.8 * dt;
          }
        }
      }

      b.temp = Math.max(0, Math.min(1, b.temp));
    }

    // Bolhas que se encostam grudam: trocam velocidade e calor, e viajam
    // juntas até se separarem de novo.
    for (let i = 0; i < blobs.length; i++) {
      const a = blobs[i];
      const ra = this.radius(a);
      for (let j = i + 1; j < blobs.length; j++) {
        const b = blobs[j];
        const reach = ra + this.radius(b);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2) + 1e-5;
        const overlap = 1 - d / reach;
        const k = Math.min(0.5, overlap * 0.5 * dt * motion);
        const wa = a.size / (a.size + b.size);
        const vx = a.vx * wa + b.vx * (1 - wa);
        const vy = a.vy * wa + b.vy * (1 - wa);
        a.vx += (vx - a.vx) * k;
        a.vy += (vy - a.vy) * k;
        b.vx += (vx - b.vx) * k;
        b.vy += (vy - b.vy) * k;
        const t = a.temp * wa + b.temp * (1 - wa);
        a.temp += (t - a.temp) * k * 0.1;
        b.temp += (t - b.temp) * k * 0.1;
        // Repulsão leve só quando quase no mesmo ponto, para não empilhar.
        if (overlap > 0.5) {
          const push = (overlap - 0.5) * 0.6 * dt * motion;
          a.vx -= (dx / d) * push;
          a.vy -= (dy / d) * push;
          b.vx += (dx / d) * push;
          b.vy += (dy / d) * push;
        }
      }
    }

    for (const b of blobs) {
      const r = this.radius(b);
      b.x += b.vx * dt * motion;
      b.y += b.vy * dt * motion;

      // Fundo e topo: a bolha para, e a pancada vira balanço.
      const floor = c.bottom + r * 0.55;
      const ceil = c.top - r * 0.55;
      if (b.y < floor) {
        b.squashV += Math.max(0, -b.vy) * 6;
        b.y = floor;
        b.vy = Math.max(0, b.vy);
      } else if (b.y > ceil) {
        b.squashV += Math.max(0, b.vy) * 6;
        b.y = ceil;
        b.vy = Math.min(0, b.vy);
      }

      // Paredes: empurrão macio para dentro.
      const w = c.halfWidth(b.y) - r * 0.7;
      if (w <= 0) {
        b.x *= 0.9;
      } else if (Math.abs(b.x) > w) {
        b.x = Math.sign(b.x) * w;
        b.vx *= -0.3;
      }

      // Gelatina: mola que endurece com a amplitude, para pancada forte
      // vibrar mais rápido.
      const q = b.squash;
      const accel = -JELLY_W * JELLY_W * (1 + JELLY_HARDEN * q * q) * q - JELLY_DAMP * b.squashV;
      b.squashV += accel * dt;
      b.squash = Math.max(-0.45, Math.min(0.45, q + b.squashV * dt));

      b.spin += b.spinV * dt * motion;
    }
  }
}
