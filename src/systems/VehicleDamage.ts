export const MAX_VEHICLE_DAMAGE = 100;
export const SMOKE_DAMAGE = 22;
export const FIRE_DAMAGE = 75;
export const EJECTION_DAMAGE = 35;

export function collisionDamage(speed: number, pedestrian = false): number {
  if (speed < (pedestrian ? 2.25 : 1.8)) return 0;
  return Math.max(1, Math.round((speed - (pedestrian ? 1 : 1.3)) * (pedestrian ? .80 : 2.10)));
}
