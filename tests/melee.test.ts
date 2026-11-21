import { expect, it } from "vitest";
import { playerDefinition, marlaDefinition } from "../src/content/downtownStory";
import { EntityManager } from "../src/entities/EntityManager";
import { poseCharacter } from "../src/render/CharacterMotion";
import { buildCharacter } from "../src/render/CharacterView";
import { HealthSystem } from "../src/systems/HealthSystem";
import { MAX_PEDESTRIAN_HEALTH, MeleeSystem } from "../src/systems/MeleeSystem";

function setup(random: number, z = 11, clear = true) {
  const entities = new EntityManager();
  const player = entities.spawn("player", playerDefinition, { x: 12, y: .15, z: 12 });
  const npc = entities.spawn("npc", marlaDefinition, { x: 12, y: .15, z });
  return { npc, player, melee: new MeleeSystem(player, [npc], () => clear, () => random) };
}

it("dodges if there is time and room, but falls and recovers after a slow impact", () => {
  const first = setup(.95);
  const contact = { npc: first.npc, speed: 5, origin: { x: 12, y: 0, z: 15 }, velocity: { x: 0, y: 0, z: -5 }, halfWidth: .9, eta: .6 };
  first.melee.reactToVehicle(contact, 1 / 60);
  for (let i = 0; i < 12; i++) first.melee.step(1 / 60, false, false);
  expect(first.melee.dodgeProgress(first.npc.id)).toBeGreaterThan(0);
  expect(first.npc.position.x).toBeGreaterThan(12.8);
  expect(first.melee.healthOf(first.npc.id)).toBe(MAX_PEDESTRIAN_HEALTH);

  const second = setup(.95);
  second.melee.reactToVehicle({ ...contact, npc: second.npc, eta: 0 }, 1 / 60);
  expect(second.melee.isDown(second.npc.id)).toBe(true);
  expect(second.melee.healthOf(second.npc.id)).toBe(45);
  for (let i = 0; i < 110; i++) second.melee.step(1 / 60, false, false);
  expect(second.melee.isDown(second.npc.id)).toBe(false);
  expect(second.melee.reactionSpeed(second.npc.id)).toBeGreaterThan(0);
});

it("a fast impact removes all health even if a dodge was attempted", () => {
  const { melee, npc } = setup(.95);
  const contact = { npc, speed: 11, origin: { x: 12, y: 0, z: 15 }, velocity: { x: 0, y: 0, z: -11 }, halfWidth: .9, eta: 0 };
  melee.reactToVehicle(contact, 1 / 60);
  for (let i = 0; i < 90; i++) melee.step(1 / 60, false, false);
  expect(melee.healthOf(npc.id)).toBe(0);
  expect(melee.fallProgress(npc.id)).toBe(1);
  expect(melee.reactionSpeed(npc.id)).toBe(0);
});

it("buffers two presses into a punch, punch, kick combo and resets after a break", () => {
  const { player, melee } = setup(0);
  const moves = new Set<number | undefined>();
  for (let i = 0; i < 105; i++) {
    melee.step(1 / 60, i === 0 || i === 5 || i === 10, true);
    moves.add(melee.getPose(player.id)?.move);
  }
  expect([...moves]).toEqual([0, 1, 2, undefined]);
  melee.step(1 / 60, true, true);
  expect(melee.getPose(player.id)?.move).toBe(0);
});

it("registers contact at impact and ignores targets behind the player or through obstacles", () => {
  const { npc, melee } = setup(0);
  melee.step(.1, true, true);
  expect(melee.hasReactor(npc.id)).toBe(false);
  melee.step(.1, false, true);
  expect(melee.hasReactor(npc.id)).toBe(true);
  for (const test of [setup(0, 13), setup(0, 11, false), setup(0, 8)]) {
    test.melee.step(.2, true, true);
    expect(test.melee.hasReactor(test.npc.id)).toBe(false);
  }
});

it("causes fleeing or counterattacks, and counterattacks take player health", () => {
  const escape = setup(0);
  const attacker = setup(.95);
  const health = new HealthSystem();
  for (let i = 0; i < 135; i++) {
    escape.melee.step(1 / 60, i === 0, true);
    health.step(1 / 60);
    health.applyMeleeHit(attacker.melee.step(1 / 60, i === 0, true));
  }
  expect(escape.npc.position).not.toEqual({ x: 12, y: .15, z: 11 });
  expect(health.value).toBeLessThan(100);
});

it("bends a kick at the knee and turns the torso during a punch", () => {
  const { player } = setup(0);
  const rig = buildCharacter(player);
  poseCharacter(rig, 0, { move: 0, progress: .44, flinch: 0 });
  expect(Math.abs(rig.torso.rotation.y)).toBeGreaterThan(.4);
  expect(rig.limbs[3].rotation.x).toBeGreaterThan(1);
  expect(rig.limbs[1].rotation.x).toBeLessThan(1);
  poseCharacter(rig, 0, { move: 1, progress: .5, flinch: 0 });
  expect(rig.limbs[1].rotation.x).toBeGreaterThan(1);
  expect(rig.limbs[3].rotation.x).toBeLessThan(1);
  poseCharacter(rig, 0, { move: 2, progress: .33, flinch: 0 });
  expect(rig.limbs[2].rotation.x).toBeGreaterThan(1);
  expect(rig.joints[2].rotation.x).toBeLessThan(-1);
  poseCharacter(rig, 0);
  expect(rig.joints[2].rotation.x).toBe(0);
});

it("a fighter still counterattacks after taking a full combo and waiting past the old timeout", () => {
  const { melee, npc } = setup(.95);
  for (let i = 0; i < 100; i++) melee.step(1 / 60, i === 0 || i === 5 || i === 10, true);
  for (let i = 0; i < 60 * 14; i++) melee.step(1 / 60, false, false);
  expect(npc.position).toEqual({ x: 12, y: .15, z: 11 });
  let damage = 0;
  for (let i = 0; i < 90; i++) damage += melee.step(1 / 60, false, true);
  expect(damage).toBeGreaterThan(0);
});

it("tracks punch and kick damage and keeps a downed NPC motionless and out of combat", () => {
  const { melee, npc } = setup(.95);
  expect(melee.healthOf(npc.id)).toBe(MAX_PEDESTRIAN_HEALTH);
  for (let i = 0; i < 100; i++) melee.step(1 / 60, i === 0 || i === 5 || i === 10, true);
  expect(melee.healthOf(npc.id)).toBe(MAX_PEDESTRIAN_HEALTH - 9 - 12 - 16);
  expect(melee.fallProgress(npc.id)).toBeUndefined();

  for (let i = 0; i < 80; i++) melee.step(1 / 60, i === 0 || i === 5 || i === 10, true);
  expect(melee.healthOf(npc.id)).toBe(0);
  const fall = melee.fallProgress(npc.id)!;
  expect(fall).toBeGreaterThan(0);
  expect(fall).toBeLessThan(1);
  const position = npc.position;
  let damage = 0;
  for (let i = 0; i < 240; i++) damage += melee.step(1 / 60, i % 30 === 0, true);
  expect(damage).toBe(0);
  expect(npc.position).toEqual(position);
  expect(melee.reactionSpeed(npc.id)).toBe(0);
  expect(melee.getPose(npc.id)).toBeUndefined();
  expect(melee.fallProgress(npc.id)).toBe(1);
  expect(melee.healthOf(npc.id)).toBe(0);
});
