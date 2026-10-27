// Shader do ferrofluido, em dois formatos:
//
// - Poça: um campo de alturas, uma poça baixa e arredondada mais os espinhos
//   que o ímã levanta. Cada pixel lança um raio da câmera e anda por ele até
//   furar a superfície (raymarching), refina o ponto e calcula a normal por
//   diferenças finitas.
// - Esfera: o ferrofluido envolve um ímã esférico e os espinhos saem para
//   todos os lados. A superfície é o raio da esfera mais os espinhos em cada
//   direção, percorrida por sphere tracing.
//
// O ferrofluido é quase preto e espelhado: a cor vem do reflexo de três luzes
// coloridas (softboxes) e do fundo.

export const MAX_RIPPLES = 8;

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

#define MAX_RIPPLES ${MAX_RIPPLES}
#define MAX_STEPS 160
#define TAU 6.2831853

uniform vec2 uRes;
uniform float uTime;

uniform vec3 uCamPos;
uniform vec3 uCamF;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform float uFocal;
uniform int uSteps;

uniform int uShape;       // 0 = poça, 1 = esfera
uniform vec4 uSphere;     // esfera: centro (x, y, z) e raio
uniform mat3 uSphereRot;  // giro da esfera
uniform float uPulse;     // esfera: inchaço das batidas e cliques

uniform vec2 uCenter;     // centro da poça (x, z)
uniform float uRadius;    // raio da poça
uniform float uMound;     // altura da poça sem campo
uniform vec2 uMagnet;     // ímã (x, z)
uniform float uFieldR;    // alcance do ímã
uniform float uSpike;     // altura dos espinhos agora
uniform float uSharp;     // expoente do perfil do espinho
uniform float uShimmer;   // tremor das pontas (agudos)

uniform vec4 uPatA;       // figura anterior: tipo, espaçamento, simetria, giro dos anéis
uniform vec4 uPatB;       // figura atual
uniform vec2 uPatAngle;   // ângulo de cada figura
uniform vec2 uPatBase;    // raio da base do espinho de cada figura (em espaçamentos)
uniform vec2 uPatHeight;  // altura relativa dos espinhos de cada figura
uniform float uBlend;     // 0 = só a anterior, 1 = só a atual

uniform vec4 uRipple[MAX_RIPPLES]; // x, z, idade (s), força

uniform vec3 uL1;
uniform vec3 uL2;
uniform vec3 uL3;
uniform vec3 uL1Dir;
uniform vec3 uL2Dir;
uniform vec3 uL3Dir;
uniform vec3 uBg;
uniform vec3 uFluid;
uniform float uLightPower;
uniform float uMirror;
uniform float uBgGlow;

uniform float uBright;
uniform float uVignette;
uniform float uGrain;

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 rot(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Perfil do espinho mais próximo: .x de 0 (base) a 1 (ponta), .y = id do espinho.
vec2 spikes(vec2 p, vec4 pat, float angle, float base) {
  vec2 q = rot(p, angle) / pat.y;
  float d;
  float id;
  if (pat.x < 0.5) {
    // Favo: grade hexagonal.
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(q, r) - h;
    vec2 b = mod(q - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    d = length(g);
    id = hash(floor((q - g) * 2.0 + 0.5));
  } else {
    // Mandala: espinho no centro e anéis com k·simetria espinhos.
    float rr = length(q);
    float th = atan(q.y, q.x);
    float k0 = floor(rr);
    d = 1e9;
    id = 0.0;
    for (int j = 0; j < 2; j++) {
      float k = k0 + float(j);
      float dk;
      float idk;
      if (k < 0.5) {
        dk = rr;
        idk = 0.5;
      } else {
        float sector = TAU / (pat.z * k);
        float off = pat.w * sector * k;
        float a = floor((th - off) / sector + 0.5) * sector + off;
        dk = length(q - k * vec2(cos(a), sin(a)));
        idk = hash(vec2(k, a));
      }
      if (dk < d) {
        d = dk;
        id = idk;
      }
    }
  }
  float s = max(0.0, 1.0 - d / base);
  return vec2(pow(s, uSharp), id);
}

// Altura da superfície em (x, z). field e spike saem para o sombreamento.
float surface(vec2 xz, out float field, out float spike) {
  field = 0.0;
  spike = 0.0;
  vec2 pc = xz - uCenter;
  float r = length(pc) / uRadius;
  if (r >= 1.0) return 0.0;

  // Borda arredondada como uma gota grande: sobe rápido e depois quase plana.
  float h = uMound * sqrt(max(0.0, 1.0 - pow(r, 6.0)));
  vec2 pm = xz - uMagnet;
  field = exp(-dot(pm, pm) / (uFieldR * uFieldR)) * smoothstep(1.0, 0.72, r);
  // O fluido se junta em cima do ímã.
  h += uSpike * 0.22 * field;

  if (field > 0.004 && uSpike > 0.0005) {
    float s = 0.0;
    if (uBlend < 0.999) {
      vec2 a = spikes(pm, uPatA, uPatAngle.x, uPatBase.x);
      s += (1.0 - uBlend) * uPatHeight.x * a.x * (1.0 + uShimmer * sin(uTime * 21.0 + a.y * 40.0));
    }
    if (uBlend > 0.001) {
      vec2 b = spikes(pm, uPatB, uPatAngle.y, uPatBase.y);
      s += uBlend * uPatHeight.y * b.x * (1.0 + uShimmer * sin(uTime * 21.0 + b.y * 40.0));
    }
    spike = s;
    h += uSpike * field * s;
  }

  // Ondas de batidas e cliques: anéis que se espalham pela poça.
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 rp = uRipple[i];
    if (rp.w <= 0.0) continue;
    float dist = length(xz - rp.xy);
    float x = dist - rp.z * 0.7 * uRadius;
    float w = 0.02 + rp.z * 0.03;
    h += rp.w * 0.012 * uRadius * exp(-rp.z * 1.5) * exp(-x * x / (w * uRadius)) * sin(x / uRadius * 45.0);
  }
  return h;
}

// Espinhos na esfera, em anéis de latitude a partir do polo (+y local). No
// favo cada anel tem quantos espinhos cabem (espalhamento quase uniforme); na
// mandala o anel k tem k·simetria espinhos, espelhado no hemisfério de baixo.
vec2 sphereSpikes(vec3 dir, vec4 pat, float base) {
  float K = max(2.0, floor(3.1415927 / pat.y + 0.5));
  float D = 3.1415927 / K;
  float th = acos(clamp(dir.y, -1.0, 1.0));
  float ph = atan(dir.z, dir.x);
  float k0 = floor(th / D);
  float d = 1e9;
  float id = 0.0;
  for (int j = 0; j < 2; j++) {
    float k = k0 + float(j);
    if (k > K) break;
    float thk = k * D;
    float sk = sin(thk);
    float n;
    if (k < 0.5 || k > K - 0.5) n = 1.0;
    else if (pat.x < 0.5) n = max(1.0, floor(TAU * sk / D + 0.5));
    else n = pat.z * min(k, K - k);
    float sector = TAU / n;
    float off = pat.w * sector * k;
    float a = floor((ph - off) / sector + 0.5) * sector + off;
    vec3 c = vec3(sk * cos(a), cos(thk), sk * sin(a));
    float dk = length(dir - c) / D;
    if (dk < d) {
      d = dk;
      id = hash(vec2(k, a));
    }
  }
  float s = max(0.0, 1.0 - d / base);
  return vec2(pow(s, uSharp), id);
}

// Distância (aproximada) até a esfera com espinhos.
float sphereSurface(vec3 p, out float spike) {
  vec3 rel = p - uSphere.xyz;
  float len = length(rel);
  vec3 dir = uSphereRot * (rel / max(len, 1e-5));
  float s = 0.0;
  if (uSpike > 0.0005) {
    if (uBlend < 0.999) {
      vec2 a = sphereSpikes(dir, uPatA, uPatBase.x);
      s += (1.0 - uBlend) * uPatHeight.x * a.x * (1.0 + uShimmer * sin(uTime * 21.0 + a.y * 40.0));
    }
    if (uBlend > 0.001) {
      vec2 b = sphereSpikes(dir, uPatB, uPatBase.y);
      s += uBlend * uPatHeight.y * b.x * (1.0 + uShimmer * sin(uTime * 21.0 + b.y * 40.0));
    }
  }
  spike = s;
  return len - uSphere.w * (1.0 + uPulse) - uSpike * s;
}

float sphereOnly(vec3 p) {
  float s;
  return sphereSurface(p, s);
}

float heightOnly(vec2 xz) {
  float f;
  float s;
  return surface(xz, f, s);
}

vec3 environment(vec3 d) {
  vec3 c = uBg * (1.0 + 3.0 * max(d.y, 0.0));
  float k1 = max(dot(d, uL1Dir), 0.0);
  float k2 = max(dot(d, uL2Dir), 0.0);
  float k3 = max(dot(d, uL3Dir), 0.0);
  c += uL1 * (pow(k1, 90.0) * 7.0 + pow(k1, 14.0) * 0.7 + pow(k1, 3.0) * 0.06);
  c += uL2 * (pow(k2, 90.0) * 7.0 + pow(k2, 14.0) * 0.7 + pow(k2, 3.0) * 0.06);
  c += uL3 * (pow(k3, 60.0) * 4.0 + pow(k3, 8.0) * 0.4 + pow(k3, 2.0) * 0.05);
  // Anel largo de luz em volta, perto do horizonte, misturando as luzes:
  // é o que as laterais dos espinhos refletem.
  float az = atan(d.z, d.x);
  vec3 ring = mix(mix(uL1, uL2, 0.5 + 0.5 * sin(az)), uL3, 0.5 + 0.5 * sin(az * 2.0 + 1.3) * 0.6);
  c += ring * exp(-abs(d.y - 0.12) * 5.0) * 0.16;
  return c * uLightPower;
}

// Fundo atrás do fluido: a cor de fundo e um brilho fraco das luzes.
vec3 backdrop(vec3 rd) {
  return uBg + environment(rd) * 0.12 * uBgGlow;
}

vec3 shadeFluid(vec3 rd, vec3 n, float spike, float field, float up) {
  vec3 refl = reflect(rd, n);
  float fres = 0.12 + 0.88 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  // Vales entre os espinhos ficam escuros; as pontas pegam toda a luz.
  float ao = 1.0 - 0.4 * field * pow(1.0 - clamp(spike, 0.0, 1.0), 2.0) * step(0.001, uSpike);
  return uFluid * (0.25 + 0.75 * up) + environment(refl) * mix(0.45, 1.0, fres) * ao * uMirror;
}

vec3 tonemap(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float m = max(max(c.r, c.g), c.b);
  float k = max(l, m * 0.6);
  float mapped = k / (1.0 + k * 0.45) * 1.2;
  return clamp(c * (mapped / max(k, 1e-4)), 0.0, 1.0);
}

vec3 renderPuddle(vec3 ro, vec3 rd) {
  float top = uMound + uSpike * 1.75 + 0.06 * uRadius;

  // Chão: plano y = 0. Sem chão à vista (raio para cima) é só fundo.
  float tFloor = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;

  // Faixa onde o raio pode tocar o fluido: entre o topo e o chão, dentro do
  // cilindro da poça.
  float tStart = rd.y < -1e-4 ? max(0.0, (ro.y - top) / -rd.y) : 1e9;
  float tEnd = tFloor;
  vec2 oc = ro.xz - uCenter;
  float qa = dot(rd.xz, rd.xz);
  float qb = dot(oc, rd.xz);
  float qc = dot(oc, oc) - uRadius * uRadius;
  float disc = qb * qb - qa * qc;
  if (disc > 0.0 && qa > 1e-6) {
    float sq = sqrt(disc);
    tStart = max(tStart, (-qb - sq) / qa);
    tEnd = min(tEnd, (-qb + sq) / qa);
  } else if (qc > 0.0) {
    tEnd = -1.0;
  }

  bool hit = false;
  float t = tStart;
  if (tStart < tEnd) {
    float minStep = (tEnd - tStart) / float(uSteps);
    float prev = t;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= uSteps || t > tEnd) break;
      vec3 p = ro + rd * t;
      float gap = p.y - heightOnly(p.xz);
      if (gap < 0.0) {
        // Refina entre o último ponto acima e este, abaixo da superfície.
        float lo = prev;
        float hi = t;
        for (int j = 0; j < 6; j++) {
          float mid = 0.5 * (lo + hi);
          vec3 pm = ro + rd * mid;
          if (pm.y - heightOnly(pm.xz) < 0.0) hi = mid; else lo = mid;
        }
        t = hi;
        hit = true;
        break;
      }
      prev = t;
      t += max(gap * 0.45, minStep);
    }
  }

  if (hit) {
    vec3 p = ro + rd * t;
    float field;
    float spike;
    float h = surface(p.xz, field, spike);
    float e = 0.0025 * uRadius;
    float hx = heightOnly(p.xz + vec2(e, 0.0));
    float hz = heightOnly(p.xz + vec2(0.0, e));
    vec3 n = normalize(vec3(h - hx, e, h - hz));

    return shadeFluid(rd, n, spike, field, max(n.y, 0.0));
  }
  if (tFloor < 1e8) {
    // Chão escuro e um pouco brilhante, com a luz das luzes em volta da poça.
    vec3 p = ro + rd * tFloor;
    float r = length(p.xz - uCenter) / uRadius;
    vec3 col = uBg * 0.8;
    col += environment(reflect(rd, vec3(0.0, 1.0, 0.0))) * 0.05 * uBgGlow;
    col += (uL1 + uL2 + uL3) * 0.012 * uLightPower * uBgGlow * exp(-max(r - 1.0, 0.0) * 1.5);
    // Sombra de contato na borda da poça.
    col *= mix(0.35, 1.0, smoothstep(1.0, 1.25, r));
    float fog = 1.0 - exp(-tFloor * 0.04);
    return mix(col, uBg, fog);
  }
  return backdrop(rd);
}

vec3 renderSphere(vec3 ro, vec3 rd) {
  float bound = uSphere.w * (1.0 + uPulse) + uSpike * 1.7 + 0.02;
  vec3 oc = ro - uSphere.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - bound * bound;
  float disc = b * b - c;
  if (disc < 0.0) return backdrop(rd);
  float sq = sqrt(disc);
  float t = max(0.0, -b - sq);
  float tEnd = -b + sq;
  float minStep = (tEnd - t) / float(uSteps) * 0.5;
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps || t > tEnd) break;
    float d = sphereOnly(ro + rd * t);
    if (d < 0.0005 * uSphere.w) {
      hit = true;
      break;
    }
    // Espinhos fazem a distância exagerar: anda só uma parte dela.
    t += max(d * 0.4, minStep);
  }
  if (!hit) return backdrop(rd);

  vec3 p = ro + rd * t;
  float spike;
  sphereSurface(p, spike);
  float e = 0.002 * uSphere.w;
  vec2 k = vec2(1.0, -1.0);
  vec3 n = normalize(
    k.xyy * sphereOnly(p + k.xyy * e) + k.yyx * sphereOnly(p + k.yyx * e) +
    k.yxy * sphereOnly(p + k.yxy * e) + k.xxx * sphereOnly(p + k.xxx * e));
  return shadeFluid(rd, n, spike, 1.0, 0.5 + 0.5 * n.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamF * uFocal + uCamR * uv.x + uCamU * uv.y);

  vec3 col;
  if (uShape == 1) {
    col = renderSphere(ro, rd);
  } else {
    col = renderPuddle(ro, rd);
  }

  col *= uBright;
  col = tonemap(col);

  vec2 vc = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.2, 0.95, dot(vc, vc) * 2.2);
  float noise = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5;
  col += noise * (uGrain * 0.09 + 1.0 / 255.0);

  outColor = vec4(col, 1.0);
}
`;
