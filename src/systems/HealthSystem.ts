export const MAX_HEALTH = 100;
export const MIN_TRAFFIC_IMPACT_SPEED = 4.5;
const HIT_COOLDOWN = .9;
const SAFE_FALL = 2.5;
const FALL_DAMAGE_PER_METER = 10;

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
    if (!(speed >= MIN_TRAFFIC_IMPACT_SPEED)) return false;
    return this.applyDamage(Math.min(28, Math.round(10 + speed * 1.2)), HIT_COOLDOWN);
  }

  applyMeleeHit(damage: number): boolean {
    return this.applyDamage(damage, .46);
  }

  restore(amount: number): boolean {
    if (this.depleted || this.remaining === MAX_HEALTH || !(amount > 0)) return false;
    this.remaining = Math.min(MAX_HEALTH, this.remaining + amount);
    return true;
  }

  applyFall(drop: number): boolean {
    const damage = Math.round((drop - SAFE_FALL) * FALL_DAMAGE_PER_METER);
    // Contact invulnerability should not let the player survive an otherwise fatal fall.
    if (this.depleted || !(damage > 0)) return false;
    this.remaining = Math.max(0, this.remaining - damage);
    return true;
  }

  applyVehicleExplosion(damage: number): boolean {
    if (this.depleted || !(damage > 0)) return false;
    this.remaining = Math.max(0, this.remaining - damage);
    return true;
  }

  private applyDamage(damage: number, cooldown: number): boolean {
    if (!this.canTakeDamage || !(damage > 0)) return false;
    this.remaining = Math.max(0, this.remaining - damage);
    this.cooldown = cooldown;
    return true;
  }
}
