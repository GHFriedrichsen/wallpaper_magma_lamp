# Lâmpada de Magma

Wallpaper web para o Wallpaper Engine: uma lâmpada de lava em que o som vira
**cimática em fluidos**. A cera sobe e desce com o calor, as bolhas se fundem e
se separam, e cada nota da música faz o fluido vibrar num modo próprio:

| Fenômeno | Onde aparece | O que o som faz |
|---|---|---|
| **Gota estrela** | bolhas de cera e superfície da poça | a borda ondula em m pontas, `r(θ) = R·(1 + A·cos(mθ)·cos(ωt))`; nota mais aguda, mais pontas (2 a 12) |
| **Ondas de Faraday** | o líquido em volta | ondas estacionárias somando n ondas planas: n = 2 quadrados, 3 hexágonos, 4 e 5 quase-cristais; nota mais aguda, onda mais curta. Elas entortam a imagem da cera (refração) |
| **Calor** | lâmpada embaixo | graves aquecem a cera, que se solta do fundo mais cedo |
| **Gelatina** | cada bolha | batidas e pancadas no fundo/topo fazem a bolha achatar e esticar |

Sem som, é uma lâmpada de lava clássica: bolhas lisas, nada vibra.

## Instalar no Wallpaper Engine

```bash
npm install
npm run build
```

A pasta `dist/` é o wallpaper (`index.html`, `project.json`, `preview.jpg` e
`assets/`). No Wallpaper Engine: **Criar wallpaper → Abrir wallpaper** e
escolha `dist/index.html`, ou copie a pasta para
`steamapps/common/wallpaper_engine/projects/myprojects/magma-lamp`.

Para reagir ao som, a gravação de áudio precisa estar ligada nas configurações
do Wallpaper Engine (o `project.json` já declara `supportsaudioprocessing`).

## Testar no navegador

```bash
npm run dev
```

Abra `http://localhost:5173/?demo&painel`:

- `?demo` toca áudio simulado: melodia de notas de 2 s (às vezes com uma
  segunda nota junto), bumbo, chimbal e um trecho mais alto a cada 8 s. Também
  troca as "cores da capa" a cada 12 s, para testar **Cores da música**.
- `?painel` mostra os mesmos controles do painel do Wallpaper Engine e o fps.
- Qualquer opção também vai pela URL, com a chave do `project.json`:
  `?demo&shape=lamp&colorscheme=neon&blobcount=14`. Cores com vírgula:
  `waxcolor=1,0.2,0`.

## Opções

Todas as opções ficam em `src/wallpaper/schema.ts`. O `npm run build` gera o
`public/project.json` a partir dele (`npm run project` gera só o manifesto).

| Grupo | Opção | Faixa | O que faz |
|---|---|---|---|
| Cores | Esquema de cores | 8 prontos, Cores da música, Personalizado | Clássica, Magma, Oceano, Neon, Pôr do sol, Ácido, Lavanda, Mercúrio. Cores da música usa a cor principal da capa na cera e a secundária no líquido |
| | Cera, Cera quente, Líquido em cima/embaixo, Brilho | cor | só no Personalizado |
| | Arco-íris | 0 a 100 | gira o matiz de todas as cores; 0 desliga |
| Lâmpada | Formato | Tela cheia, Lâmpada de vidro | a lâmpada tem vidro, base e tampa de metal |
| | Metal, Fundo atrás | cor | só na lâmpada de vidro |
| | Quantidade de bolhas | 3 a 20 | |
| | Tamanho das bolhas | 50 a 200% | |
| | Velocidade | 0 a 300% | 0 congela o fluxo (a vibração continua) |
| | Fusão entre bolhas | 0 a 100% | 0 = bolhas quase não se juntam; 100 = grudam de longe |
| | Poça de cera no fundo | sim/não | |
| Cimática | Cimática | Ambas, Gotas estrela, Faraday, Desligada | |
| | Força da cimática | 0 a 300% | |
| | Tamanho das ondas | 25 a 300% | comprimento das ondas de Faraday |
| | Velocidade da vibração | 0 a 300% | frequência visual das ondas estacionárias |
| Áudio | Reação ao áudio | 0 a 300% | multiplica todos os níveis; 0 desliga |
| | Graves aquecem a cera | 0 a 300% | |
| | Batidas sacodem a cera | 0 a 300% | |
| Aparência | Brilho, Reflexo, Refração, Luminosidade, Vinheta, Granulado | | |
| | Resolução | 40 a 100% | desenha em resolução menor; use em PCs mais fracos ou 4K |
| Mouse | Mouse | Empurra, Aquece, Ondas, Desligado | Aquece faz a bolha sob o mouse subir |
| | Força, Alcance | 0 a 300%, 5 a 40 | |
| | Clique faz onda | sim/não | anel que se espalha no líquido |

O limite de fps do Wallpaper Engine também é respeitado.

## Como funciona

### Áudio (`src/wallpaper/audio.ts`)

Mesmo modelo do wallpaper Grãos: o espectro de 128 valores (64 faixas por
canal) vira graves (faixas 0–5), médios (6–23), agudos (24–63) e energia, com
ganho automático (pico que cai pela metade em ~4 s), raiz quadrada e mínimo
antes de reagir. Batida: grave acima de 0,55 e 18% acima da média, no máximo
uma a cada 150 ms. Notas são picos do espectro com destaque mínimo, posição
interpolada por parábola, até 3 por leitura.

### Cimática (`src/lava/cymatics.ts`)

As 64 faixas se dividem em 24 modos; a mesma nota cai sempre no mesmo modo e
desenha sempre a mesma figura. Cada modo tem pontas da gota estrela (2 a 12),
direções e comprimento das ondas de Faraday, um ângulo fixo e uma frequência.

- A força de cada modo sobe 35% do caminho por leitura quando a nota soa e
  cai 6% quando para. Os 3 modos mais fortes se somam com pesos que somam 1:
  acordes misturam figuras.
- A amplitude geral passa pela curva do material `(a + a³)/2`: volume baixo
  quase não mexe, perto do máximo a resposta cresce mais.
- Na gota estrela, a ondulação cresce do centro (zero) até a borda,
  `s = (1 − q)·(1 + c·A(θ)·q)` com `q = d²/R²`, para a bolha não ficar vincada
  como forminha.
- As ondas de Faraday aparecem em manchas que derivam devagar, não numa grade
  igual na tela inteira.

### Cera (`src/lava/blobs.ts` e `src/render/shader.ts`)

- **Metaballs**: cada bolha soma `(1 − d²/R²)³` num campo; a cera é onde o
  campo passa do limiar. Bolhas próximas se fundem sozinhas. A normal vem do
  gradiente analítico do campo, para luz difusa, brilho por baixo, borda e
  reflexo.
- **Ciclo da lava**: embaixo a cera aquece, em cima esfria. Com histerese — só
  sobe acima de 0,85 de temperatura e só afunda abaixo de 0,3 — cada bolha faz
  a viagem inteira (~16 a 20 s) em vez de parar na borda da zona quente.
- **Gelatina**: oscilador de Duffing (a mola endurece com a amplitude, então
  pancada forte vibra mais rápido) achata e estica cada bolha.
- Bolhas que se encostam trocam um pouco de velocidade e calor, viajam juntas
  um tempo e se separam.

## Constantes para ajustar

| Constante | Arquivo | Valor | Efeito |
|---|---|---|---|
| `STAR` | main.ts | 0,22 | ondulação máxima da gota estrela, em fração do raio |
| `FARADAY` | main.ts | 0,0012 | altura máxima das ondas de Faraday |
| `ATTACK` | cymatics.ts | 0,35 | quão rápido uma nota nova assume a figura |
| `RELEASE` | cymatics.ts | 0,06 | quanto a nota anterior continua valendo |
| `BUOYANCY` | blobs.ts | 0,3 | empuxo; maior = a cera anda mais rápido |
| `MELT` / `SET` | blobs.ts | 0,85 / 0,3 | temperaturas em que a cera sobe e afunda |
| `HEAT` / `COOL` | blobs.ts | 0,28 / 0,24 | quão rápido aquece embaixo e esfria em cima |
| `JELLY_W` | blobs.ts | 9 rad/s | frequência do balanço de gelatina |

## Estrutura

```
src/main.ts               liga tudo e roda os quadros
src/wallpaper/schema.ts   opções do painel (fonte do project.json)
src/wallpaper/properties.ts  aplica as opções do Wallpaper Engine
src/wallpaper/audio.ts    espectro → níveis, batidas e notas
src/wallpaper/media.ts    cores da capa da música
src/wallpaper/demo.ts     áudio simulado (?demo)
src/lava/blobs.ts         física da cera
src/lava/cymatics.ts      notas → modos de vibração
src/lava/palette.ts       esquemas de cores
src/render/shader.ts      shader da lâmpada (GLSL)
src/render/renderer.ts    WebGL2
src/dev/panel.ts          painel de testes (?painel)
scripts/project.ts        gera public/project.json
```

## Falta testar no Wallpaper Engine

- [ ] o desempenho em 1080p/4K com 20 bolhas (o teste foi num navegador sem GPU)
- [ ] a figura troca rápido demais com música de verdade? (ajustar `RELEASE`)
- [ ] as cores da capa chegam no formato esperado em **Cores da música**
- [ ] os títulos de seção (`type: text`) aparecem no painel
