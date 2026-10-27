// Opções do painel do Wallpaper Engine. Esta tabela é a fonte única: o
// scripts/project.ts gera o public/project.json a partir dela, o painel de
// testes (?painel) monta os controles com ela e o properties.ts tira dela os
// valores padrão. Arquivo sem imports, para rodar direto no Node.

export type PropertyDef =
  | { key: string; type: 'header'; text: string; condition?: string }
  | {
      key: string;
      type: 'slider';
      text: string;
      value: number;
      min: number;
      max: number;
      step?: number;
      condition?: string;
    }
  | { key: string; type: 'bool'; text: string; value: boolean; condition?: string }
  | { key: string; type: 'color'; text: string; value: string; condition?: string }
  | {
      key: string;
      type: 'combo';
      text: string;
      value: string;
      options: { label: string; value: string }[];
      condition?: string;
    };

const CUSTOM = "colorscheme.value == 'custom'";
const LAMP = "shape.value == 'lamp'";
const MOUSE = "mousemode.value != 'off'";
const CYMATICS = "cymatics.value != 'off'";

export const SCHEMA: PropertyDef[] = [
  { key: 'h_colors', type: 'header', text: '<b>Cores</b>' },
  {
    key: 'colorscheme',
    type: 'combo',
    text: 'Esquema de cores',
    value: 'classic',
    options: [
      { label: 'Clássica (laranja no roxo)', value: 'classic' },
      { label: 'Magma (vermelho no preto)', value: 'magma' },
      { label: 'Oceano', value: 'ocean' },
      { label: 'Neon', value: 'neon' },
      { label: 'Pôr do sol', value: 'sunset' },
      { label: 'Ácido', value: 'acid' },
      { label: 'Lavanda', value: 'lavender' },
      { label: 'Mercúrio', value: 'mercury' },
      { label: 'Cores da música (capa)', value: 'music' },
      { label: 'Personalizado', value: 'custom' },
    ],
  },
  { key: 'waxcolor', type: 'color', text: 'Cera', value: '1 0.3 0.04', condition: CUSTOM },
  { key: 'waxhot', type: 'color', text: 'Cera quente (núcleo)', value: '1 0.75 0.25', condition: CUSTOM },
  { key: 'liquidtop', type: 'color', text: 'Líquido em cima', value: '0.06 0.01 0.1', condition: CUSTOM },
  { key: 'liquidbottom', type: 'color', text: 'Líquido embaixo', value: '0.3 0.03 0.2', condition: CUSTOM },
  { key: 'glowcolor', type: 'color', text: 'Brilho em volta da cera', value: '1 0.3 0.1', condition: CUSTOM },
  { key: 'huecycle', type: 'slider', text: 'Arco-íris (velocidade, 0 desliga)', value: 0, min: 0, max: 100 },

  { key: 'h_lamp', type: 'header', text: '<b>Lâmpada</b>' },
  {
    key: 'shape',
    type: 'combo',
    text: 'Formato',
    value: 'full',
    options: [
      { label: 'Tela cheia', value: 'full' },
      { label: 'Lâmpada de vidro', value: 'lamp' },
    ],
  },
  { key: 'lampmetal', type: 'color', text: 'Metal da lâmpada', value: '0.55 0.5 0.48', condition: LAMP },
  { key: 'backdrop', type: 'color', text: 'Fundo atrás da lâmpada', value: '0.03 0.02 0.04', condition: LAMP },
  { key: 'blobcount', type: 'slider', text: 'Quantidade de bolhas', value: 9, min: 3, max: 20 },
  { key: 'blobsize', type: 'slider', text: 'Tamanho das bolhas (%)', value: 100, min: 50, max: 200 },
  { key: 'speed', type: 'slider', text: 'Velocidade (%)', value: 100, min: 0, max: 300 },
  { key: 'goo', type: 'slider', text: 'Fusão entre bolhas (%)', value: 50, min: 0, max: 100 },
  { key: 'pool', type: 'bool', text: 'Poça de cera no fundo', value: true },

  { key: 'h_cymatics', type: 'header', text: '<b>Cimática</b>' },
  {
    key: 'cymatics',
    type: 'combo',
    text: 'Cimática',
    value: 'both',
    options: [
      { label: 'Gotas estrela + ondas de Faraday', value: 'both' },
      { label: 'Só gotas estrela (bolhas vibram)', value: 'star' },
      { label: 'Só ondas de Faraday (líquido vibra)', value: 'faraday' },
      { label: 'Desligada', value: 'off' },
    ],
  },
  { key: 'cymaticsstrength', type: 'slider', text: 'Força da cimática (%)', value: 100, min: 0, max: 300, condition: CYMATICS },
  { key: 'wavescale', type: 'slider', text: 'Tamanho das ondas (%)', value: 100, min: 25, max: 300, condition: CYMATICS },
  { key: 'vibrationspeed', type: 'slider', text: 'Velocidade da vibração (%)', value: 100, min: 0, max: 300, condition: CYMATICS },

  { key: 'h_audio', type: 'header', text: '<b>Áudio</b>' },
  { key: 'audioreact', type: 'slider', text: 'Reação ao áudio (%)', value: 100, min: 0, max: 300 },
  { key: 'bassheat', type: 'slider', text: 'Graves aquecem a cera (%)', value: 100, min: 0, max: 300 },
  { key: 'beatbounce', type: 'slider', text: 'Batidas sacodem a cera (%)', value: 100, min: 0, max: 300 },

  { key: 'h_look', type: 'header', text: '<b>Aparência</b>' },
  { key: 'glow', type: 'slider', text: 'Brilho (%)', value: 100, min: 0, max: 200 },
  { key: 'shine', type: 'slider', text: 'Reflexo na cera (%)', value: 100, min: 0, max: 200 },
  { key: 'refraction', type: 'slider', text: 'Refração das ondas (%)', value: 100, min: 0, max: 200 },
  { key: 'brightness', type: 'slider', text: 'Luminosidade (%)', value: 100, min: 50, max: 150 },
  { key: 'vignette', type: 'slider', text: 'Vinheta (%)', value: 40, min: 0, max: 100 },
  { key: 'grain', type: 'slider', text: 'Granulado de filme (%)', value: 10, min: 0, max: 100 },
  { key: 'quality', type: 'slider', text: 'Resolução (%)', value: 100, min: 40, max: 100 },

  { key: 'h_mouse', type: 'header', text: '<b>Mouse</b>' },
  {
    key: 'mousemode',
    type: 'combo',
    text: 'Mouse',
    value: 'push',
    options: [
      { label: 'Empurra a cera', value: 'push' },
      { label: 'Aquece a cera', value: 'heat' },
      { label: 'Faz ondas no líquido', value: 'ripple' },
      { label: 'Desligado', value: 'off' },
    ],
  },
  { key: 'mousestrength', type: 'slider', text: 'Força do mouse (%)', value: 100, min: 0, max: 300, condition: MOUSE },
  { key: 'mouseradius', type: 'slider', text: 'Alcance do mouse', value: 15, min: 5, max: 40, condition: MOUSE },
  { key: 'clickripples', type: 'bool', text: 'Clique faz onda', value: true },
];
