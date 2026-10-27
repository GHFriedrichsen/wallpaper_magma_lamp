// Liga as opções do painel do Wallpaper Engine às configurações do wallpaper.

import type { RGB } from '../ferro/palette';
import { SCHEMA } from './schema';

export interface Settings {
  colorscheme: string;
  light1: RGB;
  light2: RGB;
  light3: RGB;
  background: RGB;
  huecycle: number;
  light1power: number;
  light2power: number;
  light3power: number;
  lightheight: number;
  lightspeed: number;
  lightpulse: number;
  backgroundglow: number;
  shape: 'puddle' | 'sphere' | 'geodesic';
  spheremotion: 'spin' | 'mouse' | 'both' | 'still';
  spherespin: number;
  fluidcolor: RGB;
  geocolor: RGB;
  metallic: number;
  holesize: number;
  strut: number;
  idleholes: number;
  drops: number;
  dropheight: number;
  mirror: number;
  size: number;
  spikeheight: number;
  sharpness: number;
  density: number;
  idlefield: number;
  spin: number;
  cymatics: 'notes' | 'hex' | 'mandala';
  changespeed: number;
  camangle: number;
  zoom: number;
  orbit: number;
  titlemode: 'all' | 'corners' | 'topbottom' | 'bottom' | 'top' | 'custom' | 'off';
  postl: boolean;
  postc: boolean;
  postr: boolean;
  posml: boolean;
  posmr: boolean;
  posbl: boolean;
  posbc: boolean;
  posbr: boolean;
  showartist: boolean;
  titlefont: 'sans' | 'serif' | 'mono' | 'condensed' | 'hand';
  titlesize: number;
  titlecolor: RGB;
  titleopacity: number;
  titleuppercase: boolean;
  titlepulse: number;
  audioreact: number;
  bassfield: number;
  beatjump: number;
  trebleshimmer: number;
  brightness: number;
  vignette: number;
  grain: number;
  detail: 'low' | 'medium' | 'high';
  quality: number;
  mouse: boolean;
  mousemagnet: number;
  mouseparallax: number;
  mouseclick: number;
  /** Limite de quadros por segundo (opção geral do Wallpaper Engine; 0 = sem limite). */
  fps: number;
}

export function parseColor(value: string): RGB {
  const parts = value.trim().split(/\s+/).map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function defaultSettings(): Settings {
  const s: Record<string, unknown> = { fps: 0 };
  for (const def of SCHEMA) {
    if (def.type === 'header') continue;
    s[def.key] = def.type === 'color' ? parseColor(def.value) : def.value;
  }
  return s as unknown as Settings;
}

type RawProps = Record<string, { value: unknown } | undefined>;

/** Aplica sobre `settings` só as opções que vieram em `props`. */
export function applyProps(settings: Settings, props: RawProps): void {
  const target = settings as unknown as Record<string, unknown>;
  for (const def of SCHEMA) {
    if (def.type === 'header') continue;
    const prop = props[def.key];
    if (!prop || prop.value === undefined) continue;
    const v = prop.value;
    switch (def.type) {
      case 'color':
        target[def.key] = parseColor(String(v));
        break;
      case 'slider':
        target[def.key] = Math.max(def.min, Math.min(def.max, Number(v)));
        break;
      case 'bool':
        target[def.key] = v === true || v === 'true';
        break;
      case 'combo':
        target[def.key] = def.options.some((o) => o.value === v) ? v : def.value;
        break;
    }
  }
}

declare global {
  interface Window {
    wallpaperPropertyListener?: {
      applyUserProperties?: (props: RawProps) => void;
      applyGeneralProperties?: (props: { fps?: number }) => void;
    };
  }
}

/** Registra o ouvinte do Wallpaper Engine; `onChange` roda a cada mudança. */
export function listenToProperties(settings: Settings, onChange: () => void): void {
  window.wallpaperPropertyListener = {
    applyUserProperties(props) {
      applyProps(settings, props);
      onChange();
    },
    applyGeneralProperties(props) {
      if (typeof props.fps === 'number') settings.fps = props.fps;
      onChange();
    },
  };
}
