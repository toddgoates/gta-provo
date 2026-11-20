import type { EventBus } from "../core/EventBus";
import type { Point } from "../entities/EntityManager";

export interface LocationTrigger { id: string; position: Point; radius: number }

export class TriggerSystem {
  private inside = new Set<string>();

  constructor(private readonly events: EventBus, private readonly locations: readonly LocationTrigger[]) {}

  update(point: Point): void {
    for (const { id, position, radius } of this.locations) {
      const near = Math.hypot(point.x - position.x, point.z - position.z) <= radius
        && Math.abs(point.y - position.y) < 2;
      if (near && !this.inside.has(id)) {
        this.inside.add(id);
        this.events.emit("location:entered", { locationId: id });
      } else if (!near) this.inside.delete(id);
    }
  }
}
