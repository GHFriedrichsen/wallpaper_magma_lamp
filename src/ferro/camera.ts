// Câmera orbitando um alvo. O shader recebe posição e eixos prontos; a CPU
// usa a mesma câmera para saber onde o mouse aponta no mundo.

import { add, cross, dot, normalize, sub, type Vec3 } from './math3';

export interface Camera {
  pos: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  focal: number;
}

/** `elevation` em graus (90 = de cima), `azimuth` em radianos. */
export function orbitCamera(target: Vec3, elevation: number, azimuth: number, distance: number, focal = 1.7): Camera {
  const e = (Math.min(89.5, Math.max(5, elevation)) * Math.PI) / 180;
  const pos: Vec3 = [
    target[0] + distance * Math.cos(e) * Math.sin(azimuth),
    target[1] + distance * Math.sin(e),
    target[2] - distance * Math.cos(e) * Math.cos(azimuth),
  ];
  const forward = normalize(sub(target, pos));
  const right = normalize(cross([0, 1, 0], forward));
  const up = cross(forward, right);
  return { pos, forward, right, up, focal };
}

/** Raio que sai da câmera pelo ponto da tela (sx, sy de 0 a 1, y para baixo). */
export function screenRay(cam: Camera, aspect: number, sx: number, sy: number): Vec3 {
  const u = (sx - 0.5) * aspect;
  const v = 0.5 - sy;
  return normalize(add(add(cam.forward.map((c) => c * cam.focal) as Vec3, cam.right, u), cam.up, v));
}

/** Onde o raio fura o plano que passa por `point` com normal `normal`. */
export function hitPlane(origin: Vec3, dir: Vec3, point: Vec3, normal: Vec3): Vec3 | null {
  const denom = dot(dir, normal);
  if (Math.abs(denom) < 1e-5) return null;
  const t = dot(sub(point, origin), normal) / denom;
  if (t <= 0) return null;
  return add(origin, dir, t);
}
