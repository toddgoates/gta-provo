export type Point = { x: number; y: number; z: number };
export type EntityKind = "player" | "npc" | "vehicle" | "interactable" | "environment";
export type Interaction = { range: number; prompt: string }
  & ({ kind: "dialogue"; dialogueId: string } | { kind: "use" });

export interface EntityDefinition {
  id: string;
  name: string;
  kind: EntityKind;
  modelId: string;
  appearance?: CharacterAppearance;
  interaction?: Interaction;
}

export interface Entity {
  id: string;
  definition: EntityDefinition;
  position: Point; // Feet / placement origin, not collider center.
  yaw: number;
  enabled: boolean;
  wardrobe?: Wardrobe;
}

export class EntityManager {
  private entities = new Map<string, Entity>();

  spawn(id: string, definition: EntityDefinition, position: Point, yaw = 0): Entity {
    if (this.entities.has(id)) throw new Error(`Duplicate entity ID: ${id}`);
    const defaults = definition.appearance?.defaultWardrobe;
    const entity: Entity = {
      id, definition, position: { ...position }, yaw, enabled: true,
      wardrobe: defaults && { ...defaults },
    };
    this.entities.set(id, entity);
    return entity;
  }

  get(id: string): Entity | undefined { return this.entities.get(id); }
  all(): Iterable<Entity> { return this.entities.values(); }
  clear(): void { this.entities.clear(); }
}
import type { CharacterAppearance, Wardrobe } from "./Appearance";
