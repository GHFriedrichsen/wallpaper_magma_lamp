import { hitPlane, orbitCamera, screenRay } from './ferro/camera';
import { Ferro, MAX_RIPPLES, PUDDLE_RADIUS, SPHERE_RADIUS } from './ferro/ferro';
import type { Vec3 } from './ferro/math3';
import {
  PRESETS,
  approachPalette,
  clonePalette,
  paletteFromMedia,
  rotatePalette,
  type Palette,
  type RGB,
} from './ferro/palette';
import { HEX, Patterns, type Pattern } from './ferro/patterns';
import { CELL_TEX, Geodesic, TWIST } from './geo/geodesic';
import { Harmonics } from './geo/harmonics';
import { TitleOverlay } from './overlay/title';
import { MAX_DROPS, Renderer, type Frame } from './render/renderer';
import { AudioAnalyzer, silentLevels } from './wallpaper/audio';
import { startDemo } from './wallpaper/demo';
import { listenToMedia, type Song } from './wallpaper/media';
import { defaultSettings, listenToProperties, type Settings } from './wallpaper/properties';

declare global {
  interface Window {
    wallpaperRegisterAudioListener?: (cb: (spectrum: number[]) => void) => void;
  }
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('ferro') as HTMLCanvasElement;
const settings: Settings = defaultSettings();

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  document.body.style.cssText = 'color:#ccc;font:16px sans-serif;display:grid;place-items:center;';
  document.body.textContent = `Não foi possível iniciar o ferrofluido: ${(err as Error).message}`;
  throw err;
}

// ---------------------------------------------------------------- áudio

const analyzer = new AudioAnalyzer();
const patterns = new Patterns();
const harmonics = new Harmonics();
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
  const notes = levels.notes.map((n) => ({ band: n.band, strength: Math.min(1, n.strength * k) }));
  patterns.hear(notes);
  harmonics.hear(notes, Math.min(1, levels.energy * k));
}

// ---------------------------------------------------------------- música e cores

let mediaPalette: Palette | null = null;
const palette = clonePalette(PRESETS.aurora);
let hueAngle = 0;
const title = new TitleOverlay();

function targetPalette(): Palette {
  if (settings.colorscheme === 'custom') {
    return { light1: settings.light1, light2: settings.light2, light3: settings.light3, background: settings.background };
  }
  if (settings.colorscheme === 'music') return mediaPalette ?? PRESETS.aurora;
  return PRESETS[settings.colorscheme] ?? PRESETS.aurora;
}

function onCover(primary: RGB, secondary: RGB): void {
  mediaPalette = paletteFromMedia(primary, secondary);
}

function onSong(song: Song): void {
  title.setSong(song);
}

// ---------------------------------------------------------------- mouse

/** Posição do mouse na tela, de 0 a 1 (y para baixo). */
const mouse = { sx: 0.5, sy: 0.5, lastMove: -1e9, click: null as null | { sx: number; sy: number } };

window.addEventListener('pointermove', (e) => {
  mouse.sx = e.clientX / window.innerWidth;
  mouse.sy = e.clientY / window.innerHeight;
  mouse.lastMove = performance.now();
});

window.addEventListener('pointerdown', (e) => {
  mouse.click = { sx: e.clientX / window.innerWidth, sy: e.clientY / window.innerHeight };
});

// ---------------------------------------------------------------- opções

let aspect = renderer.resize();

function applySettings(): void {
  renderer.quality = settings.quality / 100;
  aspect = renderer.resize();
}

window.addEventListener('resize', () => {
  aspect = renderer.resize();
});

listenToProperties(settings, applySettings);
applySettings();

// Opções também pela URL, para testar no navegador (ex.: ?demo&shape=sphere).
const fromUrl: Record<string, { value: string | boolean }> = {};
params.forEach((value, key) => {
  fromUrl[key] = { value: value === 'true' ? true : value === 'false' ? false : value.replace(/,/g, ' ') };
});
window.wallpaperPropertyListener?.applyUserProperties?.(fromUrl);

// ---------------------------------------------------------------- quadros

const ferro = new Ferro();
const geodesic = new Geodesic();
/** Raio da esfera geodésica com Tamanho 100%. */
const GEO_RADIUS = 0.8;
const STEPS = { low: 56, medium: 96, high: 128 };
/** Distância da câmera ao centro com Zoom 100%. */
const CAMERA_DISTANCE = 3.4;

let last = performance.now();
let lastDrawn = 0;
let clock = 0;
let orbitAngle = 0;
let lightAngle = 0;
let figureAngle = 0;

function smooth(current: number, goal: number, dt: number): number {
  const rate = goal > current ? 18 : 5;
  return current + (goal - current) * (1 - Math.exp(-rate * dt));
}

/** Raio da base do espinho, em espaçamentos: na mandala cabe menos em volta do anel. */
function spikeBase(p: Pattern): number {
  return p.type === HEX ? 0.5 : Math.min(0.5, (Math.PI / p.symmetry) * 0.95);
}

/**
 * Espinhos altos quando são poucos e baixos quando são muitos, como no
 * ferrofluido de verdade: a altura não passa de 1,6 vez a distância entre
 * eles. `gap` é essa distância em unidades do mundo.
 */
function spikeHeight(p: Pattern, gap: number, maxSpike: number): number {
  const byPattern = Math.min(1.25, Math.max(0.45, Math.pow(p.spacing / 0.22, 0.7)));
  return maxSpike > 0 ? Math.min(byPattern, (1.6 * gap) / maxSpike) : byPattern;
}

function lightDir(azimuth: number, elevationDeg: number): Vec3 {
  const e = (Math.min(85, elevationDeg) * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(azimuth), Math.sin(e), -Math.cos(e) * Math.cos(azimuth)];
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
  const beat = pendingBeat * (settings.beatjump / 100);
  pendingBeat = 0;

  const s = settings;
  const geo = s.shape === 'geodesic';
  const sphere = s.shape !== 'puddle';
  // A esfera geodésica não tem espinhos, então pode ser maior.
  const radius = (geo ? GEO_RADIUS : sphere ? SPHERE_RADIUS : PUDDLE_RADIUS) * (s.size / 100);

  // Câmera: órbita lenta e, se ligado, acompanha o mouse.
  orbitAngle += dt * (s.orbit / 100) * 0.4;
  const mouseOn = s.mouse && now - mouse.lastMove < 2500;
  const parallax = s.mouse ? s.mouseparallax / 100 : 0;
  const cam = orbitCamera(
    sphere ? [0, 0, 0] : [0, 0.1, 0],
    s.camangle - (mouse.sy - 0.5) * 20 * parallax,
    orbitAngle + (mouse.sx - 0.5) * 0.6 * parallax,
    CAMERA_DISTANCE / (s.zoom / 100),
  );

  // Onde o mouse aponta no mundo: no plano da poça ou no plano de frente
  // para a câmera que passa pelo centro da esfera.
  const toWorld = (sx: number, sy: number): Vec3 | null => {
    const dir = screenRay(cam, aspect, sx, sy);
    return sphere
      ? hitPlane(cam.pos, dir, [0, 0, 0], cam.forward.map((v) => -v) as Vec3)
      : hitPlane(cam.pos, dir, [0, 0.08, 0], [0, 1, 0]);
  };

  if (mouse.click && s.mouse && s.mouseclick > 0) {
    const p = toWorld(mouse.click.sx, mouse.click.sy);
    if (p) ferro.splash(p[0], p[2], 1.2 * (s.mouseclick / 100));
  }
  mouse.click = null;

  const idle = s.idlefield / 100;
  const drive = Math.min(1.5, level.bass) * (s.bassfield / 100) * 0.85 + Math.min(1.2, level.energy) * 0.25;
  const maxSpike = geo ? 0 : (sphere ? 0.4 : 0.32) * radius * (s.spikeheight / 100);
  ferro.update(dt, {
    shape: sphere ? 'sphere' : 'puddle',
    radius,
    maxSpike,
    field: Math.min(1.6, idle + (1 - idle * 0.4) * drive),
    beat,
    mouse: mouseOn ? toWorld(mouse.sx, mouse.sy) : null,
    follow: s.mouse ? s.mousemagnet / 100 : 0,
    sphereMotion: s.spheremotion,
    spinSpeed: (s.spherespin / 100) * 1.5,
  });
  patterns.update(dt, s.changespeed / 100);
  harmonics.update(dt);
  if (geo) {
    geodesic.build(0.24 / (s.density / 100));
    geodesic.update(dt, {
      harmonics,
      radius,
      rotation: ferro.rotation,
      holeSize: s.holesize / 100,
      idle: s.idleholes / 100,
      drops: s.drops / 100,
      dropHeight: s.dropheight / 100,
      beat,
      energy: Math.min(1.2, level.energy),
    });
    renderer.setCells(geodesic.texture, CELL_TEX);
  }
  // Graves incham a esfera geodésica, como um fluido empurrado por dentro.
  const swell = geo ? Math.min(1.5, level.bass) * (s.bassfield / 100) * 0.035 : 0;
  const drops = new Float32Array(MAX_DROPS * 4);
  const dropCount = geo ? geodesic.dropUniforms(ferro.sphere, drops) : 0;
  const shell = 0.065 * radius;

  // Cores: transição suave e arco-íris opcional.
  approachPalette(palette, targetPalette(), 1 - Math.exp(-dt * 1.5));
  hueAngle = (hueAngle + dt * (s.huecycle / 100) * 0.8) % (Math.PI * 2);
  const colors = s.huecycle > 0 ? rotatePalette(palette, hueAngle) : palette;

  lightAngle += dt * (s.lightspeed / 100) * 0.6;
  figureAngle += dt * (s.spin / 100) * 0.5;

  const [patA, patB, blend] = patterns.shapes(s.cymatics);
  const density = s.density / 100;
  // Na poça o espaçamento é em unidades do mundo; na esfera, em radianos.
  const spacing = (p: Pattern) => (sphere ? (p.spacing * 1.2) / density : (p.spacing * radius) / density);
  const pulse = 1 + (s.lightpulse / 100) * (0.6 * Math.min(1.2, level.energy) + 0.4 * Math.min(1.2, level.bass));
  const lit = (c: RGB, power: number): RGB => c.map((v) => (v * power) / 100) as RGB;

  const ripples = new Float32Array(MAX_RIPPLES * 4);
  if (!sphere) ferro.ripples.forEach((r, i) => ripples.set([r.x, r.z, r.age, r.strength], i * 4));

  const frame: Frame = {
    uTime: clock,
    uCamPos: cam.pos,
    uCamF: cam.forward,
    uCamR: cam.right,
    uCamU: cam.up,
    uFocal: cam.focal,
    // A esfera anda em passos menores (espinhos para todos os lados).
    uSteps: Math.round(STEPS[s.detail] * (sphere ? 1.25 : 1)),
    uShape: geo ? 2 : sphere ? 1 : 0,
    uSphere: [...ferro.sphere, radius],
    uSphereRot: ferro.rotation,
    uPulse: ferro.pulse + swell,
    uGeo: [geodesic.spacing, geodesic.rings, geodesic.spacing * 0.13 * (s.strut / 100), shell],
    uGeoSmooth: 0.045 * radius,
    uTwist: TWIST,
    uDrops: drops,
    uDropCount: dropCount,
    uReach: Math.max(radius * (1 + ferro.pulse + swell) + shell, geodesic.reach()) + 0.02,
    uGeoColor: s.geocolor,
    uMetal: s.metallic / 100,
    uCenter: [ferro.center.x, ferro.center.z],
    uRadius: radius,
    uMound: 0.07 * radius,
    uMagnet: [ferro.magnet.x, ferro.magnet.z],
    uFieldR: 0.62 * radius,
    uSpike: ferro.spike,
    uSharp: 0.7 + (s.sharpness / 100) * 2.5,
    uShimmer: Math.min(1.5, level.treble) * (s.trebleshimmer / 100) * 0.25,
    uPatA: [patA.type, spacing(patA), patA.symmetry, patA.twist],
    uPatB: [patB.type, spacing(patB), patB.symmetry, patB.twist],
    uPatAngle: [patA.angle + figureAngle, patB.angle + figureAngle],
    uPatBase: [spikeBase(patA), spikeBase(patB)],
    uPatHeight: [
      spikeHeight(patA, spacing(patA) * (sphere ? radius : 1), maxSpike),
      spikeHeight(patB, spacing(patB) * (sphere ? radius : 1), maxSpike),
    ],
    uBlend: blend,
    uRipple: ripples,
    uL1: lit(colors.light1, s.light1power),
    uL2: lit(colors.light2, s.light2power),
    uL3: lit(colors.light3, s.light3power),
    uL1Dir: lightDir(lightAngle + 0.9, s.lightheight),
    uL2Dir: lightDir(lightAngle + 3.0, s.lightheight + 8),
    uL3Dir: lightDir(lightAngle + 5.0, s.lightheight + 30),
    uBg: colors.background,
    uFluid: s.fluidcolor,
    uLightPower: pulse,
    uMirror: s.mirror / 100,
    uBgGlow: s.backgroundglow / 100,
    uBright: s.brightness / 100,
    uVignette: s.vignette / 100,
    uGrain: s.grain / 100,
  };
  renderer.draw(frame);
  title.update(s, level.bass);
}

// ---------------------------------------------------------------- início

if (params.has('demo')) {
  startDemo(onSpectrum, onCover, onSong);
} else {
  window.wallpaperRegisterAudioListener?.(onSpectrum);
  listenToMedia(onCover, onSong);
}

if (params.has('painel')) {
  import('./dev/panel').then((m) => m.mountPanel());
}

requestAnimationFrame(tick);
