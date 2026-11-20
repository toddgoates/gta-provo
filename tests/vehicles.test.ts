import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { playerDefinition } from "../src/content/downtownStory";
import { downtownTraffic } from "../src/content/vehicles/downtownTraffic";
import { resolveWardrobe } from "../src/content/characters/wardrobe";
import { FIXED_DT } from "../src/core/GameLoop";
import { EntityManager } from "../src/entities/EntityManager";
import { MovementSystem } from "../src/systems/MovementSystem";
import { TrafficSystem } from "../src/systems/TrafficSystem";
import { driveMotion, VehicleSystem } from "../src/systems/VehicleSystem";

const neutral = { throttle: 0, steer: 0, brake: false };
beforeAll(async () => { await RAPIER.init(); });

it("assigns distinct, valid outfits and appearances across the downtown drivers", () => {
  const profiles = downtownTraffic.map(({ driver }) => driver);
  const appearances = profiles.map(({ appearance }) => appearance);
  const outfits = appearances.map(({ defaultWardrobe }) => resolveWardrobe(defaultWardrobe));
  expect(new Set(profiles.map(({ gender }) => gender))).toEqual(new Set(["male", "female"]));
  expect(new Set(appearances.map(({ haircut }) => haircut)).size).toBe(4);
  for (const colors of [
    appearances.map(({ skin }) => skin), appearances.map(({ hair }) => hair),
    outfits.map(({ top }) => top.color), outfits.map(({ bottoms }) => bottoms.color),
  ]) expect(new Set(colors).size).toBe(profiles.length);
});

it("accelerates, steers in opposite directions in forward and reverse, and brakes to zero", () => {
  const { model } = downtownTraffic[0];
  const accelerating = driveMotion(8, model, { throttle: 1, steer: 1, brake: false }, FIXED_DT);
  expect(accelerating.speed).toBeGreaterThan(8);
  expect(accelerating.turn).toBeGreaterThan(0);
  expect(driveMotion(-3, model, { throttle: -1, steer: 1, brake: false }, FIXED_DT).turn).toBeLessThan(0);
  expect(driveMotion(.1, model, { throttle: 1, steer: 0, brake: true }, FIXED_DT).speed).toBe(0);
});

it("boards only a nearby slow car, ejects its driver once, and parks beside a clear exit", () => {
  const world = new RAPIER.World({ x: 0, y: -19, z: 0 });
  world.timestep = FIXED_DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(80, .5, 80).setTranslation(0, -.5, 0));
  const traffic = new TrafficSystem([downtownTraffic[0]]);
  const vehicles = new VehicleSystem(world, traffic);
  const [car] = traffic.cars;
  const start = traffic.pose(car, 1);
  const player = new EntityManager().spawn("player", playerDefinition, { x: start.x, y: .05, z: start.z + 1.9 });
  const movement = new MovementSystem(world, player);
  const step = (input = neutral) => { vehicles.step(FIXED_DT, input); world.step(); };
  try {
    world.step();
    car.speed = 6;
    expect(vehicles.nearest(player.position, movement.collider)).toBeNull();
    car.speed = 0;
    expect(vehicles.nearest(player.position, movement.collider)?.car).toBe(car);
    vehicles.enter(car, player.position);
    movement.board();
    expect(movement.collider.isEnabled()).toBe(false);
    expect(car.offRoute).toBeDefined();
    expect(vehicles.drivers[0].profile).toBe(car.spawn.driver);
    expect(vehicles.drivers[0].running).toBe(false);
    for (let i = 0; i < 80; i++) step({ ...neutral, throttle: 1 });
    expect(traffic.pose(car, 1).x).toBeGreaterThan(start.x + 3);
    expect(vehicles.drivers[0].running).toBe(true);
    expect(vehicles.exit()).toBeNull();
    vehicles.exitRequested = true;
    for (let i = 0; i < 60; i++) step();
    const exit = vehicles.exit()!;
    expect(exit?.car).toBe(car);
    movement.disembark(exit.point, exit.yaw);
    expect(movement.collider.isEnabled()).toBe(true);
    const parked = traffic.pose(car, 1);
    for (let i = 0; i < 60; i++) {
      movement.prepare(FIXED_DT, { heading: 0, forward: 0, strafe: 0, sprint: false, jump: false });
      step();
      movement.commit(FIXED_DT);
    }
    expect(player.position.y).toBeCloseTo(.025, 2);
    for (let i = 0; i < 300; i++) step();
    expect(traffic.pose(car, 1)).toEqual(parked);
    expect(vehicles.drivers).toHaveLength(0);
    vehicles.enter(car, exit.point);
    expect(vehicles.drivers).toHaveLength(0);
  } finally {
    movement.dispose();
    vehicles.dispose();
    world.free();
  }
});

it("sweeps the player's car against a wall instead of driving through it", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = FIXED_DT;
  const traffic = new TrafficSystem([downtownTraffic[0]]);
  const vehicles = new VehicleSystem(world, traffic);
  const [car] = traffic.cars;
  const start = traffic.pose(car, 1);
  const wall = start.x + 5;
  world.createCollider(RAPIER.ColliderDesc.cuboid(.3, 2, 3).setTranslation(wall, 2, start.z));
  try {
    world.step();
    vehicles.enter(car, { x: start.x, y: 0, z: start.z + 2 });
    for (let i = 0; i < 120; i++) {
      vehicles.step(FIXED_DT, { ...neutral, throttle: 1 });
      world.step();
    }
    const front = traffic.pose(car, 1).x + car.spawn.model.length / 2;
    expect(front).toBeGreaterThan(wall - .5);
    expect(front).toBeLessThan(wall - .29);
    expect(car.speed).toBe(0);
  } finally {
    vehicles.dispose();
    world.free();
  }
});
