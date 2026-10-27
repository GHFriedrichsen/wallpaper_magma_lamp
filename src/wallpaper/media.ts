// Música que está tocando (Wallpaper Engine 2.1+): cores da capa, título,
// artista e se está tocando.

import type { RGB } from '../ferro/palette';

interface ThumbnailEvent {
  primaryColor?: string;
  secondaryColor?: string;
}

interface PropertiesEvent {
  title?: string;
  artist?: string;
}

interface PlaybackEvent {
  /** 0 = parado, 1 = tocando, 2 = pausado. */
  state?: number;
}

declare global {
  interface Window {
    wallpaperRegisterMediaThumbnailListener?: (cb: (event: ThumbnailEvent) => void) => void;
    wallpaperRegisterMediaPropertiesListener?: (cb: (event: PropertiesEvent) => void) => void;
    wallpaperRegisterMediaPlaybackListener?: (cb: (event: PlaybackEvent) => void) => void;
  }
}

export interface Song {
  title: string;
  artist: string;
  /** Falso quando a música parou (pausada continua valendo). */
  active: boolean;
}

/** Aceita "#rrggbb", "#rgb" ou "rgb(r, g, b)"; devolve null se não entender. */
export function parseCssColor(css: string | undefined): RGB | null {
  if (!css) return null;
  const s = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return null;
}

export function listenToMedia(onColors: (primary: RGB, secondary: RGB) => void, onSong: (song: Song) => void): void {
  window.wallpaperRegisterMediaThumbnailListener?.((event) => {
    const primary = parseCssColor(event.primaryColor);
    const secondary = parseCssColor(event.secondaryColor) ?? primary;
    if (primary && secondary) onColors(primary, secondary);
  });

  const song: Song = { title: '', artist: '', active: false };
  window.wallpaperRegisterMediaPropertiesListener?.((event) => {
    song.title = event.title ?? '';
    song.artist = event.artist ?? '';
    song.active = song.title !== '';
    onSong({ ...song });
  });
  window.wallpaperRegisterMediaPlaybackListener?.((event) => {
    song.active = event.state !== 0 && song.title !== '';
    onSong({ ...song });
  });
}
