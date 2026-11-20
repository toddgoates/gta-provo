import { expect, it } from "vitest";
import { downtownRoads, downtownTraffic } from "../src/content/vehicles/downtownTraffic";
import { FIXED_DT } from "../src/core/GameLoop";
import { forwardGap, loopLength, roadPose, stopDistances } from "../src/systems/TrafficRoute";
import { TrafficSystem } from "../src/systems/TrafficSystem";

const sidewalk = { x: -19, y: .16, z: 15 };

it("keeps both directions and the edge turnarounds on the road", () => {
  for (const road of downtownRoads) {
    const length = loopLength(road);
    expect(roadPose(road, length)).toEqual(roadPose(road, 0));
    for (let s = 0; s < length; s += .25) {
      const { x, z, yaw } = roadPose(road, s);
      const next = roadPose(road, s + .001);
      expect(Math.abs(road.axis === "x" ? z : x)).toBeLessThan(4.06);
      expect(Math.abs(road.axis === "x" ? x : z)).toBeLessThan(road.end + road.lane + .01);
      expect(((next.x - x) * -Math.sin(yaw) + (next.z - z) * -Math.cos(yaw)) / .001).toBeGreaterThan(.99);
    }
  }
});

it("stops each car at the junction, queues safely, and grants only one crossing at a time", () => {
  const traffic = new TrafficSystem(downtownTraffic);
  const stopped = new Set<string>();
  const longestWait = new Map<string, number>();
  let closestGap = Infinity;
  let maxInJunction = 0;
  for (let i = 0; i < 60 * 100; i++) {
    traffic.step(FIXED_DT, sidewalk);
    let inJunction = 0;
    for (const car of traffic.cars) {
      const { road, id, model } = car.spawn;
      expect(car.speed).toBeLessThanOrEqual(model.topSpeed + 1e-8);
      if (stopDistances(road).some((s) => Math.abs(car.distance - s) < .001) && car.speed < .04) stopped.add(id);
      longestWait.set(id, Math.max(car.waiting, longestWait.get(id) ?? 0));
      const { x, z, turning } = traffic.pose(car, 1);
      if (turning) expect(car.speed).toBeLessThan(4.75);
      if (Math.abs(road.axis === "x" ? x : z) < 10) inJunction++;
      for (const other of traffic.cars) {
        if (other === car || other.spawn.road.id !== road.id) continue;
        closestGap = Math.min(closestGap, forwardGap(car.distance, other.distance, loopLength(road))
          - (model.length + other.spawn.model.length) / 2);
      }
    }
    maxInJunction = Math.max(inJunction, maxInJunction);
  }
  expect(stopped.size).toBe(traffic.cars.length);
  expect([...longestWait.values()].every((wait) => wait >= .7)).toBe(true);
  expect(closestGap).toBeGreaterThanOrEqual(2.09);
  expect(maxInJunction).toBe(1);
  for (const car of traffic.cars) expect(car.travelled).toBeGreaterThan(loopLength(car.spawn.road));
});

it("yields to a pedestrian and resumes when the lane is clear", () => {
  const traffic = new TrafficSystem([downtownTraffic[0]]);
  const [car] = traffic.cars;
  const pedestrian = { x: -21, y: 0, z: downtownRoads[0].lane };
  for (let i = 0; i < 240; i++) traffic.step(FIXED_DT, pedestrian);
  expect(traffic.pose(car, 1).x + car.spawn.model.length / 2).toBeLessThan(pedestrian.x);
  expect(car.speed).toBe(0);
  expect(car.braking).toBe(true);
  for (let i = 0; i < 130; i++) traffic.step(FIXED_DT, sidewalk);
  expect(traffic.pose(car, 1).x).toBeGreaterThan(pedestrian.x);
});
