import { expect, it } from "vitest";
import { playerDefinition } from "../src/content/downtownStory";
import { EntityManager } from "../src/entities/EntityManager";
import { buildCharacter } from "../src/render/CharacterView";
import { equipGarment } from "../src/systems/WardrobeSystem";

it("equips by slot without mutating the character definition or another instance", () => {
  const entities = new EntityManager();
  const feet = { x: 0, y: 0, z: 0 };
  const player = entities.spawn("player", playerDefinition, feet);
  const other = entities.spawn("other", playerDefinition, feet);
  const original = player.wardrobe!;
  expect(original).toEqual({ top: "gray-tee", bottoms: "blue-jeans", shoes: "dark-sneakers" });
  expect(equipGarment(player, "top", "blue-jeans")).toBe(false);
  expect(equipGarment(player, "top", "toString")).toBe(false);
  expect(player.wardrobe).toBe(original);
  expect(equipGarment(player, "top", "marla-cardigan")).toBe(true);
  expect(player.wardrobe).toEqual({ ...original, top: "marla-cardigan" });
  expect(other.wardrobe).toEqual(original);
  expect(playerDefinition.appearance?.defaultWardrobe).toEqual(original);
});

it("updates clothing on the existing character rig", () => {
  const player = new EntityManager().spawn("player", playerDefinition, { x: 0, y: 0, z: 0 });
  const view = buildCharacter(player);
  const arm = view.limbs[1];
  const sleeve = arm.children[1];
  expect(sleeve.scale.y).toBe(.19);
  equipGarment(player, "top", "marla-cardigan");
  view.updateWardrobe(player.wardrobe!);
  expect(arm.children[1]).toBe(sleeve);
  expect(sleeve.scale.y).toBe(.27);
  equipGarment(player, "top", "gray-tee");
  view.updateWardrobe(player.wardrobe!);
  expect(sleeve.scale.y).toBe(.19);
});
