import type { Point } from "../entities/EntityManager";
import type { DriverProfile } from "../entities/Appearance";
import type { RoadLoop, RoadPose } from "./TrafficRoute";
import type { Crosswalk } from "./PedestrianSystem";
import { forwardGap, loopLength, roadPose, stopDistances } from "./TrafficRoute";

export interface TrafficModel {
  body: "hatchback" | "sedan" | "pickup";
  width: number;
  length: number;
  height: number;
  wheelbase: number;
  topSpeed: number;
  acceleration: number;
}

export interface TrafficSpawn {
  id: string;
  road: RoadLoop;
  distance: number;
  model: TrafficModel;
  color: number;
  driver: DriverProfile;
}

export interface TrafficCar {
  readonly spawn: TrafficSpawn;
  distance: number;
  previous: number;
  speed: number;
  travelled: number;
  braking: boolean;
  waiting: number;
  arrived: number;
  damage: number;
  explosionAge?: number;
  offRoute?: { pose: RoadPose; previous: RoadPose };
}

const BRAKE = 4.2;
const FOLLOW_GAP = 2.1;
const STOP_TIME = .7;
const TURN_SPEED = 4.5;

/** Lane-following simulation. One car at a time reserves the shared junction. */
export class TrafficSystem {
  readonly cars: readonly TrafficCar[];
  private time = 0;
  private crossing: TrafficCar | undefined;
  private crossingRemaining = 0;

  constructor(spawns: readonly TrafficSpawn[]) {
    this.cars = spawns.map((spawn) => ({
      spawn, distance: spawn.distance, previous: spawn.distance, speed: 0,
      travelled: 0, braking: false, waiting: 0, arrived: Infinity, damage: 0,
    }));
  }

  detach(car: TrafficCar): void {
    if (car.offRoute) return;
    const pose = this.pose(car, 1);
    car.offRoute = { pose, previous: pose };
    if (this.crossing === car) this.crossing = undefined;
  }

  step(dt: number, pedestrian?: Point, crosswalks: readonly Crosswalk[] = []): void {
    this.time += dt;
    if (!this.crossing) {
      const next = this.cars.filter((car) => !car.offRoute && car.waiting >= STOP_TIME)
        .sort((a, b) => a.arrived - b.arrived)[0];
      if (next) {
        this.crossing = next;
        this.crossingRemaining = 2 * next.spawn.road.stop;
        next.waiting = 0;
        next.arrived = Infinity;
      }
    }
    // Compute every driver's decision from the same starting poses.
    const plans = this.cars.map((car) => car.offRoute ? null : this.plan(car, pedestrian, dt, crosswalks));
    this.cars.forEach((car, index) => {
      const plan = plans[index];
      if (!plan) return;
      const { speed, move, stoppedAtLine } = plan;
      car.previous = car.distance;
      car.braking = speed + .025 < car.speed || speed < .04 && (stoppedAtLine || move === 0);
      car.speed = speed;
      car.distance = (car.distance + move) % loopLength(car.spawn.road);
      car.travelled += move;
      if (this.crossing === car) {
        this.crossingRemaining -= move;
        if (this.crossingRemaining <= 0) this.crossing = undefined;
      }
      if (stoppedAtLine) {
        if (!car.waiting) car.arrived = this.time;
        car.waiting += dt;
      }
    });
  }

  pose(car: TrafficCar, alpha: number) {
    if (car.offRoute) {
      const { pose, previous } = car.offRoute;
      return { x: previous.x + (pose.x - previous.x) * alpha, z: previous.z + (pose.z - previous.z) * alpha,
        yaw: previous.yaw + (pose.yaw - previous.yaw) * alpha, turning: pose.turning };
    }
    const length = loopLength(car.spawn.road);
    return roadPose(car.spawn.road, car.previous + forwardGap(car.previous, car.distance, length) * alpha);
  }

  private plan(car: TrafficCar, pedestrian: Point | undefined, dt: number, crosswalks: readonly Crosswalk[]) {
    const { road, model } = car.spawn;
    const length = loopLength(road);
    let hardDistance = Infinity;
    let target = model.topSpeed;
    const limitForStop = (distance: number) => {
      hardDistance = Math.min(hardDistance, distance);
      target = Math.min(target, Math.sqrt(2 * BRAKE * distance));
    };
    const toLine = Math.min(...stopDistances(road).map((stop) =>
      Math.abs(car.distance - stop) < 1e-7 ? 0 : forwardGap(car.distance, stop, length)));
    if (this.crossing !== car) limitForStop(toLine);

    const { turning } = roadPose(road, car.distance);
    for (const { from, to } of crosswalks) {
      const acrossX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
      if (acrossX !== (road.axis === "z")) continue;
      const band = acrossX ? from.z : from.x;
      const forward = road.end + band;
      const backward = 3 * road.end + Math.PI * road.lane - band;
      const gap = Math.min(forwardGap(car.distance, forward, length), forwardGap(car.distance, backward, length));
      // Stop the bumper short of the marked strip even when already beyond the stop line.
      if (gap < 35) limitForStop(Math.max(0, gap - model.length / 2 - 1.8));
    }
    if (turning) target = Math.min(target, TURN_SPEED);
    else {
      const toTurn = Math.min(forwardGap(car.distance, 2 * road.end, length),
        forwardGap(car.distance, 4 * road.end + Math.PI * road.lane, length));
      target = Math.min(target, Math.sqrt(TURN_SPEED ** 2 + 2 * BRAKE * toTurn));
    }

    for (const other of this.cars) {
      if (other === car || other.offRoute || other.spawn.road.id !== road.id) continue;
      const gap = forwardGap(car.distance, other.distance, length) - (model.length + other.spawn.model.length) / 2;
      const clear = Math.max(0, gap - FOLLOW_GAP);
      hardDistance = Math.min(hardDistance, clear);
      target = Math.min(target, other.speed + clear / 1.35, Math.sqrt(other.speed ** 2 + 2 * BRAKE * clear));
    }

    // Sample the lane ahead for the player or any car no longer controlled by traffic.
    const lookAhead = Math.max(8, car.speed ** 2 / (2 * BRAKE) + model.length / 2 + 2.5);
    const obstacles = this.cars.filter((other) => other.offRoute).map((other) => {
      const pose = other.offRoute!.pose;
      return { ...pose, halfW: other.spawn.model.width / 2, halfL: other.spawn.model.length / 2 };
    });
    if (pedestrian && pedestrian.y < model.height + .1 || obstacles.length) {
      const width = model.width / 2;
      for (let step = 0; step <= lookAhead; step += .45) {
        const p = roadPose(road, car.distance + step);
        if (pedestrian && pedestrian.y < model.height + .1 &&
          Math.hypot(pedestrian.x - p.x, pedestrian.z - p.z) < width + .55) {
          // Drivers brake, but cannot stop instantly if someone steps into the lane late.
          target = Math.min(target, Math.sqrt(2 * BRAKE * Math.max(0, step - model.length / 2 - .75)));
          break;
        }
        if (obstacles.some((o) => {
          const x = p.x - o.x, z = p.z - o.z;
          return Math.abs(x * Math.cos(o.yaw) - z * Math.sin(o.yaw)) < o.halfW + width + .15
            && Math.abs(x * Math.sin(o.yaw) + z * Math.cos(o.yaw)) < o.halfL + width;
        })) {
          limitForStop(Math.max(0, step - model.length / 2 - .75));
          break;
        }
      }
    }

    let speed = car.speed + Math.max(-BRAKE * dt, Math.min(model.acceleration * dt, target - car.speed));
    // Exact stopping boundaries prevent overshoot at the line or into a stopped leader.
    const move = Math.min(hardDistance, Math.max(0, speed) * dt);
    if (move === hardDistance) speed = 0;
    return { speed, move, stoppedAtLine: this.crossing !== car && toLine - move < .001 && speed < .05 };
  }
}
