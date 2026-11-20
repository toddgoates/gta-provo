import type { TrafficSpawn, TrafficModel } from "../../systems/TrafficSystem";
import type { RoadLoop } from "../../systems/TrafficRoute";
import { downtown } from "../downtown";

export const downtownRoads = [
  { id: "center", axis: "x", end: downtown.bounds.width / 2 - 9, lane: 4.05, stop: 15.7 },
  { id: "university", axis: "z", end: downtown.bounds.depth / 2 - 9, lane: 4.05, stop: 15.7 },
] as const satisfies readonly RoadLoop[];

const models = {
  hatchback: { body: "hatchback", width: 1.72, length: 3.65, height: 1.47, wheelbase: 2.35, topSpeed: 10, acceleration: 2.5 },
  sedan: { body: "sedan", width: 1.84, length: 4.45, height: 1.42, wheelbase: 2.68, topSpeed: 11.2, acceleration: 2.3 },
  pickup: { body: "pickup", width: 2.01, length: 4.8, height: 1.77, wheelbase: 3.05, topSpeed: 9.5, acceleration: 1.95 },
} as const satisfies Record<string, TrafficModel>;

export const downtownTraffic: readonly TrafficSpawn[] = [
  { id: "traffic-coral", road: downtownRoads[0], distance: 33, model: models.hatchback, color: 0xc85b50 },
  { id: "traffic-cream", road: downtownRoads[0], distance: 12, model: models.sedan, color: 0xddc88d },
  { id: "traffic-sage", road: downtownRoads[0], distance: 158, model: models.pickup, color: 0x6a8a77 },
  { id: "traffic-blue", road: downtownRoads[1], distance: 18, model: models.sedan, color: 0x4e7eac },
  { id: "traffic-yellow", road: downtownRoads[1], distance: 124, model: models.hatchback, color: 0xe5ac45 },
  { id: "traffic-plum", road: downtownRoads[1], distance: 109, model: models.pickup, color: 0x8d627b },
];
