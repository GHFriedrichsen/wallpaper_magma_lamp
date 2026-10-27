// Cores da capa da música que está tocando (Wallpaper Engine 2.1+).

import type { RGB } from '../lava/palette';

interface ThumbnailEvent {
  primaryColor?: string;
  secondaryColor?: string;
}

declare global {
  interface Window {
    wallpaperRegisterMediaThumbnailListener?: (cb: (event: ThumbnailEvent) => void) => void;
  }
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

export function listenToMedia(onColors: (primary: RGB, secondary: RGB) => void): void {
  window.wallpaperRegisterMediaThumbnailListener?.((event) => {
    const primary = parseCssColor(event.primaryColor);
    const secondary = parseCssColor(event.secondaryColor) ?? primary;
    if (primary && secondary) onColors(primary, secondary);
  });
}
