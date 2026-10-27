// Shaders da lâmpada. A cera é um campo implícito (metaballs): cada bolha soma
// um núcleo compacto (1 - d²/R²)³, e a superfície é onde o campo passa do
// limiar. O raio R de cada bolha muda com o ângulo (gota estrela) e o líquido
// tem ondas estacionárias (Faraday) que entortam a imagem da cera.

export const MAX_BLOBS = 20;
export const MAX_RIPPLES = 8;

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

#define MAX_BLOBS ${MAX_BLOBS}
#define MAX_RIPPLES ${MAX_RIPPLES}
#define PI 3.14159265

uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;

uniform vec4 uBlob[MAX_BLOBS];   // x, y, raio, temperatura
uniform vec4 uBlobB[MAX_BLOBS];  // achatamento, giro da estrela, vibração, -
uniform int uCount;
uniform float uRadius;           // raio típico, para a escala da normal

uniform vec4 uStar[3];           // pontas, amplitude (com a fase), -, -
uniform float uStarGain;         // c: faz a amplitude A valer na borda visível
uniform vec4 uWave[3];           // direções, número de onda, ângulo, amplitude (com a fase)
uniform vec4 uRipple[MAX_RIPPLES]; // x, y, idade (s), força

uniform float uKernel;           // R/r: alcance do núcleo em relação ao raio visível
uniform float uThreshold;
uniform float uPool;             // espessura da poça (0 = sem poça)
uniform float uLamp;             // 1 = lâmpada de vidro, 0 = tela cheia

uniform vec3 uWax;
uniform vec3 uHot;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uGlowCol;
uniform vec3 uMetal;
uniform vec3 uBackdrop;

uniform float uGlow;
uniform float uShine;
uniform float uRefract;
uniform float uBright;
uniform float uVignette;
uniform float uGrain;
uniform float uBass;
uniform float uEnergy;

out vec4 outColor;

// Vidro da lâmpada; o mesmo contorno de lampHalfWidth em blobs.ts.
const float GB = 0.2;
const float GT = 0.86;
const float W_BASE = 0.125;
const float W_BELLY = 0.16;
const float BELLY = 0.22;
const float W_TOP = 0.07;

float lampHalfWidth(float y) {
  float v = (y - GB) / (GT - GB);
  if (v < BELLY) return W_BASE + (W_BELLY - W_BASE) * smoothstep(0.0, 1.0, v / BELLY);
  return W_BELLY + (W_TOP - W_BELLY) * ((v - BELLY) / (1.0 - BELLY));
}

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Superfície do líquido: altura em .x e gradiente em .yz.
vec3 waves(vec2 p) {
  vec3 h = vec3(0.0);
  // As ondas de Faraday aparecem em manchas que derivam devagar, como num
  // líquido de verdade, em vez de uma grade igual na tela toda.
  float spots = smoothstep(0.2, 0.8, noise(p * 2.2 + vec2(uTime * 0.04, -uTime * 0.03)));
  spots = 0.25 + 0.75 * spots;
  for (int j = 0; j < 3; j++) {
    vec4 w = uWave[j];
    if (w.w == 0.0) continue;
    int n = int(w.x);
    float amp = w.w * spots / float(n);
    for (int i = 0; i < 6; i++) {
      if (i >= n) break;
      float a = w.z + float(i) * PI / float(n);
      vec2 dir = vec2(cos(a), sin(a));
      float ph = w.y * dot(p, dir);
      h.x += amp * cos(ph);
      h.yz -= amp * w.y * sin(ph) * dir;
    }
  }
  // Ondas de clique e de mouse: anéis que se espalham e somem.
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 r = uRipple[i];
    if (r.w <= 0.0) continue;
    vec2 d = p - r.xy;
    float dist = length(d) + 1e-4;
    float x = dist - r.z * 0.32;
    float width = 0.004 + r.z * 0.01;
    float env = r.w * 0.0025 * exp(-r.z * 1.4) * exp(-x * x / width);
    float k = 110.0;
    h.x += env * sin(x * k);
    h.yz += env * (k * cos(x * k) - 2.0 * x / width * sin(x * k)) * d / dist;
  }
  return h;
}

// Campo da cera em p: valor, gradiente, temperatura acumulada e halo.
void lava(vec2 p, out float f, out vec2 grad, out float heat, out float halo) {
  f = 0.0;
  grad = vec2(0.0);
  heat = 0.0;
  halo = 0.0;
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= uCount) break;
    vec4 b = uBlob[i];
    vec4 c = uBlobB[i];
    vec2 d = p - b.xy;
    float sx = 1.0 + c.x;
    vec2 ds = vec2(d.x / sx, d.y * sx);
    float d2 = dot(ds, ds) + 1e-7;
    halo += b.z * b.z / (d2 + b.z * b.z * 0.5);

    float R0 = b.z * uKernel;
    float q = d2 / (R0 * R0);
    if (q >= 1.0) continue;

    // Gota estrela: a borda ondula com cos(m·θ). A ondulação cresce do
    // centro (zero) para a borda, como numa gota de verdade, em vez de vincar
    // a bolha inteira: s = (1 - q)·(1 + c·A(θ)·q).
    float th = atan(ds.y, ds.x) + c.y;
    float A = 0.0;
    float Ap = 0.0;
    for (int j = 0; j < 3; j++) {
      float m = uStar[j].x;
      float a = uStar[j].y * c.z;
      A += a * cos(m * th);
      Ap -= a * m * sin(m * th);
    }
    float P = max(1.0 + uStarGain * A * q, 0.0);
    float s = (1.0 - q) * P;
    if (s <= 0.0) continue;
    float s2 = s * s;
    f += s2 * s;
    heat += s2 * s * b.w;
    vec2 gq = 2.0 * ds / (R0 * R0);
    vec2 qgA = Ap * vec2(-ds.y, ds.x) / (R0 * R0);
    vec2 gs = -P * gq + (1.0 - q) * uStarGain * (qgA + A * gq);
    grad += 3.0 * s2 * vec2(gs.x / sx, gs.y * sx);
  }

  // Poça de cera no fundo, com a superfície vibrando nas mesmas pontas.
  if (uPool > 0.0) {
    float yb = uLamp > 0.5 ? GB : 0.0;
    float g = 1.0;
    float gp = 0.0;
    for (int j = 0; j < 3; j++) {
      float m = uStar[j].x * 9.0;
      float a = uStar[j].y * 0.6;
      g += a * cos(m * p.x + float(j) * 1.7);
      gp -= a * m * sin(m * p.x + float(j) * 1.7);
    }
    float H = uPool * uKernel * max(g, 0.3);
    float dy = max(p.y - yb, 0.0);
    float s = 1.0 - dy * dy / (H * H);
    if (s > 0.0) {
      f += s * s * s;
      heat += s * s * s * 0.7;
      grad += 3.0 * s * s * vec2(2.0 * dy * dy / (H * H * H) * uPool * uKernel * gp, -2.0 * dy / (H * H));
    }
    halo += 0.6 * uPool * uPool / (dy * dy + uPool * uPool);
  }
}

// Comprime os brilhos pela luminância, sem puxar o laranja para o amarelo.
vec3 tonemap(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float m = max(max(c.r, c.g), c.b);
  float k = max(l, m * 0.6);
  float mapped = k / (1.0 + k * 0.45) * 1.2;
  vec3 col = c * (mapped / max(k, 1e-4));
  return clamp(col, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y);
  float px = 1.0 / uRes.y;

  // Altura dentro do líquido, de 0 (fundo) a 1 (topo).
  float yN = uLamp > 0.5 ? (p.y - GB) / (GT - GB) : p.y;
  float hw = lampHalfWidth(p.y);
  float glass = 1.0;
  if (uLamp > 0.5) {
    float edge = min(hw - abs(p.x), min(p.y - GB, GT - p.y));
    glass = smoothstep(-px, px, edge);
  }

  vec3 w = waves(p);
  vec2 q = p + w.yz * uRefract * 0.06;

  float f;
  vec2 grad;
  float heat;
  float halo;
  lava(q, f, grad, heat, halo);

  vec3 L = normalize(vec3(-0.45, 0.65, 0.75));

  // Líquido: degradê, brilho da lâmpada lá embaixo e ondas na superfície.
  vec3 liquid = mix(uBottom, uTop, smoothstep(0.0, 1.0, yN));
  liquid += uBottom * exp(-max(yN, 0.0) * 6.0) * (0.35 + 0.4 * uBass);
  vec3 nW = normalize(vec3(-w.yz * 2.5, 1.0));
  float tilt = dot(nW, L) - L.z;
  liquid *= 1.0 + tilt * 1.4;
  float crest = pow(max(dot(reflect(-L, nW), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  liquid += (uGlowCol * 0.5 + 0.25) * crest * uRefract * 0.35;
  liquid += uGlowCol * uGlow * 0.08 * halo * (0.7 + 0.5 * uBass);

  // Cera.
  float T = uThreshold;
  float aa = max(length(grad) * px * 1.2, 1e-4);
  float cover = smoothstep(T - aa, T + aa, f);
  float temp = f > 1e-5 ? heat / f : 0.0;
  float depth = clamp((f - T) / (1.0 - T), 0.0, 1.0);
  float h = sqrt(depth);
  vec2 gh = grad / ((1.0 - T) * 2.0 * max(h, 0.12));
  vec3 n = normalize(vec3(-gh * uRadius * 0.55, 1.0));

  vec3 wax = mix(uWax, uHot, clamp(pow(depth, 1.2) * (0.3 + 0.6 * temp), 0.0, 1.0));
  float diffuse = max(dot(n, L), 0.0);
  float below = max(-n.y, 0.0) * exp(-max(yN, 0.0) * 1.5);
  // Cera translúcida: além da luz de fora, brilha por dentro onde é mais grossa.
  vec3 shaded = wax * (0.5 + 0.5 * diffuse + 0.6 * below) + uHot * depth * temp * 0.25;
  shaded *= 1.0 + 0.3 * uBass + 0.15 * uEnergy;
  float rim = pow(1.0 - n.z, 2.5);
  shaded += uGlowCol * rim * 0.35 * uGlow;
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
  shaded += mix(vec3(1.0, 0.97, 0.92), uHot, 0.4) * spec * uShine * 0.3;

  vec3 col = mix(liquid, shaded, cover);

  if (uLamp > 0.5) {
    // Reflexos do vidro: borda clara e uma faixa vertical.
    float xn = p.x / hw;
    col += vec3(0.9) * smoothstep(0.8, 1.0, abs(xn)) * 0.12 * uShine;
    col += vec3(1.0) * exp(-pow((xn + 0.55) * 7.0, 2.0)) * 0.07 * uShine;

    // Fundo, com a luz da lâmpada vazando em volta.
    float glassDist = max(abs(p.x) - hw, 0.0) + max(GB - p.y, 0.0) * 0.3 + max(p.y - GT, 0.0);
    vec3 room = uBackdrop + (uGlowCol * 0.5 + uBottom * 0.5) * 0.18 * uGlow * exp(-glassDist * 5.0);

    // Base e tampa de metal, como cilindros.
    float baseW = mix(0.2, W_BASE, smoothstep(0.02, GB, p.y));
    float capW = mix(W_TOP, 0.045, (p.y - GT) / 0.11);
    float inBase = step(0.02, p.y) * step(p.y, GB) * smoothstep(px, -px, abs(p.x) - baseW);
    float inCap = step(GT, p.y) * step(p.y, 0.97) * smoothstep(px, -px, abs(p.x) - capW);
    float metalW = inBase > 0.0 ? baseW : capW;
    float mx = clamp(p.x / metalW, -1.0, 1.0);
    float cyl = sqrt(1.0 - mx * mx);
    vec3 metal = uMetal * (0.25 + 0.75 * cyl * (0.6 + 0.4 * (-mx * 0.6 + 0.4)));
    metal += vec3(1.0) * exp(-pow((mx + 0.45) * 6.0, 2.0)) * 0.25 * uShine;
    metal += uGlowCol * 0.25 * smoothstep(GB - 0.03, GB, p.y) * inBase;
    room = mix(room, metal, max(inBase, inCap));
    col = mix(room, col, glass);
  }

  col *= uBright;
  col = tonemap(col);

  vec2 vc = uv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.25, 0.95, dot(vc, vc) * 2.2);
  float noise = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5;
  col += noise * (uGrain * 0.09 + 1.0 / 255.0);

  outColor = vec4(col, 1.0);
}
`;
