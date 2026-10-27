# Ferrofluido

Wallpaper web para o Wallpaper Engine: um ferrofluido (líquido magnético,
preto e espelhado) no centro da tela, em que o som vira **cimática**. A música
é o campo magnético: os graves levantam os espinhos e cada nota arruma os
espinhos numa figura. O nome da música aparece em volta da tela.

| Som | O que o ferrofluido faz |
|---|---|
| **Graves** | o ímã fica mais forte e os espinhos crescem |
| **Notas** | cada nota escolhe uma figura de espinhos: **favo** (grade hexagonal, como o ferrofluido faz sozinho) ou **mandala** (um espinho no centro e anéis com 3 a 10 espinhos por volta). Nota grave = poucos espinhos grandes; nota aguda = muitos espinhos pequenos. A mesma nota desenha sempre a mesma figura |
| **Troca de nota** | os espinhos da figura velha afundam enquanto os da nova sobem |
| **Batidas** | os espinhos pulam, a poça faz uma onda e a esfera incha e volta |
| **Agudos** | as pontas dos espinhos tremem |
| **Volume** | as luzes refletidas pulsam |

Sem som, o ímã continua ligado no nível **Ímã em silêncio**, com espinhos
baixos.

## Formatos

- **Poça**: uma poça redonda e baixa sobre um chão escuro. O ímã fica embaixo
  e pode seguir o mouse; a poça vai atrás, mais devagar.
- **Esfera**: o ferrofluido envolve um ímã esférico e os espinhos saem para
  todos os lados. A esfera pode **girar em torno de si**, **seguir o mouse**
  (rolando enquanto anda), fazer **as duas coisas** ou ficar **parada**.

## Instalar no Wallpaper Engine

```bash
npm install
npm run build
```

A pasta `dist/` é o wallpaper (`index.html`, `project.json`, `preview.jpg` e
`assets/`). No Wallpaper Engine: **Criar wallpaper → Abrir wallpaper** e
escolha `dist/index.html`, ou copie a pasta para
`steamapps/common/wallpaper_engine/projects/myprojects/ferrofluido`.

Para reagir ao som, a gravação de áudio precisa estar ligada nas configurações
do Wallpaper Engine (o `project.json` já declara `supportsaudioprocessing`). O
nome da música e as cores da capa usam a integração de mídia do Wallpaper
Engine 2.1+.

## Testar no navegador

```bash
npm run dev
```

Abra `http://localhost:5173/?demo&painel`:

- `?demo` toca áudio simulado (melodia de notas de 2 s, bumbo, chimbal e um
  trecho mais alto a cada 8 s) e troca de "música" a cada 12 s: título,
  artista e cores da capa.
- `?painel` mostra os mesmos controles do painel do Wallpaper Engine e o fps.
- Qualquer opção também vai pela URL, com a chave do `project.json`:
  `?demo&shape=sphere&spheremotion=both&colorscheme=fire`. Cores com vírgula:
  `light1=1,0.2,0`.

## Opções

Todas as opções ficam em `src/wallpaper/schema.ts`. O `npm run build` gera o
`public/project.json` a partir dele (`npm run project` gera só o manifesto).

| Grupo | Opções |
|---|---|
| Cores | Esquema (Personalizado, Aurora, Fogo, Gelo, Ouro, Neon, Estúdio, Cores da música); no Personalizado, a cor de cada uma das 3 luzes e do fundo; Arco-íris |
| Luzes | Intensidade de cada luz, altura, velocidade do giro, pulso com a música, brilho das luzes no fundo |
| Ferrofluido | Formato (poça ou esfera), movimento e giro da esfera, cor do fluido, espelhamento, tamanho, altura e ponta dos espinhos, densidade, ímã em silêncio, giro da figura |
| Cimática | Figura (muda com as notas, sempre favo, sempre mandala), velocidade da troca |
| Câmera | Ângulo (90 = de cima), zoom, órbita lenta |
| Nome da música | Onde mostrar: em volta toda (8 lugares), 4 cantos, em cima e embaixo, só embaixo, só em cima, escolher cada posição ou desligado; artista, fonte, tamanho, cor, opacidade, maiúsculas, pulso com os graves |
| Áudio | Reação ao áudio, graves fortalecem o ímã, batidas fazem pular, agudos fazem tremer |
| Aparência | Luminosidade, vinheta, granulado, qualidade (passos do raio), resolução |
| Mouse | Ligado/desligado e a força de cada ação: ímã ou esfera seguem o mouse, câmera acompanha o mouse, onda do clique (0 desliga a ação) |

O limite de fps do Wallpaper Engine também é respeitado.

## Como funciona

### Áudio (`src/wallpaper/audio.ts`)

Mesmo modelo do wallpaper Grãos: o espectro de 128 valores (64 faixas por
canal) vira graves (faixas 0–5), médios (6–23), agudos (24–63) e energia, com
ganho automático (pico que cai pela metade em ~4 s), raiz quadrada e mínimo
antes de reagir. Batida: grave acima de 0,55 e 18% acima da média, no máximo
uma a cada 150 ms. Notas são picos do espectro com destaque mínimo, posição
interpolada por parábola, até 3 por leitura.

### Cimática (`src/ferro/patterns.ts`)

As 64 faixas se dividem em 16 figuras, do grave ao agudo, alternando favo e
mandalas de simetria 3 a 10. A força de cada figura sobe 35% do caminho por
leitura quando a nota soa e cai 6% quando para. A figura troca quando outra
nota domina por 0,3 s com força acima de 0,2, e a troca leva 0,7 s.

A altura dos espinhos segue o espaçamento, como no ferrofluido de verdade
(instabilidade de Rosensweig): figura com poucos espinhos tem espinhos altos;
com muitos, baixos. Nunca passam de 1,6 vez a distância entre eles.

### Movimento (`src/ferro/ferro.ts`)

- A altura dos espinhos segue o campo por uma mola um pouco solta: o fluido
  tem inércia e passa do ponto antes de assentar.
- Batida: empurrão na mola dos espinhos; na poça, onda a partir do ímã; na
  esfera, inchaço que volta como gelatina.
- A esfera que segue o mouse vai por uma mola com amortecimento e rola na
  direção em que anda.

### Desenho (`src/render/shader.ts`)

- **Poça**: campo de alturas percorrido por raymarching. Cada pixel lança um
  raio, anda até furar a superfície, refina o ponto com 6 bisseções e calcula
  a normal por diferenças finitas. Só os raios que passam pelo cilindro da
  poça fazem esse trabalho.
- **Esfera**: distância até a superfície (raio + espinhos naquela direção),
  percorrida por sphere tracing. Os espinhos ficam em anéis de latitude: no
  favo, cada anel tem quantos espinhos cabem; na mandala, o anel k tem
  k × simetria.
- O fluido é quase preto e espelhado: a cor vem do reflexo de 3 luzes
  coloridas (softboxes) e de um anel de luz em volta. Os vales entre os
  espinhos ficam mais escuros.

## Estrutura

```
src/main.ts                  liga tudo e roda os quadros
src/wallpaper/schema.ts      opções do painel (fonte do project.json)
src/wallpaper/properties.ts  aplica as opções do Wallpaper Engine
src/wallpaper/audio.ts       espectro → níveis, batidas e notas
src/wallpaper/media.ts       título, artista e cores da capa da música
src/wallpaper/demo.ts        áudio e música simulados (?demo)
src/ferro/patterns.ts        notas → figuras de espinhos
src/ferro/ferro.ts           movimento: espinhos, ímã, esfera, ondas
src/ferro/camera.ts          câmera e mouse → mundo
src/ferro/palette.ts         esquemas de cores das luzes
src/ferro/math3.ts           vetores e matrizes 3×3
src/overlay/title.ts         nome da música em volta da tela
src/render/shader.ts         shader (GLSL)
src/render/renderer.ts       WebGL2
src/dev/panel.ts             painel de testes (?painel)
scripts/project.ts           gera public/project.json
```

## Falta testar no Wallpaper Engine

- [ ] o desempenho com placa de vídeo de verdade (o teste foi num navegador
      sem GPU); se pesar, baixar **Qualidade** ou **Resolução**
- [ ] o nome da música e as cores da capa chegam do Spotify/navegador
- [ ] as condições do painel (`mouse.value == true`) e os títulos de seção
      (`type: text`) aparecem certo
- [ ] a figura troca rápido demais com música de verdade? (`HOLD` e `RELEASE`
      em `patterns.ts`)
