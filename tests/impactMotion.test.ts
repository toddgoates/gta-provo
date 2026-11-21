import { expect, it } from "vitest";
import { launchImpact, stepImpact } from "../src/systems/ImpactMotion";

it("launches away from the car, lands with a bounce, and settles on the surface", () => {
  const motion = launchImpact(12, { x: 12, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  let position = { x: 0, y: .15, z: 0 };
  let highest = position.y;
  let settled = false;
  for (let i = 0; i < 90 && !settled; i++) {
    ({ position, settled } = stepImpact(motion, position, 1 / 60, () => true, () => .15));
    highest = Math.max(highest, position.y);
  }
  expect(highest).toBeGreaterThan(.5);
  expect(motion.bounced).toBe(true);
  expect(settled).toBe(true);
  expect(position.y).toBe(.15);
  expect(position.x).toBeGreaterThan(1);
  expect(position.z).toBeGreaterThan(.5);
});

it("does not carry the character through a wall", () => {
  const motion = launchImpact(10, { x: 10, y: 0, z: 0 });
  let position = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 60; i++) {
    const step = stepImpact(motion, position, 1 / 60, (_, to) => to.x < .5, () => 0);
    position = step.position;
    expect(position.x).toBeLessThan(.5);
    if (step.settled) break;
  }
});
