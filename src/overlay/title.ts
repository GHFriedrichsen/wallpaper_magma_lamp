// Nome da música em volta da tela: até 8 lugares (cantos, meio de cada lado).

import type { Song } from '../wallpaper/media';
import type { Settings } from '../wallpaper/properties';

type Spot = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';
const SPOTS: Spot[] = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];

const LAYOUTS: Record<Exclude<Settings['titlemode'], 'custom' | 'off'>, Spot[]> = {
  all: SPOTS,
  corners: ['tl', 'tr', 'bl', 'br'],
  topbottom: ['tc', 'bc'],
  bottom: ['bc'],
  top: ['tc'],
};

const FONTS: Record<Settings['titlefont'], string> = {
  sans: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "Consolas, 'Courier New', monospace",
  condensed: "'Bahnschrift Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif",
  hand: "'Segoe Print', 'Comic Sans MS', 'Bradley Hand', cursive",
};

/** Margem da borda da tela, em fração da altura. */
const MARGIN = 0.045;

export class TitleOverlay {
  private readonly root = document.createElement('div');
  private readonly items = new Map<Spot, HTMLDivElement>();
  private song: Song = { title: '', artist: '', active: false };
  private visibleSpots: Spot[] = [];

  constructor() {
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;';
    for (const spot of SPOTS) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;white-space:nowrap;transition:opacity .6s;will-change:transform;';
      const m = `${MARGIN * 100}vh`;
      const v = spot[0];
      const h = spot[1];
      let tx = '0';
      let ty = '0';
      if (v === 't') el.style.top = m;
      else if (v === 'b') el.style.bottom = m;
      else {
        el.style.top = '50%';
        ty = '-50%';
      }
      if (h === 'l') el.style.left = m;
      else if (h === 'r') el.style.right = m;
      else {
        el.style.left = '50%';
        tx = '-50%';
      }
      el.dataset.base = `translate(${tx}, ${ty})`;
      el.style.transformOrigin = `${h === 'l' ? 'left' : h === 'r' ? 'right' : 'center'} ${v === 't' ? 'top' : v === 'b' ? 'bottom' : 'center'}`;
      el.style.textAlign = h === 'l' ? 'left' : h === 'r' ? 'right' : 'center';
      this.items.set(spot, el);
      this.root.appendChild(el);
    }
    document.body.appendChild(this.root);
  }

  setSong(song: Song): void {
    this.song = song;
  }

  /** Aplica as opções e o pulso dos graves; chamado a cada quadro. */
  update(s: Settings, bass: number): void {
    const spots =
      s.titlemode === 'off' ? []
      : s.titlemode === 'custom'
        ? SPOTS.filter((spot) => s[`pos${spot}` as keyof Settings] === true)
        : LAYOUTS[s.titlemode];
    this.visibleSpots = spots;

    let text = this.song.title;
    if (s.showartist && this.song.artist) text = `${this.song.title} — ${this.song.artist}`;
    if (s.titleuppercase) text = text.toUpperCase();
    const show = this.song.active && text !== '';
    const [r, g, b] = s.titlecolor.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
    const scale = 1 + Math.min(1.5, bass) * 0.08 * (s.titlepulse / 100);

    for (const [spot, el] of this.items) {
      const on = show && this.visibleSpots.includes(spot);
      if (el.textContent !== text) el.textContent = text;
      el.style.opacity = on ? String(s.titleopacity / 100) : '0';
      el.style.fontFamily = FONTS[s.titlefont];
      el.style.fontSize = `${s.titlesize}px`;
      el.style.color = `rgb(${r}, ${g}, ${b})`;
      el.style.letterSpacing = s.titleuppercase ? '0.12em' : '0.02em';
      el.style.textShadow = '0 0 12px rgba(0,0,0,.6)';
      el.style.transform = `${el.dataset.base} scale(${scale.toFixed(3)})`;
    }
  }
}
