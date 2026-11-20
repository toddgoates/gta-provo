import type { EventBus } from "../core/EventBus";
import type { Entity, Point } from "../entities/EntityManager";

export class InteractionSystem {
  constructor(private readonly events: EventBus) {}

  nearest(origin: Point, candidates: Iterable<Entity>): Entity | null {
    let best: Entity | null = null;
    let distance = Infinity;
    for (const entity of candidates) {
      const interaction = entity.definition.interaction;
      if (!entity.enabled || !interaction) continue;
      const { x, y, z } = entity.position;
      const squared = (x - origin.x) ** 2 + (y - origin.y) ** 2 + (z - origin.z) ** 2;
      if (squared <= interaction.range ** 2 && squared < distance) {
        best = entity;
        distance = squared;
      }
    }
    return best;
  }

  use(entity: Entity): void { this.events.emit("interaction:used", { entityId: entity.id }); }
}
