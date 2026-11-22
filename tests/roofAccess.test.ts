import { expect, it } from "vitest";
import { hasRoofRouteSupport, isOnRoofStairs, roofSearchTarget, roofStepHeight, roofWaypoints, stairHeight } from "../src/content/roofAccess";

it("routes from the sidewalk to the roof through the ramp and landing, not through open air", () => {
  for (let i = 1; i < roofWaypoints.length; i++) {
    expect(hasRoofRouteSupport(roofWaypoints[i - 1], roofWaypoints[i])).toBe(true);
  }
  expect(hasRoofRouteSupport(roofWaypoints[0], roofWaypoints.at(-1)!)).toBe(false);
  expect(roofStepHeight(roofWaypoints[0], roofWaypoints[2])).toBe(.15);
  const mid = { x: roofWaypoints[1].x, z: (roofWaypoints[1].z + roofWaypoints[2].z) / 2, y: 4.225 };
  expect(stairHeight(mid)).toBeCloseTo(mid.y);
  expect(isOnRoofStairs(mid)).toBe(true);
  expect(roofStepHeight(mid, { ...mid, z: mid.z + .1 })).toBeGreaterThan(mid.y);
  expect(roofSearchTarget(mid)).toBe(roofWaypoints[4]);
  expect(roofSearchTarget({ ...mid, x: 30 })).toBeUndefined();
  expect(roofStepHeight(roofWaypoints.at(-1)!, { x: -10, y: 8.3, z: 34 })).toBeUndefined();
});
