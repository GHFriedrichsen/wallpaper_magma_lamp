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
const SPHERE = "shape.value != 'puddle'";
const GEO = "shape.value == 'geodesic'";
const FERRO = "shape.value != 'geodesic'";
const TITLE = "titlemode.value != 'off'";
const TITLE_CUSTOM = "titlemode.value == 'custom'";
const MOUSE = 'mouse.value == true';

export const SCHEMA: PropertyDef[] = [
  { key: 'h_colors', type: 'header', text: '<b>Cores</b>' },
  {
    key: 'colorscheme',
    type: 'combo',
    text: 'Esquema de cores',
    value: 'custom',
    options: [
      { label: 'Personalizado (escolha abaixo)', value: 'custom' },
      { label: 'Aurora (ciano e magenta)', value: 'aurora' },
      { label: 'Fogo (laranja e vermelho)', value: 'fire' },
      { label: 'Gelo (azul e branco)', value: 'ice' },
      { label: 'Ouro', value: 'gold' },
      { label: 'Neon (verde e roxo)', value: 'neon' },
      { label: 'Estúdio (branco)', value: 'studio' },
      { label: 'Cores da música (capa)', value: 'music' },
    ],
  },
  { key: 'light1', type: 'color', text: 'Cor da luz 1', value: '0.1 0.8 1', condition: CUSTOM },
  { key: 'light2', type: 'color', text: 'Cor da luz 2', value: '1 0.15 0.65', condition: CUSTOM },
  { key: 'light3', type: 'color', text: 'Cor da luz 3', value: '0.5 0.3 1', condition: CUSTOM },
  { key: 'background', type: 'color', text: 'Cor do fundo', value: '0.012 0.012 0.025', condition: CUSTOM },
  { key: 'huecycle', type: 'slider', text: 'Arco-íris (velocidade, 0 desliga)', value: 0, min: 0, max: 100 },

  { key: 'h_lights', type: 'header', text: '<b>Luzes</b>' },
  { key: 'light1power', type: 'slider', text: 'Intensidade da luz 1 (%)', value: 100, min: 0, max: 200 },
  { key: 'light2power', type: 'slider', text: 'Intensidade da luz 2 (%)', value: 100, min: 0, max: 200 },
  { key: 'light3power', type: 'slider', text: 'Intensidade da luz 3 (%)', value: 100, min: 0, max: 200 },
  { key: 'lightheight', type: 'slider', text: 'Altura das luzes (°)', value: 25, min: 5, max: 85 },
  { key: 'lightspeed', type: 'slider', text: 'Luzes girando', value: 20, min: 0, max: 100 },
  { key: 'lightpulse', type: 'slider', text: 'Luzes pulsam com a música (%)', value: 60, min: 0, max: 200 },
  { key: 'backgroundglow', type: 'slider', text: 'Brilho das luzes no fundo (%)', value: 100, min: 0, max: 300 },

  { key: 'h_fluid', type: 'header', text: '<b>Ferrofluido</b>' },
  {
    key: 'shape',
    type: 'combo',
    text: 'Formato',
    value: 'puddle',
    options: [
      { label: 'Ferrofluido: poça (plana)', value: 'puddle' },
      { label: 'Ferrofluido: esfera', value: 'sphere' },
      { label: 'Esfera geodésica de fluido denso', value: 'geodesic' },
    ],
  },
  {
    key: 'spheremotion',
    type: 'combo',
    text: 'Movimento da esfera',
    value: 'spin',
    options: [
      { label: 'Gira em torno de si', value: 'spin' },
      { label: 'Segue o mouse', value: 'mouse' },
      { label: 'Gira e segue o mouse', value: 'both' },
      { label: 'Parada', value: 'still' },
    ],
    condition: SPHERE,
  },
  { key: 'spherespin', type: 'slider', text: 'Velocidade do giro da esfera', value: 25, min: 0, max: 100, condition: SPHERE },
  { key: 'fluidcolor', type: 'color', text: 'Cor do ferrofluido', value: '0.02 0.02 0.025', condition: FERRO },
  { key: 'geocolor', type: 'color', text: 'Cor do fluido denso', value: '0.75 0.04 0.05', condition: GEO },
  { key: 'metallic', type: 'slider', text: 'Metálico (%)', value: 25, min: 0, max: 100, condition: GEO },
  { key: 'holesize', type: 'slider', text: 'Tamanho dos buracos (%)', value: 100, min: 0, max: 150, condition: GEO },
  { key: 'strut', type: 'slider', text: 'Espessura da trama (%)', value: 100, min: 30, max: 250, condition: GEO },
  { key: 'idleholes', type: 'slider', text: 'Buracos em silêncio (%)', value: 0, min: 0, max: 100, condition: GEO },
  { key: 'drops', type: 'slider', text: 'Gotas (%)', value: 100, min: 0, max: 300, condition: GEO },
  { key: 'dropheight', type: 'slider', text: 'Altura das gotas (%)', value: 100, min: 20, max: 300, condition: GEO },
  { key: 'mirror', type: 'slider', text: 'Espelhamento do fluido (%)', value: 100, min: 0, max: 200 },
  { key: 'size', type: 'slider', text: 'Tamanho do fluido (%)', value: 100, min: 50, max: 150 },
  { key: 'spikeheight', type: 'slider', text: 'Altura dos espinhos (%)', value: 100, min: 0, max: 200, condition: FERRO },
  { key: 'sharpness', type: 'slider', text: 'Pontas afiadas (%)', value: 50, min: 0, max: 100, condition: FERRO },
  { key: 'density', type: 'slider', text: 'Densidade (espinhos ou células) (%)', value: 100, min: 50, max: 200 },
  { key: 'idlefield', type: 'slider', text: 'Ímã em silêncio (%)', value: 30, min: 0, max: 100, condition: FERRO },
  { key: 'spin', type: 'slider', text: 'Giro da figura', value: 15, min: 0, max: 100, condition: FERRO },

  { key: 'h_cymatics', type: 'header', text: '<b>Cimática</b>' },
  {
    key: 'cymatics',
    type: 'combo',
    text: 'Figura dos espinhos',
    condition: FERRO,
    value: 'notes',
    options: [
      { label: 'Muda com as notas', value: 'notes' },
      { label: 'Sempre favo (uniforme)', value: 'hex' },
      { label: 'Sempre mandala', value: 'mandala' },
    ],
  },
  { key: 'changespeed', type: 'slider', text: 'Velocidade da troca de figura (%)', value: 100, min: 10, max: 300, condition: FERRO },

  { key: 'h_camera', type: 'header', text: '<b>Câmera</b>' },
  { key: 'camangle', type: 'slider', text: 'Ângulo da câmera (90 = de cima)', value: 62, min: 15, max: 90 },
  { key: 'zoom', type: 'slider', text: 'Zoom (%)', value: 100, min: 50, max: 200 },
  { key: 'orbit', type: 'slider', text: 'Câmera girando', value: 8, min: 0, max: 100 },

  { key: 'h_title', type: 'header', text: '<b>Nome da música</b>' },
  {
    key: 'titlemode',
    type: 'combo',
    text: 'Onde mostrar',
    value: 'all',
    options: [
      { label: 'Em volta toda (8 lugares)', value: 'all' },
      { label: 'Nos 4 cantos', value: 'corners' },
      { label: 'Em cima e embaixo, no meio', value: 'topbottom' },
      { label: 'Só embaixo, no meio', value: 'bottom' },
      { label: 'Só em cima, no meio', value: 'top' },
      { label: 'Escolher posições', value: 'custom' },
      { label: 'Desligado', value: 'off' },
    ],
  },
  { key: 'postl', type: 'bool', text: 'Canto superior esquerdo', value: true, condition: TITLE_CUSTOM },
  { key: 'postc', type: 'bool', text: 'Em cima, no meio', value: true, condition: TITLE_CUSTOM },
  { key: 'postr', type: 'bool', text: 'Canto superior direito', value: true, condition: TITLE_CUSTOM },
  { key: 'posml', type: 'bool', text: 'Esquerda, no meio', value: true, condition: TITLE_CUSTOM },
  { key: 'posmr', type: 'bool', text: 'Direita, no meio', value: true, condition: TITLE_CUSTOM },
  { key: 'posbl', type: 'bool', text: 'Canto inferior esquerdo', value: true, condition: TITLE_CUSTOM },
  { key: 'posbc', type: 'bool', text: 'Embaixo, no meio', value: true, condition: TITLE_CUSTOM },
  { key: 'posbr', type: 'bool', text: 'Canto inferior direito', value: true, condition: TITLE_CUSTOM },
  { key: 'showartist', type: 'bool', text: 'Mostrar o artista', value: false, condition: TITLE },
  {
    key: 'titlefont',
    type: 'combo',
    text: 'Fonte',
    value: 'sans',
    options: [
      { label: 'Sem serifa', value: 'sans' },
      { label: 'Com serifa', value: 'serif' },
      { label: 'Monoespaçada', value: 'mono' },
      { label: 'Condensada', value: 'condensed' },
      { label: 'Manuscrita', value: 'hand' },
    ],
    condition: TITLE,
  },
  { key: 'titlesize', type: 'slider', text: 'Tamanho do texto', value: 18, min: 10, max: 60, condition: TITLE },
  { key: 'titlecolor', type: 'color', text: 'Cor do texto', value: '0.9 0.9 0.95', condition: TITLE },
  { key: 'titleopacity', type: 'slider', text: 'Opacidade do texto (%)', value: 70, min: 5, max: 100, condition: TITLE },
  { key: 'titleuppercase', type: 'bool', text: 'Letras maiúsculas', value: false, condition: TITLE },
  { key: 'titlepulse', type: 'slider', text: 'Texto pulsa com os graves (%)', value: 50, min: 0, max: 200, condition: TITLE },

  { key: 'h_audio', type: 'header', text: '<b>Áudio</b>' },
  { key: 'audioreact', type: 'slider', text: 'Reação ao áudio (%)', value: 100, min: 0, max: 300 },
  { key: 'bassfield', type: 'slider', text: 'Graves fortalecem o ímã ou incham a esfera (%)', value: 100, min: 0, max: 300 },
  { key: 'beatjump', type: 'slider', text: 'Batidas fazem pular e soltar gotas (%)', value: 100, min: 0, max: 300 },
  { key: 'trebleshimmer', type: 'slider', text: 'Agudos fazem as pontas tremerem (%)', value: 100, min: 0, max: 300, condition: FERRO },

  { key: 'h_look', type: 'header', text: '<b>Aparência</b>' },
  { key: 'brightness', type: 'slider', text: 'Luminosidade (%)', value: 100, min: 50, max: 150 },
  { key: 'vignette', type: 'slider', text: 'Vinheta (%)', value: 50, min: 0, max: 100 },
  { key: 'grain', type: 'slider', text: 'Granulado de filme (%)', value: 8, min: 0, max: 100 },
  {
    key: 'detail',
    type: 'combo',
    text: 'Qualidade',
    value: 'medium',
    options: [
      { label: 'Baixa (PC fraco)', value: 'low' },
      { label: 'Média', value: 'medium' },
      { label: 'Alta', value: 'high' },
    ],
  },
  { key: 'quality', type: 'slider', text: 'Resolução (%)', value: 100, min: 40, max: 100 },

  { key: 'h_mouse', type: 'header', text: '<b>Mouse</b>' },
  { key: 'mouse', type: 'bool', text: 'Mouse ligado', value: true },
  { key: 'mousemagnet', type: 'slider', text: 'Ímã / esfera seguem o mouse (%)', value: 100, min: 0, max: 300, condition: MOUSE },
  { key: 'mouseparallax', type: 'slider', text: 'Câmera acompanha o mouse (%)', value: 30, min: 0, max: 300, condition: MOUSE },
  { key: 'mouseclick', type: 'slider', text: 'Onda do clique (%)', value: 100, min: 0, max: 300, condition: MOUSE },
];
