import { expect, it } from "vitest";
import { GameDirector } from "../src/core/GameDirector";
import { HealthSystem } from "../src/systems/HealthSystem";

it("starts at full health, ignores slow traffic, and enforces a cooldown", () => {
  const health = new HealthSystem();
  expect(health.value).toBe(100);
  expect(health.applyTrafficImpact(3)).toBe(false);
  expect(health.applyTrafficImpact(8)).toBe(true);
  expect(health.value).toBe(80);
  health.step(.5);
  expect(health.applyTrafficImpact(8)).toBe(false);
  health.step(.5);
  expect(health.applyTrafficImpact(8)).toBe(true);
  expect(health.value).toBe(60);
});

it("clamps lethal damage to zero and keeps death mode frozen until a new session", () => {
  const health = new HealthSystem();
  for (let i = 0; i < 6; i++) {
    health.applyTrafficImpact(9);
    health.step(1);
  }
  expect(health.value).toBe(0);
  expect(health.depleted).toBe(true);
  expect(health.applyTrafficImpact(9)).toBe(false);
  const director = new GameDirector();
  director.die();
  director.pause();
  director.resume();
  expect(director.mode).toBe("dead");
  expect(director.policy).toMatchObject({ physics: false, walk: false, drive: false, interact: false });
  expect(director.setFreeMode("exploration")).toBe(false);
  expect(new HealthSystem().value).toBe(100);
});
