import { downtown } from "./downtown";
import type { Point } from "../entities/EntityManager";

const lot = downtown.buildings.find(({ id }) => id === "soda")!;
const stairs = lot.roofStairs!;
const ground = .15;
const roof = lot.height + .30;
const wall = lot.x + lot.width / 2;
const centerX = wall + stairs.width / 2;
const endZ = stairs.baseZ + stairs.run;
export const stairTreadDepth = stairs.run / Math.ceil((roof - ground) / .21);

export const roofWaypoints: readonly Point[] = [
  { x: centerX, y: ground, z: stairs.baseZ - 1.5 },
  { x: centerX, y: ground, z: stairs.baseZ },
  { x: centerX, y: roof, z: endZ },
  { x: centerX, y: roof, z: endZ + .88 },
  { x: wall - 1.4, y: roof, z: endZ + .88 },
  { x: lot.x, y: roof, z: lot.z },
];

export function stairHeight({ x, z }: Point): number | undefined {
  if (x < wall || x > wall + stairs.width || z < stairs.baseZ || z > endZ) return;
  return ground + (roof - ground) * (z - stairs.baseZ) / stairs.run;
}

export function isOnRoofStairs(point: Point): boolean {
  const y = stairHeight(point);
  return y !== undefined && Math.abs(y - point.y) < .30;
}

export function roofSearchTarget(lastSeen: Point): Point | undefined {
  const { x, z, y } = lastSeen;
  const atEntrance = x > wall - .35 && x < wall + stairs.width + .35 &&
    z > stairs.baseZ - 1.6 && z <= endZ + 1 && y < roof - .25;
  return atEntrance ? roofWaypoints[4] : undefined;
}

export function roofStepHeight(from: Point, to: Point): number | undefined {
  const onRamp = stairHeight(to);
  if (onRamp !== undefined && Math.abs(onRamp - from.y) < .4) return onRamp;
  if (from.y > roof - .4 && surface({ ...to, y: roof })) return roof;
  if (from.y > ground + .4) return; // Do not step off the roof or make a vertical shortcut.
  return Math.abs(to.x) > 9.2 && Math.abs(to.z) > 9.2 ? ground : -.01;
}

function surface({ x, y, z }: Point): boolean {
  if (Math.abs(y - roof) < .45) {
    if (Math.abs(x - lot.x) <= lot.width / 2 + .16 && Math.abs(z - lot.z) <= lot.depth / 2 + .16) return true;
    if (x >= wall - .6 && x <= wall + stairs.width - .05 && z >= endZ - .04 && z <= endZ + 1.92) return true;
  }
  if (isOnRoofStairs({ x, z, y })) return true;
  return y >= -.1 && y <= ground + .3;
}

/** No direct route can cross open air between ground and roof, even if the sightline is clear. */
export function hasRoofRouteSupport(from: Point, to: Point): boolean {
  if (from.y < .5 && to.y < .5) return true;
  const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .4));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    if (!surface({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t })) return false;
  }
  return true;
}
