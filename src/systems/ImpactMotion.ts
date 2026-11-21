import type { Point } from "../entities/EntityManager";

export interface ImpactMotion { velocity: Point; pitch: number; roll: number; bounced: boolean }

export function launchImpact(speed: number, travel: Point, outward?: Point): ImpactMotion {
  const direction = { x: travel.x / speed, z: travel.z / speed };
  const normal = outward ?? direction;
  const x = .72 * direction.x + .48 * normal.x;
  const z = .72 * direction.z + .48 * normal.z;
  const length = Math.hypot(x, z) || 1;
  const push = Math.min(9.4, 1.05 + speed * .47);
  return { velocity: { x: x / length * push, y: Math.min(5.6, 1.4 + speed * .26), z: z / length * push },
    pitch: .10, roll: .07, bounced: false };
}

export function stepImpact(motion: ImpactMotion, from: Point, dt: number, clear: (a: Point, b: Point) => boolean,
  floorAt: (point: Point) => number): { position: Point; settled: boolean } {
  const { velocity } = motion;
  velocity.y -= 17 * dt;
  const position = { x: from.x + velocity.x * dt, y: from.y + velocity.y * dt, z: from.z + velocity.z * dt };
  if (!clear(from, { ...position, y: from.y })) {
    position.x = from.x;
    position.z = from.z;
    velocity.x *= -.24;
    velocity.z *= -.24;
  }
  motion.pitch = Math.min(Math.PI / 2, motion.pitch + (motion.bounced ? 2.2 : 5.5) * dt);
  motion.roll *= Math.exp(-4 * dt);
  const floor = floorAt(position);
  if (position.y > floor || velocity.y > 0) return { position, settled: false };
  position.y = floor;
  if (!motion.bounced && velocity.y < -1.4) {
    motion.bounced = true;
    velocity.y *= -.25;
    velocity.x *= .43;
    velocity.z *= .43;
    return { position, settled: false };
  }
  return { position, settled: true };
}
