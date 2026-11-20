export const MAX_HEALTH = 100;
export const MIN_TRAFFIC_IMPACT_SPEED = 4.5;
const HIT_COOLDOWN = .9;

export class HealthSystem {
  private remaining = MAX_HEALTH;
  private cooldown = 0;

  get value(): number { return this.remaining; }
  get depleted(): boolean { return this.remaining === 0; }
  get canTakeDamage(): boolean { return !this.depleted && this.cooldown === 0; }

  step(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  applyTrafficImpact(speed: number): boolean {
    if (!this.canTakeDamage || !(speed >= MIN_TRAFFIC_IMPACT_SPEED)) return false;
    const damage = Math.min(28, Math.round(10 + speed * 1.2));
    this.remaining = Math.max(0, this.remaining - damage);
    this.cooldown = HIT_COOLDOWN;
    return true;
  }
}
