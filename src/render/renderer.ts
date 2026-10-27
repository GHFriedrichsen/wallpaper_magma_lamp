// Desenha a lâmpada num triângulo que cobre a tela, com o shader de shader.ts.

import { FRAGMENT, MAX_BLOBS, MAX_RIPPLES, VERTEX } from './shader';

export interface FrameUniforms {
  time: number;
  blobs: Float32Array; // MAX_BLOBS × vec4
  blobsB: Float32Array; // MAX_BLOBS × vec4
  count: number;
  radius: number;
  star: Float32Array; // 3 × vec4
  starGain: number;
  wave: Float32Array; // 3 × vec4
  ripples: Float32Array; // MAX_RIPPLES × vec4
  kernel: number;
  threshold: number;
  pool: number;
  lamp: boolean;
  colors: Record<'wax' | 'hot' | 'top' | 'bottom' | 'glow' | 'metal' | 'backdrop', number[]>;
  glow: number;
  shine: number;
  refract: number;
  bright: number;
  vignette: number;
  grain: number;
  bass: number;
  energy: number;
}

export function emptyFrame(): FrameUniforms {
  return {
    time: 0,
    blobs: new Float32Array(MAX_BLOBS * 4),
    blobsB: new Float32Array(MAX_BLOBS * 4),
    count: 0,
    radius: 0.07,
    star: new Float32Array(12),
    starGain: 3,
    wave: new Float32Array(12),
    ripples: new Float32Array(MAX_RIPPLES * 4),
    kernel: 1.8,
    threshold: 0.33,
    pool: 0,
    lamp: false,
    colors: { wax: [1, 0, 0], hot: [1, 1, 0], top: [0, 0, 0], bottom: [0, 0, 0], glow: [1, 0, 0], metal: [0.5, 0.5, 0.5], backdrop: [0, 0, 0] },
    glow: 1,
    shine: 1,
    refract: 1,
    bright: 1,
    vignette: 0.4,
    grain: 0.1,
    bass: 0,
    energy: 0,
  };
}

const UNIFORMS = [
  'uRes', 'uAspect', 'uTime', 'uBlob', 'uBlobB', 'uCount', 'uRadius', 'uStar', 'uStarGain', 'uWave',
  'uRipple', 'uKernel', 'uThreshold', 'uPool', 'uLamp', 'uWax', 'uHot', 'uTop', 'uBottom', 'uGlowCol',
  'uMetal', 'uBackdrop', 'uGlow', 'uShine', 'uRefract', 'uBright', 'uVignette', 'uGrain', 'uBass', 'uEnergy',
] as const;

type Uniform = (typeof UNIFORMS)[number];

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Erro no shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly loc = {} as Record<Uniform, WebGLUniformLocation | null>;
  /** Fração da resolução da tela usada no desenho (opção Resolução). */
  quality = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 indisponível');
    this.gl = gl;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Erro ao ligar o shader: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);
    for (const name of UNIFORMS) this.loc[name] = gl.getUniformLocation(program, name);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /** Ajusta o tamanho do canvas; devolve a proporção largura/altura. */
  resize(): number {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * this.quality));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * this.quality));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return w / h;
  }

  draw(u: FrameUniforms): void {
    const gl = this.gl;
    const l = this.loc;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(l.uRes, width, height);
    gl.uniform1f(l.uAspect, width / height);
    gl.uniform1f(l.uTime, u.time);
    gl.uniform4fv(l.uBlob, u.blobs);
    gl.uniform4fv(l.uBlobB, u.blobsB);
    gl.uniform1i(l.uCount, u.count);
    gl.uniform1f(l.uRadius, u.radius);
    gl.uniform4fv(l.uStar, u.star);
    gl.uniform1f(l.uStarGain, u.starGain);
    gl.uniform4fv(l.uWave, u.wave);
    gl.uniform4fv(l.uRipple, u.ripples);
    gl.uniform1f(l.uKernel, u.kernel);
    gl.uniform1f(l.uThreshold, u.threshold);
    gl.uniform1f(l.uPool, u.pool);
    gl.uniform1f(l.uLamp, u.lamp ? 1 : 0);
    gl.uniform3fv(l.uWax, u.colors.wax);
    gl.uniform3fv(l.uHot, u.colors.hot);
    gl.uniform3fv(l.uTop, u.colors.top);
    gl.uniform3fv(l.uBottom, u.colors.bottom);
    gl.uniform3fv(l.uGlowCol, u.colors.glow);
    gl.uniform3fv(l.uMetal, u.colors.metal);
    gl.uniform3fv(l.uBackdrop, u.colors.backdrop);
    gl.uniform1f(l.uGlow, u.glow);
    gl.uniform1f(l.uShine, u.shine);
    gl.uniform1f(l.uRefract, u.refract);
    gl.uniform1f(l.uBright, u.bright);
    gl.uniform1f(l.uVignette, u.vignette);
    gl.uniform1f(l.uGrain, u.grain);
    gl.uniform1f(l.uBass, u.bass);
    gl.uniform1f(l.uEnergy, u.energy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export { MAX_BLOBS, MAX_RIPPLES };
