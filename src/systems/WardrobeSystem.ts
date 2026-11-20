import { garments } from "../content/characters/wardrobe";
import type { Wardrobe } from "../entities/Appearance";
import type { Entity } from "../entities/EntityManager";

export function equipGarment(entity: Entity, slot: keyof Wardrobe, garmentId: string): boolean {
  if (!entity.wardrobe || !Object.hasOwn(garments[slot], garmentId)) return false;
  if (entity.wardrobe[slot] !== garmentId) entity.wardrobe = { ...entity.wardrobe, [slot]: garmentId };
  return true;
}
