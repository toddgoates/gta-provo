import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { playerDefinition } from "../src/content/downtownStory";
import { FIXED_DT } from "../src/core/GameLoop";
import { EntityManager } from "../src/entities/EntityManager";
import { MovementSystem, PLAYER_HEIGHT } from "../src/systems/MovementSystem";

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

it("measures a tall fall while airborne and clears the distance on landing", () => {
  const world = new RAPIER.World({ x: 0, y: -19, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, .5, 10).setTranslation(0, -.5, 0));
  const player = new EntityManager().spawn("player", playerDefinition, { x: 0, y: 8, z: 0 });
  const movement = new MovementSystem(world, player);
  try {
    world.step();
    let crossedBeforeLanding = false;
    let landing = 0;
    for (let i = 0; i < 110 && !landing; i++) {
      movement.prepare(FIXED_DT, { heading: 0, forward: 0, strafe: 0, sprint: false, jump: false });
      world.step();
      landing = movement.commit(FIXED_DT);
      if (!landing && movement.currentFallDistance >= 2 * PLAYER_HEIGHT) crossedBeforeLanding = true;
    }
    expect(crossedBeforeLanding).toBe(true);
    expect(landing).toBeCloseTo(7.975, 2);
    expect(movement.currentFallDistance).toBe(0);
  } finally {
    movement.dispose();
    world.free();
  }
});
