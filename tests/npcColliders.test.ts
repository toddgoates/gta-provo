import RAPIER from "@dimforge/rapier3d-compat";
import { expect, it } from "vitest";
import { FIXED_DT } from "../src/core/GameLoop";
import { EntityManager } from "../src/entities/EntityManager";
import { playerDefinition } from "../src/content/downtownStory";
import { MovementSystem } from "../src/systems/MovementSystem";
import { NpcColliders, WITHOUT_NPC_BODIES } from "../src/systems/NpcColliders";

it("stops the player at a standing NPC without blocking sight, and removes the blocker when downed", async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -19, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(8, .5, 8).setTranslation(0, -.5, 0));
  const player = new EntityManager().spawn("player", playerDefinition, { x: 0, y: .05, z: 2 });
  const movement = new MovementSystem(world, player);
  const colliders = new NpcColliders(world);
  try {
    colliders.sync([{ id: "npc", position: { x: 0, y: 0, z: 0 } }]);
    world.step();
    const walk = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        movement.prepare(FIXED_DT, { forward: 1, heading: 0, strafe: 0, sprint: false, jump: false });
        world.step();
        movement.commit(FIXED_DT);
      }
    };
    walk(45);
    expect(player.position.z).toBeGreaterThan(.61);
    expect(player.position.z).toBeLessThan(.7);
    const throughNpc = new RAPIER.Ray({ x: 0, y: 1, z: 2 }, { x: 0, y: 0, z: -1 });
    expect(world.castRay(throughNpc, 3, true, undefined, WITHOUT_NPC_BODIES, movement.collider)).toBeNull();
    colliders.sync([]);
    walk(35);
    expect(player.position.z).toBeLessThan(-1);
  } finally {
    colliders.dispose();
    movement.dispose();
    world.free();
  }
});
