// Desenha o ferrofluido num triângulo que cobre a tela, com o shader de
// shader.ts. Os valores de cada quadro chegam num objeto { nome: valor }.

import { FRAGMENT, MAX_RIPPLES, VERTEX } from './shader';

type Kind = '1f' | '1i' | '2f' | '3f' | '4f' | '4fv' | 'm3';

/** Uniforms do shader e o tipo de cada um. */
const UNIFORMS = {
  uRes: '2f',
  uTime: '1f',
  uCamPos: '3f',
  uCamF: '3f',
  uCamR: '3f',
  uCamU: '3f',
  uFocal: '1f',
  uSteps: '1i',
  uShape: '1i',
  uSphere: '4f',
  uSphereRot: 'm3',
  uPulse: '1f',
  uCenter: '2f',
  uRadius: '1f',
  uMound: '1f',
  uMagnet: '2f',
  uFieldR: '1f',
  uSpike: '1f',
  uSharp: '1f',
  uShimmer: '1f',
  uPatA: '4f',
  uPatB: '4f',
  uPatAngle: '2f',
  uPatBase: '2f',
  uPatHeight: '2f',
  uBlend: '1f',
  uRipple: '4fv',
  uL1: '3f',
  uL2: '3f',
  uL3: '3f',
  uL1Dir: '3f',
  uL2Dir: '3f',
  uL3Dir: '3f',
  uBg: '3f',
  uFluid: '3f',
  uLightPower: '1f',
  uMirror: '1f',
  uBgGlow: '1f',
  uBright: '1f',
  uVignette: '1f',
  uGrain: '1f',
} as const satisfies Record<string, Kind>;

export type UniformName = Exclude<keyof typeof UNIFORMS, 'uRes'>;
export type Frame = Record<UniformName, number | ArrayLike<number>>;

export { MAX_RIPPLES };

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
  private readonly loc = new Map<string, WebGLUniformLocation | null>();
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
    for (const name of Object.keys(UNIFORMS)) this.loc.set(name, gl.getUniformLocation(program, name));

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

  draw(frame: Frame): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(this.loc.get('uRes')!, width, height);
    for (const [name, kind] of Object.entries(UNIFORMS) as [string, Kind][]) {
      if (name === 'uRes') continue;
      const loc = this.loc.get(name);
      if (!loc) continue;
      const v = frame[name as UniformName];
      const a = v as ArrayLike<number>;
      switch (kind) {
        case '1f': gl.uniform1f(loc, v as number); break;
        case '1i': gl.uniform1i(loc, v as number); break;
        case '2f': gl.uniform2f(loc, a[0], a[1]); break;
        case '3f': gl.uniform3f(loc, a[0], a[1], a[2]); break;
        case '4f': gl.uniform4f(loc, a[0], a[1], a[2], a[3]); break;
        case '4fv': gl.uniform4fv(loc, a as Float32Array); break;
        case 'm3': gl.uniformMatrix3fv(loc, false, a as Float32Array); break;
      }
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
