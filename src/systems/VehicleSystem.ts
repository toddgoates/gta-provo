import RAPIER from "@dimforge/rapier3d-compat";
import type { EventBus } from "../core/EventBus";
import type { Entity, Point } from "../entities/EntityManager";
import type { DriverProfile } from "../entities/Appearance";
import type { Crosswalk } from "./PedestrianSystem";
import type { TrafficCar, TrafficSystem } from "./TrafficSystem";
import { MIN_TRAFFIC_IMPACT_SPEED } from "./HealthSystem";
import { WITHOUT_NPC_BODIES } from "./NpcColliders";

export interface DriveInput { throttle: number; steer: number; brake: boolean }
export const PEDESTRIAN_IMPACT_MIN = 2.25;
export const PEDESTRIAN_FATAL_SPEED = 9;
const DODGE_LOOKAHEAD = .65;
const NPC_CAPSULE = new RAPIER.Capsule(.48, .30);

export interface NpcVehicleContact {
  npc: Entity;
  eta: number;
  speed: number;
  origin: Point;
  velocity: Point;
  halfWidth: number;
  outward?: Point;
}
export interface VehicleExit { car: TrafficCar; point: Point; yaw: number }
const ENTRY_SPEED = 2.4;
const EXIT_SPEED = 1.0;
const PULL_OUT_SPEED = 2.4;
const QUERY = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
const rotation = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
const IDENTITY = rotation(0);
const approach = (value: number, target: number, amount: number) =>
  value + Math.max(-amount, Math.min(amount, target - value));

export function driveMotion(speed: number, model: TrafficCar["spawn"]["model"], input: DriveInput, dt: number) {
  const throttle = input.brake ? 0 : input.throttle;
  const opposite = speed * throttle < 0;
  const target = throttle > 0 ? Math.max(14, model.topSpeed * 1.65) : throttle < 0 ? -5 : 0;
  const rate = input.brake ? 13 : opposite ? 10 : throttle ? model.acceleration * 2.55 : 2.3;
  const next = approach(speed, opposite ? 0 : target, rate * dt);
  const turn = input.steer * Math.sign(next) * Math.min(1, Math.abs(next) / 2.25)
    * (1.65 - .62 * Math.min(1, Math.abs(next) / 16)) * dt;
  return { speed: next, turn, braking: input.brake || opposite };
}

interface CarBody { body: RAPIER.RigidBody; collider: RAPIER.Collider; sweep: RAPIER.Cuboid; center: number }
export interface FleeingDriver {
  id: string;
  profile: DriverProfile;
  position: Point;
  yaw: number;
  tumble: number;
  running: boolean;
}
interface Driver extends FleeingDriver { age: number; dx: number; dz: number }

export class VehicleSystem {
  private bodies = new Map<TrafficCar, CarBody>();
  private seated?: TrafficCar;
  private fleeing: Driver[] = [];
  exitRequested = false;
  exitBlocked = false;

  constructor(private readonly world: RAPIER.World, private readonly traffic: TrafficSystem, private readonly events?: EventBus) {
    for (const car of traffic.cars) {
      const { x, z, yaw } = traffic.pose(car, 1);
      const { width, height, length } = car.spawn.model;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(x, 0, z).setRotation(rotation(yaw)));
      const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, length / 2)
        .setTranslation(0, height / 2, 0), body);
      // Keep the sweep clear of low curbs so the arcade car can mount a sidewalk.
      this.bodies.set(car, { body, collider, sweep: new RAPIER.Cuboid(width / 2, (height - .22) / 2, length / 2),
        center: (height + .22) / 2 });
    }
  }

  get occupied(): TrafficCar | undefined { return this.seated; }
  get occupiedCollider(): RAPIER.Collider | undefined { return this.seated && this.bodies.get(this.seated)?.collider; }
  get drivers(): readonly FleeingDriver[] { return this.fleeing; }

  nearest(player: Point, playerCollider: RAPIER.Collider): { car: TrafficCar; gap: number } | null {
    let result: { car: TrafficCar; gap: number } | null = null;
    if (player.y > .75) return null;
    const eye = { ...player, y: player.y + 1 };
    for (const car of this.traffic.cars) {
      if (Math.abs(car.speed) > ENTRY_SPEED) continue;
      const { x, z, yaw } = this.traffic.pose(car, 1);
      const dx = player.x - x, dz = player.z - z;
      const { width, length, height } = car.spawn.model;
      const gap = Math.hypot(Math.max(0, Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) - width / 2),
        Math.max(0, Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)) - length / 2));
      if (gap > 1.65 || result && result.gap <= gap) continue;
      const hit = this.world.castRay(new RAPIER.Ray(eye, { x: -dx, y: height * .55 - eye.y, z: -dz }),
        1, true, QUERY, WITHOUT_NPC_BODIES, playerCollider);
      if (hit && hit.collider.handle !== this.bodies.get(car)!.collider.handle) continue;
      result = { car, gap };
    }
    return result;
  }

  enter(car: TrafficCar, player: Point, driverId?: string): void {
    if (this.seated) return;
    if (!car.offRoute) {
      const { x, z, yaw } = this.traffic.pose(car, 1);
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const side = (player.x - x) * cos - (player.z - z) * sin >= 0 ? 1 : -1;
      const dx = cos * side, dz = -sin * side;
      const offset = car.spawn.model.width / 2 + .25;
      this.fleeing.push({ id: `driver-${car.spawn.id}`, profile: car.spawn.driver,
        position: { x: x + dx * offset, y: .55, z: z + dz * offset },
        yaw: Math.atan2(-dx, -dz), tumble: .35, running: false, age: 0, dx, dz });
      this.traffic.detach(car);
      if (driverId) this.events?.emit("vehicle:stolen", {
        id: `theft-${car.spawn.id}`, offenderId: driverId, victimId: car.spawn.id, position: { ...player },
      });
    }
    this.seated = car;
    this.exitBlocked = false;
  }

  pursuitDoor(officer: Point): Point | undefined {
    if (!this.seated) return;
    const { x, z, yaw } = this.traffic.pose(this.seated, 1);
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const side = (officer.x - x) * cos - (officer.z - z) * sin >= 0 ? 1 : -1;
    const gap = side * (this.seated.spawn.model.width / 2 + .72);
    return { x: x + cos * gap, y: 0, z: z - sin * gap };
  }

  canPullOut(officer: Point): boolean {
    const car = this.seated;
    const door = this.pursuitDoor(officer);
    return !!car && !!door && Math.abs(car.speed) <= PULL_OUT_SPEED && Math.abs(officer.y) <= .65 &&
      Math.hypot(officer.x - door.x, officer.z - door.z) < .9;
  }

  exit(officer?: Point): VehicleExit | null {
    const car = this.seated;
    if (!car || (officer ? !this.canPullOut(officer) : Math.abs(car.speed) > EXIT_SPEED)) return null;
    const { x, z, yaw } = this.traffic.pose(car, 1);
    const { width, length } = car.spawn.model;
    const capsule = new RAPIER.Capsule(.48, .34);
    // Try beside either door, then behind the bumper. Reject floors outside a reasonable step.
    const side = width / 2 + .62;
    const lateral = officer && ((officer.x - x) * Math.cos(yaw) - (officer.z - z) * Math.sin(yaw) >= 0 ? side : -side);
    const longitudinal = officer && ((officer.x - x) * Math.sin(yaw) + (officer.z - z) * Math.cos(yaw) >= 0 ? -1 : 1);
    const exits = lateral && longitudinal
      ? [[lateral, longitudinal * .98], [lateral, -longitudinal * 1.16], [lateral * 1.22, longitudinal * 1.35]]
      : [[-side, 0], [side, 0], [0, length / 2 + .64]];
    for (const [localX, localZ] of exits) {
      const px = x + localX * Math.cos(yaw) + localZ * Math.sin(yaw);
      const pz = z - localX * Math.sin(yaw) + localZ * Math.cos(yaw);
      const ground = this.world.castRay(new RAPIER.Ray({ x: px, y: .61, z: pz }, { x: 0, y: -1, z: 0 }),
        .8, true, QUERY, undefined, undefined, undefined, (collider) => !collider.parent());
      if (!ground) continue;
      const point = { x: px, y: .65 - ground.timeOfImpact, z: pz };
      const center = { ...point, y: point.y + .82 };
      if (this.world.intersectionWithShape(center, IDENTITY, capsule, QUERY)) continue;
      this.seated = undefined;
      this.exitRequested = this.exitBlocked = false;
      car.speed = 0;
      car.braking = false;
      car.offRoute!.previous = car.offRoute!.pose;
      return { car, point, yaw };
    }
    if (!officer) {
      this.exitRequested = false;
      this.exitBlocked = true;
    }
    return null;
  }

  step(dt: number, input: DriveInput, pedestrian?: Point, crosswalks?: readonly Crosswalk[]): void {
    if (this.seated) this.drive(this.seated, dt, this.exitRequested ? { throttle: 0, steer: 0, brake: true } : input);
    this.traffic.step(dt, pedestrian, crosswalks);
    for (const [car, { body }] of this.bodies) {
      const { x, z, yaw } = this.traffic.pose(car, 1);
      body.setNextKinematicTranslation({ x, y: 0, z });
      body.setNextKinematicRotation(rotation(yaw));
    }
    this.updateDrivers(dt);
  }

  /** Sweep both moving bodies before Rapier commits their next kinematic poses. */
  pedestrianImpact(player: RAPIER.Collider, playerDelta: Point, dt: number): number {
    let strongest = 0;
    for (const [car, { body, collider }] of this.bodies) {
      if (car.offRoute || car.speed < MIN_TRAFFIC_IMPACT_SPEED) continue;
      const from = body.translation();
      const to = this.traffic.pose(car, 1);
      const delta = { x: to.x - from.x, y: 0, z: to.z - from.z };
      const speed = Math.hypot(delta.x, delta.z) / dt;
      if (speed < MIN_TRAFFIC_IMPACT_SPEED - .001) continue;
      // The controller leaves a .025 m skin around the player capsule.
      const hit = player.castCollider(playerDelta, collider, delta, .045, 1, true);
      if (!hit) continue;
      const closing = ((playerDelta.x - delta.x) * hit.normal1.x +
        (playerDelta.z - delta.z) * hit.normal1.z) / dt;
      if (closing > 2) strongest = Math.max(strongest, car.speed);
    }
    return strongest;
  }

  /** Predict contact along actual player-car motion, never through a wall or another car. */
  npcContacts(npcs: readonly Entity[], dt: number): NpcVehicleContact[] {
    const car = this.seated;
    if (!car) return [];
    const { body, collider } = this.bodies.get(car)!;
    const origin = body.translation();
    const to = this.traffic.pose(car, 1);
    const velocity = { x: (to.x - origin.x) / dt, y: 0, z: (to.z - origin.z) / dt };
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < PEDESTRIAN_IMPACT_MIN) return [];
    const limit = car.braking && car.speed === 0 ? dt : DODGE_LOOKAHEAD;
    const contacts: NpcVehicleContact[] = [];
    for (const npc of npcs) {
      const dx = npc.position.x - origin.x, dz = npc.position.z - origin.z;
      if (!npc.enabled || dx * velocity.x + dz * velocity.z < 0 ||
        Math.hypot(dx, dz) > car.spawn.model.length / 2 + speed * limit + 1) continue;
      const position = { ...npc.position, y: npc.position.y + .78 };
      const hit = collider.castShape(velocity, NPC_CAPSULE, position, IDENTITY, { x: 0, y: 0, z: 0 }, .02, limit, true);
      if (hit) {
        const { yaw } = car.offRoute!.previous;
        const normal = hit.normal1;
        const outward = { x: normal.x * Math.cos(yaw) + normal.z * Math.sin(yaw), y: 0,
          z: normal.z * Math.cos(yaw) - normal.x * Math.sin(yaw) };
        contacts.push({ npc, eta: hit.time_of_impact, speed, origin, velocity, outward, halfWidth: car.spawn.model.width / 2 });
      }
    }
    return contacts;
  }

  dispose(): void {
    for (const { body } of this.bodies.values()) this.world.removeRigidBody(body);
    this.bodies.clear();
  }

  private drive(car: TrafficCar, dt: number, input: DriveInput): void {
    const state = car.offRoute!;
    const { pose } = state;
    const { body, sweep, center } = this.bodies.get(car)!;
    const motion = driveMotion(car.speed, car.spawn.model, input, dt);
    const yaw = pose.yaw + motion.turn;
    const origin = { x: pose.x, y: center, z: pose.z };
    // Check the rotated sweep as well as the translation so turning cannot clip a wall.
    const safeYaw = this.world.intersectionWithShape(origin, rotation(yaw), sweep, QUERY, WITHOUT_NPC_BODIES, undefined, body)
      ? pose.yaw : yaw;
    const delta = { x: -Math.sin(safeYaw) * motion.speed * dt, y: 0, z: -Math.cos(safeYaw) * motion.speed * dt };
    const hit = Math.abs(motion.speed) > .001 ? this.world.castShape(origin, rotation(safeYaw), delta, sweep, .025, 1,
      false, QUERY, WITHOUT_NPC_BODIES, undefined, body) : null;
    const fraction = hit?.time_of_impact ?? 1;
    if (hit) {
      const normal = hit.normal1;
      const closingSpeed = -(delta.x * normal.x + delta.z * normal.z) / dt;
      // A held accelerator against a wall only adds a fraction of a meter per second per tick.
      if (closingSpeed >= 1.8) this.events?.emit("vehicle:crashed", { vehicleId: car.spawn.id, speed: closingSpeed });
    }
    state.previous = pose;
    state.pose = { x: pose.x + delta.x * fraction, z: pose.z + delta.z * fraction, yaw: safeYaw, turning: safeYaw !== pose.yaw };
    car.speed = hit ? 0 : motion.speed;
    car.travelled += motion.speed * dt * fraction;
    car.braking = motion.braking || !!hit;
    if (Math.abs(car.speed) > .1) this.exitBlocked = false;
  }

  private updateDrivers(dt: number): void {
    for (const driver of this.fleeing) {
      driver.age += dt;
      const t = Math.min(1, driver.age / .66);
      driver.tumble = t < 1 ? .35 + Math.sin(Math.PI * t) * 1.3 : 0;
      driver.running = t === 1;
      const speed = driver.running ? 6.4 : 2.5;
      const { x, z } = driver.position;
      // Visual escape only; steer along an obstacle instead of running through it.
      const origin = { x, y: .8, z };
      const flags = QUERY | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;
      const blocked = (dx: number, dz: number) =>
        this.world.castRay(new RAPIER.Ray(origin, { x: dx, y: 0, z: dz }), .9, true, flags);
      if (blocked(driver.dx, driver.dz)) {
        for (const [dx, dz] of [[-driver.dz, driver.dx], [driver.dz, -driver.dx], [-driver.dx, -driver.dz]]) {
          if (!blocked(dx, dz)) { driver.dx = dx; driver.dz = dz; break; }
        }
      }
      driver.yaw = Math.atan2(-driver.dx, -driver.dz);
      const clear = !blocked(driver.dx, driver.dz);
      const nx = x + (clear ? driver.dx * speed * dt : 0), nz = z + (clear ? driver.dz * speed * dt : 0);
      const floor = this.world.castRay(new RAPIER.Ray({ x: nx, y: .6, z: nz }, { x: 0, y: -1, z: 0 }),
        .9, true, flags);
      driver.position = { x: nx, y: (floor ? .6 - floor.timeOfImpact : 0) + .53 * (1 - t), z: nz };
    }
    this.fleeing = this.fleeing.filter((driver) => driver.age < 5.5);
  }
}
