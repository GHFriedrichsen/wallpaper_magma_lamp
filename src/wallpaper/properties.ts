// Liga as opções do painel do Wallpaper Engine às configurações do wallpaper.

import type { RGB } from '../lava/palette';
import { SCHEMA } from './schema';

export interface Settings {
  colorscheme: string;
  waxcolor: RGB;
  waxhot: RGB;
  liquidtop: RGB;
  liquidbottom: RGB;
  glowcolor: RGB;
  huecycle: number;
  shape: 'full' | 'lamp';
  lampmetal: RGB;
  backdrop: RGB;
  blobcount: number;
  blobsize: number;
  speed: number;
  goo: number;
  pool: boolean;
  cymatics: 'both' | 'star' | 'faraday' | 'off';
  cymaticsstrength: number;
  wavescale: number;
  vibrationspeed: number;
  audioreact: number;
  bassheat: number;
  beatbounce: number;
  glow: number;
  shine: number;
  refraction: number;
  brightness: number;
  vignette: number;
  grain: number;
  quality: number;
  mousemode: 'push' | 'heat' | 'ripple' | 'off';
  mousestrength: number;
  mouseradius: number;
  clickripples: boolean;
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
