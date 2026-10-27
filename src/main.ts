import { Lava, makeContainer, type Forces } from './lava/blobs';
import { Cymatics } from './lava/cymatics';
import {
  PRESETS,
  approachPalette,
  clonePalette,
  paletteFromMedia,
  rotatePalette,
  type Palette,
  type RGB,
} from './lava/palette';
import { MAX_BLOBS, MAX_RIPPLES, Renderer, emptyFrame } from './render/renderer';
import { AudioAnalyzer, silentLevels } from './wallpaper/audio';
import { startDemo } from './wallpaper/demo';
import { listenToMedia } from './wallpaper/media';
import { defaultSettings, listenToProperties, type Settings } from './wallpaper/properties';

declare global {
  interface Window {
    wallpaperRegisterAudioListener?: (cb: (spectrum: number[]) => void) => void;
  }
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('lava') as HTMLCanvasElement;
const settings: Settings = defaultSettings();

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  document.body.style.cssText = 'color:#ccc;font:16px sans-serif;display:grid;place-items:center;';
  document.body.textContent = `Não foi possível iniciar a lâmpada: ${(err as Error).message}`;
  throw err;
}

// ---------------------------------------------------------------- áudio

const analyzer = new AudioAnalyzer();
const cymatics = new Cymatics();
/** Níveis da última leitura, já multiplicados pela Reação ao áudio. */
const target = silentLevels();
/** Níveis suavizados a cada quadro: sobem rápido e descem devagar. */
const level = { bass: 0, mid: 0, treble: 0, energy: 0 };
let pendingBeat = 0;

function onSpectrum(spectrum: ArrayLike<number>): void {
  const levels = analyzer.analyze(spectrum);
  const k = settings.audioreact / 100;
  target.bass = levels.bass * k;
  target.mid = levels.mid * k;
  target.treble = levels.treble * k;
  target.energy = levels.energy * k;
  pendingBeat = Math.max(pendingBeat, Math.min(1.5, levels.beat * k));
  cymatics.hear(
    levels.notes.map((n) => ({ band: n.band, strength: Math.min(1, n.strength * k) })),
    Math.min(1, levels.energy * k),
  );
}

// ---------------------------------------------------------------- cores

let mediaPalette: Palette | null = null;
const palette = clonePalette(PRESETS.classic);
let hueAngle = 0;

function targetPalette(): Palette {
  if (settings.colorscheme === 'custom') {
    return {
      wax: settings.waxcolor,
      hot: settings.waxhot,
      top: settings.liquidtop,
      bottom: settings.liquidbottom,
      glow: settings.glowcolor,
    };
  }
  if (settings.colorscheme === 'music') return mediaPalette ?? PRESETS.classic;
  return PRESETS[settings.colorscheme] ?? PRESETS.classic;
}

function onCover(primary: RGB, secondary: RGB): void {
  mediaPalette = paletteFromMedia(primary, secondary);
}

// ---------------------------------------------------------------- mouse

const mouse = { x: 0, y: 0.5, vx: 0, vy: 0, active: false, lastMove: -1e9, lastRipple: 0 };
let aspect = renderer.resize();

function toScene(e: PointerEvent | MouseEvent): { x: number; y: number } {
  return {
    x: (e.clientX / window.innerWidth - 0.5) * aspect,
    y: 1 - e.clientY / window.innerHeight,
  };
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  strength: number;
}
const ripples: Ripple[] = [];

function addRipple(x: number, y: number, strength: number): void {
  if (ripples.length >= MAX_RIPPLES) ripples.shift();
  ripples.push({ x, y, age: 0, strength });
}

window.addEventListener('pointermove', (e) => {
  const p = toScene(e);
  const now = performance.now();
  const dt = Math.max(0.008, (now - mouse.lastMove) / 1000);
  if (dt < 0.5) {
    mouse.vx += ((p.x - mouse.x) / dt - mouse.vx) * 0.5;
    mouse.vy += ((p.y - mouse.y) / dt - mouse.vy) * 0.5;
  }
  mouse.x = p.x;
  mouse.y = p.y;
  mouse.lastMove = now;

  if (settings.mousemode === 'ripple' && settings.mousestrength > 0 && now - mouse.lastRipple > 110) {
    const speed = Math.hypot(mouse.vx, mouse.vy);
    if (speed > 0.05) {
      mouse.lastRipple = now;
      addRipple(p.x, p.y, Math.min(1.2, speed * 0.6) * (settings.mousestrength / 100));
    }
  }
});

window.addEventListener('pointerdown', (e) => {
  if (!settings.clickripples) return;
  const p = toScene(e);
  addRipple(p.x, p.y, 1.4);
});

// ---------------------------------------------------------------- lâmpada

const lava = new Lava(makeContainer(settings.shape, aspect));
let shape = settings.shape;

function applySettings(): void {
  renderer.quality = settings.quality / 100;
  aspect = renderer.resize();
  if (settings.shape !== shape) {
    shape = settings.shape;
    lava.setContainer(makeContainer(shape, aspect));
  }
  lava.sizeScale = settings.blobsize / 100;
  lava.setCount(Math.min(MAX_BLOBS, Math.round(settings.blobcount)));
}

window.addEventListener('resize', () => {
  aspect = renderer.resize();
  lava.setContainer(makeContainer(shape, aspect));
});

listenToProperties(settings, applySettings);
applySettings();

// Opções também pela URL, para testar no navegador (ex.: ?demo&shape=lamp).
const fromUrl: Record<string, { value: string | boolean }> = {};
params.forEach((value, key) => {
  fromUrl[key] = { value: value === 'true' ? true : value === 'false' ? false : value.replace(/,/g, ' ') };
});
window.wallpaperPropertyListener?.applyUserProperties?.(fromUrl);

// ---------------------------------------------------------------- quadros

/** Amplitude máxima da gota estrela, em fração do raio. */
const STAR = 0.22;
/** Altura máxima das ondas de Faraday, em alturas de tela. */
const FARADAY = 0.0012;

const frame = emptyFrame();
let last = performance.now();
let lastDrawn = 0;
let clock = 0;

function smooth(current: number, goal: number, dt: number): number {
  const rate = goal > current ? 18 : 5;
  return current + (goal - current) * (1 - Math.exp(-rate * dt));
}

function tick(now: number): void {
  requestAnimationFrame(tick);
  if (settings.fps > 0 && now - lastDrawn < 1000 / settings.fps - 2) return;
  lastDrawn = now;
  const dt = Math.min(1 / 20, Math.max(0, (now - last) / 1000));
  last = now;
  clock += dt;

  level.bass = smooth(level.bass, target.bass, dt);
  level.mid = smooth(level.mid, target.mid, dt);
  level.treble = smooth(level.treble, target.treble, dt);
  level.energy = smooth(level.energy, target.energy, dt);
  const beat = pendingBeat;
  pendingBeat = 0;

  mouse.active = now - mouse.lastMove < 1500;
  if (!mouse.active) {
    mouse.vx = 0;
    mouse.vy = 0;
  }

  const forces: Forces = {
    bass: Math.min(1.5, level.bass),
    beat,
    bassHeat: settings.bassheat / 100,
    beatBounce: settings.beatbounce / 100,
    mouse,
    mouseMode: settings.mousemode,
    mouseStrength: settings.mousestrength / 100,
    mouseRadius: (settings.mouseradius / 100) * (shape === 'lamp' ? 0.6 : 1),
  };
  lava.update(dt, forces, settings.speed / 100);
  cymatics.update(dt, settings.vibrationspeed / 100);

  for (const r of ripples) r.age += dt;
  while (ripples.length && ripples[0].age > 4) ripples.shift();

  // Cores: transição suave e arco-íris opcional.
  approachPalette(palette, targetPalette(), 1 - Math.exp(-dt * 1.5));
  hueAngle = (hueAngle + dt * (settings.huecycle / 100) * 0.8) % (Math.PI * 2);
  const colors = settings.huecycle > 0 ? rotatePalette(palette, hueAngle) : palette;

  fillFrame(colors);
  renderer.draw(frame);
}

function fillFrame(colors: Palette): void {
  const u = frame;
  const bass = Math.min(1.2, level.bass);
  const blobs = lava.blobs;
  const star = settings.cymatics === 'both' || settings.cymatics === 'star';
  const faraday = settings.cymatics === 'both' || settings.cymatics === 'faraday';
  const strength = settings.cymaticsstrength / 100;

  u.time = clock;
  u.count = blobs.length;
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    u.blobs.set([b.x, b.y, lava.radius(b) * (1 + 0.07 * bass), b.temp], i * 4);
    u.blobsB.set([b.squash, b.spin, b.vibration, 0], i * 4);
  }
  u.radius = lava.baseRadius();

  u.star.fill(0);
  u.wave.fill(0);
  cymatics.active.forEach((a, j) => {
    const amp = cymatics.amplitude * strength * a.weight * Math.cos(a.phase);
    if (star) {
      u.star[j * 4] = a.mode.lobes;
      u.star[j * 4 + 1] = STAR * amp;
    }
    if (faraday) {
      u.wave[j * 4] = a.mode.directions;
      u.wave[j * 4 + 1] = a.mode.k / (settings.wavescale / 100);
      u.wave[j * 4 + 2] = a.mode.angle;
      u.wave[j * 4 + 3] = FARADAY * amp * (settings.wavescale / 100) || 0;
    }
  });

  u.ripples.fill(0);
  ripples.forEach((r, i) => u.ripples.set([r.x, r.y, r.age, r.strength], i * 4));

  const k = 1.3 + (settings.goo / 100) * 1.3;
  u.kernel = k;
  u.threshold = (1 - 1 / (k * k)) ** 3;
  // Na borda de uma bolha sozinha, 1 - q = ∛limiar; c = 2/∛limiar faz o raio
  // visível variar na fração A.
  u.starGain = 2 / Math.cbrt(u.threshold);
  u.pool = settings.pool ? 0.05 * (shape === 'lamp' ? 0.6 : 1) * (1 + 0.1 * bass) : 0;
  u.lamp = shape === 'lamp';

  u.colors.wax = colors.wax;
  u.colors.hot = colors.hot;
  u.colors.top = colors.top;
  u.colors.bottom = colors.bottom;
  u.colors.glow = colors.glow;
  u.colors.metal = settings.lampmetal;
  u.colors.backdrop = settings.backdrop;

  u.glow = settings.glow / 100;
  u.shine = settings.shine / 100;
  u.refract = settings.refraction / 100;
  u.bright = settings.brightness / 100;
  u.vignette = settings.vignette / 100;
  u.grain = settings.grain / 100;
  u.bass = bass;
  u.energy = Math.min(1.2, level.energy);
}

// ---------------------------------------------------------------- início

if (params.has('demo')) {
  startDemo(onSpectrum, onCover);
} else {
  window.wallpaperRegisterAudioListener?.(onSpectrum);
  listenToMedia(onCover);
}

if (params.has('painel')) {
  import('./dev/panel').then((m) => m.mountPanel());
}

requestAnimationFrame(tick);
