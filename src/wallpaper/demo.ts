// Áudio simulado para testar no navegador (?demo): uma melodia de notas de
// 2 s, às vezes com uma segunda nota junto, mais bumbo, chimbal e um trecho
// mais alto a cada 8 s. Também troca a "música" (cores da capa, título e
// artista) a cada 12 s.

import type { RGB } from '../ferro/palette';
import { BANDS } from './audio';
import type { Song } from './media';

const MELODY = [9, 14, 18, 12, 24, 31, 20, 40, 16, 27, 35, 48];
const COVERS: { colors: [RGB, RGB]; title: string; artist: string }[] = [
  { colors: [[0.9, 0.3, 0.2], [0.2, 0.1, 0.4]], title: 'Campo Magnético', artist: 'Demo' },
  { colors: [[0.2, 0.7, 0.9], [0.05, 0.1, 0.2]], title: 'Rosensweig', artist: 'Demo' },
  { colors: [[0.95, 0.8, 0.2], [0.5, 0.1, 0.3]], title: 'Cimática nº 3', artist: 'Demo' },
];

export function startDemo(
  onSpectrum: (spectrum: Float32Array) => void,
  onCover: (primary: RGB, secondary: RGB) => void,
  onSong: (song: Song) => void,
): void {
  const spectrum = new Float32Array(BANDS * 2);
  const start = performance.now();
  let cover = -1;

  setInterval(() => {
    const t = (performance.now() - start) / 1000;
    const loud = t % 8 > 6 ? 1.8 : 1;
    const beatPhase = t % 0.5;
    const kick = Math.exp(-beatPhase / 0.09) * (Math.floor(t / 0.5) % 4 === 3 ? 1.2 : 0.9);
    const hatPhase = (t + 0.25) % 0.5;
    const hat = Math.exp(-hatPhase / 0.04);
    const step = Math.floor(t / 2);
    const note = MELODY[step % MELODY.length];
    const second = step % 3 === 1 ? MELODY[(step + 4) % MELODY.length] : -1;
    const noteEnv = Math.min(1, (t % 2) * 8) * (1 - 0.3 * ((t % 2) / 2));

    for (let i = 0; i < BANDS; i++) {
      let v = 0.08 * Math.exp(-i / 18) * (0.7 + 0.3 * Math.sin(t * 3 + i));
      if (i <= 6) v += kick * 0.55 * (1 - i / 8);
      if (i >= 28) v += hat * 0.06 * (0.5 + Math.random() * 0.5);
      v += 0.32 * noteEnv * Math.exp(-((i - note) ** 2) / 1.2);
      if (second >= 0) v += 0.22 * noteEnv * Math.exp(-((i - second) ** 2) / 1.2);
      v *= loud * (0.92 + Math.random() * 0.08);
      spectrum[i] = v;
      spectrum[i + BANDS] = v * (0.9 + Math.random() * 0.2);
    }
    onSpectrum(spectrum);

    const c = Math.floor(t / 12) % COVERS.length;
    if (c !== cover) {
      cover = c;
      onCover(COVERS[c].colors[0], COVERS[c].colors[1]);
      onSong({ title: COVERS[c].title, artist: COVERS[c].artist, active: true });
    }
  }, 33);
}
