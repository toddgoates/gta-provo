import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { playerDefinition } from "../src/content/downtownStory";
import { FIXED_DT } from "../src/core/GameLoop";
import { EntityManager } from "../src/entities/EntityManager";
import { MovementSystem } from "../src/systems/MovementSystem";

beforeAll(async () => { await RAPIER.init(); });

it("steps over a curb, jumps and lands, and stops at a wall", () => {
  const world = new RAPIER.World({ x: 0, y: -19, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, -.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(4, .08, 4).setTranslation(0, .08, -5));
  world.createCollider(RAPIER.ColliderDesc.cuboid(4, 3, .25).setTranslation(0, 3, -5));
  const player = new EntityManager().spawn("player", playerDefinition, { x: 0, y: .1, z: 0 });
  const movement = new MovementSystem(world, player);
  const step = (forward = 0, jump = false) => {
    movement.prepare(FIXED_DT, { heading: 0, strafe: 0, forward, jump, sprint: false });
    world.step();
    movement.commit(FIXED_DT);
  };
  try {
    world.step();
    for (let i = 0; i < 42; i++) step(1);
    expect(player.position.z).toBeLessThan(-2);
    expect(player.position.y).toBeCloseTo(.185, 2);
    step(0, true);
    for (let i = 0; i < 12; i++) step();
    expect(player.position.y).toBeGreaterThan(.9);
    for (let i = 0; i < 60; i++) step(1);
    expect(player.position.y).toBeCloseTo(.185, 2);
    expect(player.position.z).toBeGreaterThan(-4.5);
    expect(player.position.z).toBeLessThan(-4.2);
  } finally {
    movement.dispose();
    world.free();
  }
});
