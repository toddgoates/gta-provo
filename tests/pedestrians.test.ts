import { expect, it } from "vitest";
import { createPedestrianLook } from "../src/content/characters/pedestrianLooks";
import { resolveWardrobe } from "../src/content/characters/wardrobe";
import { downtownPedestrians } from "../src/content/pedestrians";
import { downtownTraffic } from "../src/content/vehicles/downtownTraffic";
import { EntityManager } from "../src/entities/EntityManager";
import { crossingIsClear, PedestrianSystem } from "../src/systems/PedestrianSystem";
import { TrafficSystem } from "../src/systems/TrafficSystem";

const crosswalk = { from: { x: -10.25, y: .15, z: 11.15 }, to: { x: 10.25, y: .15, z: 11.15 } };
const car = { x: 4, z: 20, yaw: 0, speed: 7, length: 4.5, width: 1.8, turning: false };

it("waits at the curb for a car approaching the crosswalk", () => {
  const crowd = new PedestrianSystem(new EntityManager(), [
    { id: "test", count: 2, path: [[-10.25, 11.15], [10.25, 11.15]], crossings: [0] },
  ], (index) => createPedestrianLook(index, () => .5), () => 0);
  expect(crossingIsClear(crosswalk, [car])).toBe(false);
  expect(crossingIsClear(crosswalk, [{ ...car, z: 15.7, speed: 0 }])).toBe(true);
  const waiting = crowd.walkers.map(({ entity }) => entity.position);
  expect(crowd.step(1 / 60, [car])).toHaveLength(0);
  expect(crowd.walkers.map(({ entity }) => entity.position)).toEqual(waiting);
  expect(crowd.step(.5, [])).toHaveLength(1);
  expect(crowd.step(.5, [car])).toHaveLength(1); // A committed group finishes; traffic yields.
  expect(crowd.walkers.every(({ entity }) => entity.position.x > crosswalk.from.x)).toBe(true);
});

it("moves downtown groups across marked crosswalks while traffic keeps clear", () => {
  const crowd = new PedestrianSystem(new EntityManager(), downtownPedestrians,
    (index) => createPedestrianLook(index, () => (index % 6 + .5) / 6), () => .4);
  const traffic = new TrafficSystem(downtownTraffic);
  const dt = 1 / 60;
  let crossed = 0;
  let carDrove = false;
  for (let tick = 0; tick < 60 * 65; tick++) {
    const crossings = crowd.step(dt, traffic.cars.map((car) => ({
      ...traffic.pose(car, 1), speed: car.speed, length: car.spawn.model.length, width: car.spawn.model.width,
    })));
    traffic.step(dt, undefined, crossings);
    for (const { entity: { position } } of crowd.walkers) {
      if (Math.abs(position.x) > 9.2 && Math.abs(position.z) > 9.2) continue;
      crossed++;
      expect(Math.abs(Math.abs(position.x) - 11.15) < .5 || Math.abs(Math.abs(position.z) - 11.15) < .5).toBe(true);
      for (const car of traffic.cars) {
        const { x, z } = traffic.pose(car, 1);
        expect(Math.hypot(position.x - x, position.z - z)).toBeGreaterThan(1.65);
        if (car.travelled > 100) carDrove = true;
      }
    }
  }
  expect(crossed).toBeGreaterThan(100);
  expect(carDrove).toBe(true);
  expect(crowd.walkers.filter(({ entity }) => entity.definition.faction !== "police")).toHaveLength(13);
  const looks = crowd.walkers.map(({ entity }) => entity.definition.appearance!);
  expect(new Set(looks.map(({ haircut }) => haircut)).size).toBeGreaterThan(1);
  for (const look of looks) expect(resolveWardrobe(look.defaultWardrobe).top.color).toBeTypeOf("number");
});
