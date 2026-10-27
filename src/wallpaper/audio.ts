// Resume o espectro do Wallpaper Engine (128 valores, ~30 por segundo: 64
// faixas do canal esquerdo e 64 do direito, do grave ao agudo) em níveis de 0
// a 1, batidas e notas. Mesmo modelo do wallpaper Grãos.

export interface Note {
  /** Posição no espectro, de 0 a 63, interpolada entre faixas (ex.: 17,4). */
  band: number;
  /** Força da nota, de 0 a 1. */
  strength: number;
}

export interface AudioLevels {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  /** Força da batida desta leitura, de 0 a 1 (0 = sem batida). */
  beat: number;
  /** Até 3 notas, da mais forte para a mais fraca. */
  notes: Note[];
}

export const BANDS = 64;

const RANGES = {
  bass: [0, 5],
  mid: [6, 23],
  treble: [24, 63],
  energy: [0, 63],
} as const;

/** Nível abaixo do qual é silêncio; o ganho automático não amplifica ruído. */
const FLOOR = { bass: 0.04, mid: 0.02, treble: 0.01, energy: 0.015 } as const;

/** O pico recente cai pela metade em ~4 s (por leitura, a ~30 leituras/s). */
const PEAK_DECAY = 0.995;

const BEAT_MIN = 0.55;
const BEAT_RATIO = 1.18;
const BEAT_GAP_MS = 150;

/** Destaque mínimo para um pico contar como nota. */
const NOTE_FLOOR = 0.01;
/** Picos com menos que isto do destaque do maior pico são descartados. */
const NOTE_RELATIVE = 0.3;
/** Até quantas faixas para cada lado procurar o vale. */
const NOTE_REACH = 3;
const MAX_NOTES = 3;

type Signal = keyof typeof RANGES;

export function silentLevels(): AudioLevels {
  return { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0, notes: [] };
}

export class AudioAnalyzer {
  private peaks: Record<Signal | 'note', number> = {
    bass: 0.1,
    mid: 0.1,
    treble: 0.1,
    energy: 0.1,
    note: 0.05,
  };
  private bassAverage = 0;
  private lastBeat = 0;
  private readonly mono = new Float32Array(BANDS);

  analyze(spectrum: ArrayLike<number>, now = performance.now()): AudioLevels {
    const mono = this.mono;
    const stereo = spectrum.length >= BANDS * 2;
    for (let i = 0; i < BANDS; i++) {
      const left = spectrum[i] ?? 0;
      const right = stereo ? spectrum[i + BANDS] ?? 0 : left;
      mono[i] = Math.max(0, (left + right) / 2);
    }

    const levels = silentLevels();
    for (const signal of Object.keys(RANGES) as Signal[]) {
      const [from, to] = RANGES[signal];
      let sum = 0;
      for (let i = from; i <= to; i++) sum += mono[i];
      levels[signal] = this.gain(signal, sum / (to - from + 1), FLOOR[signal]);
    }

    this.bassAverage += (levels.bass - this.bassAverage) * 0.08;
    if (
      levels.bass > BEAT_MIN &&
      levels.bass > this.bassAverage * BEAT_RATIO &&
      now - this.lastBeat > BEAT_GAP_MS
    ) {
      this.lastBeat = now;
      const over = levels.bass / Math.max(this.bassAverage, 0.05) - BEAT_RATIO;
      levels.beat = Math.min(1, 0.35 + over * 1.5);
    }

    levels.notes = this.findNotes();
    return levels;
  }

  /** Ganho automático pelo pico recente, com raiz para realçar os níveis médios. */
  private gain(signal: Signal | 'note', value: number, floor: number): number {
    const peak = Math.max(value, this.peaks[signal] * PEAK_DECAY, floor * 2);
    this.peaks[signal] = peak;
    if (value < floor) return 0;
    return Math.sqrt(Math.min(1, value / peak));
  }

  /** Notas são picos do espectro: faixas mais altas que as vizinhas. */
  private findNotes(): Note[] {
    const mono = this.mono;
    const found: { band: number; prominence: number }[] = [];

    for (let i = 1; i < BANDS - 1; i++) {
      const v = mono[i];
      if (!(v > mono[i - 1] && v >= mono[i + 1])) continue;

      // Destaque: altura do pico menos o vale mais alto dos dois lados.
      let leftValley = v;
      for (let j = i - 1; j >= Math.max(0, i - NOTE_REACH); j--) leftValley = Math.min(leftValley, mono[j]);
      let rightValley = v;
      for (let j = i + 1; j <= Math.min(BANDS - 1, i + NOTE_REACH); j++) rightValley = Math.min(rightValley, mono[j]);
      const prominence = v - Math.max(leftValley, rightValley);
      if (prominence < NOTE_FLOOR) continue;

      // Interpolação parabólica: a nota pode cair entre duas faixas.
      const a = mono[i - 1];
      const c = mono[i + 1];
      const curve = a - 2 * v + c;
      const delta = curve !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / curve)) : 0;
      found.push({ band: i + delta, prominence });
    }

    if (found.length === 0) {
      this.gain('note', 0, NOTE_FLOOR);
      return [];
    }

    found.sort((x, y) => y.prominence - x.prominence);
    const strongest = found[0].prominence;
    this.gain('note', strongest, NOTE_FLOOR);
    const peak = this.peaks.note;

    return found
      .filter((n) => n.prominence >= strongest * NOTE_RELATIVE)
      .slice(0, MAX_NOTES)
      .map((n) => ({ band: n.band, strength: Math.sqrt(Math.min(1, n.prominence / peak)) }));
  }
}
