import type { EventBus } from "../core/EventBus";
import type { Point } from "../entities/EntityManager";

const PICKUP_RANGE = .7;
const LANDING_TIME = .35;

export interface CashDrop { id: string; position: Point; amount: number }

export class CashSystem {
  private balance = 0;
  private drops = new Map<string, CashDrop & { age: number }>();
  private droppedBy = new Set<string>();
  private unsubscribe: (() => void)[];

  constructor(events: EventBus, playerId: string, random = Math.random) {
    this.unsubscribe = [
      events.on("combat:hit", ({ offenderId, victimId, position, knockedOut }) => {
        if (!knockedOut || offenderId !== playerId || this.droppedBy.has(victimId)) return;
        this.droppedBy.add(victimId);
        // Most NPCs carry pocket cash; a larger payout is uncommon.
        const amount = random() < .9 ? 1 + Math.floor(random() * 99) : 100 + Math.floor(random() * 201);
        this.drops.set(victimId, { id: victimId, position: { ...position }, amount, age: 0 });
      }),
      events.on("mission:completed", ({ money }) => { this.balance += money; }),
    ];
  }

  get money(): number { return this.balance; }
  get pickups(): Iterable<CashDrop> { return this.drops.values(); }

  step(dt: number, player?: Point): boolean {
    let collected = false;
    for (const drop of this.drops.values()) {
      drop.age += dt;
      if (!player || drop.age < LANDING_TIME || Math.abs(player.y - drop.position.y) > 1 ||
          Math.hypot(player.x - drop.position.x, player.z - drop.position.z) > PICKUP_RANGE) continue;
      this.balance += drop.amount;
      this.drops.delete(drop.id);
      collected = true;
    }
    return collected;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.drops.clear();
    this.droppedBy.clear();
  }
}
