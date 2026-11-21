import type { Entity, Point } from "../entities/EntityManager";
import type { CrimeIncident } from "../core/EventBus";
import { PEDESTRIAN_FATAL_SPEED } from "./VehicleSystem";
import type { NpcVehicleContact } from "./VehicleSystem";
import { launchImpact, stepImpact } from "./ImpactMotion";
import type { ImpactMotion } from "./ImpactMotion";

export const meleeMoves = [
  { duration: .39, impact: .17, reach: 1.36, damage: 9 },
  { duration: .46, impact: .23, reach: 1.45, damage: 12 },
  { duration: .61, impact: .32, reach: 1.65, damage: 16 },
] as const;

export const MAX_PEDESTRIAN_HEALTH = 60;
const FALL_DURATION = .55;
const GET_UP_TIME = 1.35;
const DODGE_TIME = .3;

export interface MeleePose { move: number; progress: number; flinch: number }
interface Swing { move: number; elapsed: number }
interface Fighter {
  health: number;
  fallElapsed: number;
  swing?: Swing;
  response: "flee" | "fight";
  time: number;
  stun: number;
  cooldown: number;
  nextMove: number;
  speed: number;
  tumble?: number;
  dodge?: { from: Point; to: Point; elapsed: number };
  vehiclePanic?: boolean;
  launch?: ImpactMotion;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const direction = (a: Point, b: Point) => Math.atan2(a.x - b.x, a.z - b.z);
const onSidewalk = ({ x, z }: Point) => Math.abs(x) > 9.2 && Math.abs(z) > 9.2;
type ClearPath = (from: Point, to: Point) => boolean;
export interface OfficerOrder { destination: Point; attack: boolean }

export class MeleeSystem {
  private swing?: Swing;
  private queued = 0;
  private queuedFor = 0;
  private nextMove = 0;
  private flinch = 0;
  private fighters = new Map<string, Fighter>();
  private impactId = 0;

  constructor(
    private readonly player: Entity,
    private readonly pedestrians: readonly Entity[] | (() => readonly Entity[]),
    private readonly clearPath: ClearPath,
    private readonly random: () => number = Math.random,
    private readonly reportHit: (hit: CrimeIncident & { knockedOut: boolean; source?: "vehicle" }) => void = () => {},
    private readonly floorAt: (point: Point) => number = (point) => onSidewalk(point) ? .15 : -.01,
    private readonly reportPlayerStrike: (landed: boolean) => void = () => {},
  ) {}

  get attacking(): boolean { return !!this.swing; }
  hasReactor(id: string): boolean { return this.fighters.has(id); }
  reactionSpeed(id: string): number { return this.fighters.get(id)?.speed ?? 0; }
  healthOf(id: string): number { return this.fighters.get(id)?.health ?? MAX_PEDESTRIAN_HEALTH; }
  forget(id: string): void { this.fighters.delete(id); }
  isDown(id: string): boolean { return this.impactPose(id) !== undefined || this.fallProgress(id) !== undefined; }
  impactPose(id: string): ImpactMotion | undefined { return this.fighters.get(id)?.launch; }

  dodgeProgress(id: string): number {
    const dodge = this.fighters.get(id)?.dodge;
    return dodge ? dodge.elapsed / DODGE_TIME : 0;
  }

  fallProgress(id: string): number | undefined {
    const fighter = this.fighters.get(id);
    if (fighter?.launch) return;
    if (fighter?.health === 0) return fighter.fallElapsed / FALL_DURATION;
    if (fighter?.tumble !== undefined) {
      return Math.min(1, fighter.tumble / .36, (GET_UP_TIME - fighter.tumble) / .42);
    }
  }

  reactToVehicle({ npc, eta, speed, origin, velocity, halfWidth, outward }: NpcVehicleContact, dt: number): void {
    if (this.isDown(npc.id)) return;
    let fighter = this.fighters.get(npc.id);
    if (eta <= dt) {
      const damage = speed >= PEDESTRIAN_FATAL_SPEED ? MAX_PEDESTRIAN_HEALTH : Math.min(15, this.healthOf(npc.id) - 1);
      this.hit(npc, damage, "vehicle");
      const impacted = this.fighters.get(npc.id)!;
      impacted.dodge = undefined;
      impacted.launch = launchImpact(speed, velocity, outward);
      npc.yaw = Math.atan2(impacted.launch.velocity.x, impacted.launch.velocity.z);
      return;
    }
    // Only attempt a dodge when there's time to clear the projected bumper and room to land.
    if (eta < .37 || fighter?.dodge || fighter?.vehiclePanic) return;
    const from = npc.position;
    const side = { x: -velocity.z / speed, z: velocity.x / speed };
    const offset = (from.x - origin.x) * side.x + (from.z - origin.z) * side.z;
    const preferred = offset >= 0 ? 1 : -1;
    for (const sign of [preferred, -preferred]) {
      const shift = sign * (halfWidth + .68) - offset;
      if (Math.abs(shift) > 2.25) continue;
      const to = { ...from, x: from.x + side.x * shift, z: from.z + side.z * shift };
      const clearance = { ...to, x: to.x + side.x * sign * .3, z: to.z + side.z * sign * .3 };
      if (!this.clearPath(from, clearance)) continue;
      to.y = onSidewalk(to) ? .15 : -.01;
      fighter ??= this.makeFighter("flee");
      fighter.dodge = { from, to, elapsed: 0 };
      fighter.swing = undefined;
      fighter.vehiclePanic = true;
      fighter.time = 2.5;
      this.fighters.set(npc.id, fighter);
      npc.yaw = direction(from, to);
      break;
    }
  }

  getPose(id: string): MeleePose | undefined {
    const fighter = this.fighters.get(id);
    if (id !== this.player.id && !fighter) return;
    const swing = id === this.player.id ? this.swing : fighter?.swing;
    const flinch = id === this.player.id ? this.flinch : fighter?.stun ?? 0;
    if (!swing && flinch <= 0) return;
    return { move: swing?.move ?? -1, progress: swing ? swing.elapsed / meleeMoves[swing.move].duration : 0,
      flinch: Math.min(1, flinch / .28) };
  }

  playerHit(): void { this.flinch = .28; }

  step(dt: number, pressed: boolean, canFight: boolean, canTarget: (id: string) => boolean = () => true,
    orders: ReadonlyMap<string, OfficerOrder> = new Map()): number {
    const pedestrians = typeof this.pedestrians === "function" ? this.pedestrians() : this.pedestrians;
    this.flinch = Math.max(0, this.flinch - dt);
    if (!canFight) { this.swing = undefined; this.queued = 0; this.queuedFor = 0; }
    if (pressed && canFight) {
      if (this.swing) this.queued = Math.min(2, this.queued + 1);
      else if (this.queuedFor > 0) { this.swing = { move: this.nextMove, elapsed: 0 }; this.queuedFor = 0; }
      else this.swing = { move: 0, elapsed: 0 };
    }
    if (this.swing) {
      const swing = this.swing;
      const move = meleeMoves[swing.move];
      if (this.advanceSwing(swing, dt)) {
        const target = pedestrians.filter((npc) =>
          !this.isDown(npc.id) && canTarget(npc.id) && this.inReach(this.player, npc, swing.move))
          .sort((a, b) => distance(this.player.position, a.position) - distance(this.player.position, b.position))[0];
        if (target) this.hit(target, move.damage);
        this.reportPlayerStrike(!!target);
      }
      if (swing.elapsed >= move.duration) {
        this.swing = this.queued ? { move: (swing.move + 1) % meleeMoves.length, elapsed: 0 } : undefined;
        this.queued = Math.max(0, this.queued - 1);
        if (!this.swing) {
          this.queuedFor = .24;
          this.nextMove = (swing.move + 1) % meleeMoves.length;
        }
      }
    } else this.queuedFor = Math.max(0, this.queuedFor - dt);

    let damage = 0;
    for (const npc of pedestrians) {
      const order = orders.get(npc.id);
      let fighter = this.fighters.get(npc.id);
      if (order && !fighter) {
        fighter = this.makeFighter("fight");
        this.fighters.set(npc.id, fighter);
      }
      if (!fighter) continue;
      fighter.speed = 0;
      if (fighter.launch) {
        const { position, settled } = stepImpact(fighter.launch, npc.position, dt, this.clearPath, this.floorAt);
        npc.position = position;
        if (settled) {
          fighter.launch = undefined;
          if (fighter.health === 0) fighter.fallElapsed = FALL_DURATION;
          else fighter.tumble = .36;
        }
        continue;
      }
      if (fighter.health === 0) {
        fighter.fallElapsed = Math.min(FALL_DURATION, fighter.fallElapsed + dt);
        continue;
      }
      if (fighter.tumble !== undefined) {
        fighter.tumble += dt;
        if (fighter.tumble >= GET_UP_TIME) fighter.tumble = undefined;
        continue;
      }
      if (fighter.dodge) {
        const { from, to } = fighter.dodge;
        fighter.dodge.elapsed = Math.min(DODGE_TIME, fighter.dodge.elapsed + dt);
        const t = fighter.dodge.elapsed / DODGE_TIME;
        npc.position = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
        if (t === 1) fighter.dodge = undefined;
        continue;
      }
      fighter.stun = Math.max(0, fighter.stun - dt);
      fighter.cooldown = Math.max(0, fighter.cooldown - dt);
      fighter.time = Math.max(0, fighter.time - dt);
      if (fighter.stun > 0) continue;
      if (fighter.vehiclePanic) {
        if (fighter.time > 0) {
          this.flee(npc, fighter, dt, true);
          continue;
        }
        fighter.vehiclePanic = false;
      }
      if (npc.definition.faction === "police" && !order) {
        fighter.swing = undefined;
        continue;
      }
      if (order && (!order.attack || !canFight || (!fighter.swing && distance(npc.position, this.player.position) > 1.35))) {
        fighter.swing = undefined;
        if (distance(npc.position, order.destination) > .55) {
          fighter.speed = this.move(npc, direction(npc.position, order.destination), order.attack ? 4.9 : 3.5, dt, true);
        }
        continue;
      }
      if (fighter.response === "fight" && canFight) {
        if (fighter.swing) {
          if (this.advanceSwing(fighter.swing, dt) && this.inReach(npc, this.player, fighter.swing.move)) {
            damage = Math.max(damage, meleeMoves[fighter.swing.move].damage);
          }
          if (fighter.swing.elapsed >= meleeMoves[fighter.swing.move].duration) {
            fighter.swing = undefined;
            fighter.cooldown = .32 + this.random() * .5;
          }
        } else {
          const move = fighter.nextMove;
          npc.yaw = direction(npc.position, this.player.position);
          if (this.inReach(npc, this.player, move)) {
            if (!fighter.cooldown) {
              fighter.swing = { move, elapsed: 0 };
              fighter.nextMove = (move + 1) % meleeMoves.length;
            }
          } else if (distance(npc.position, this.player.position) > 1.05) {
            fighter.speed = this.move(npc, npc.yaw, 2.65, dt);
          }
        }
      } else {
        fighter.swing = undefined;
        if (fighter.response === "flee" && fighter.time > 0) {
          this.flee(npc, fighter, dt);
        }
      }
    }
    return damage;
  }

  private advanceSwing(swing: Swing, dt: number): boolean {
    const impact = meleeMoves[swing.move].impact;
    const before = swing.elapsed;
    swing.elapsed += dt;
    return before < impact && swing.elapsed >= impact;
  }

  private inReach(from: Entity, to: Entity, move: number): boolean {
    if (!to.enabled || Math.abs(from.position.y - to.position.y) > .7 ||
        distance(from.position, to.position) > meleeMoves[move].reach) return false;
    return Math.cos(direction(from.position, to.position) - from.yaw) > .35 && this.clearPath(from.position, to.position);
  }

  private hit(target: Entity, damage: number, source?: "vehicle"): void {
    let fighter = this.fighters.get(target.id);
    if (!fighter) {
      const response = target.definition.faction !== "police" && this.random() < .5 ? "flee" : "fight";
      fighter = this.makeFighter(response);
      this.fighters.set(target.id, fighter);
    }
    fighter.health = Math.max(0, fighter.health - damage);
    fighter.swing = undefined;
    this.reportHit({ id: `strike-${++this.impactId}`, offenderId: this.player.id, victimId: target.id,
      position: target.position, knockedOut: fighter.health === 0, source });
    if (fighter.health > 0) {
      if (source === "vehicle") {
        fighter.tumble = 0;
        fighter.dodge = undefined;
        fighter.vehiclePanic = true;
        fighter.time = 4;
        fighter.stun = 0;
      } else {
        fighter.stun = .3;
        if (fighter.response === "flee") fighter.time = 4;
        return;
      }
    }
    fighter.stun = 0;
    const from = target.position;
    // Prefer falling away from the strike, but turn the fall if there's a wall behind the NPC.
    const faceAttacker = direction(from, this.player.position);
    for (const offset of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const yaw = faceAttacker + offset;
      if (this.clearPath(from, { x: from.x + Math.sin(yaw) * 1.55, y: from.y, z: from.z + Math.cos(yaw) * 1.55 })) {
        target.yaw = yaw;
        break;
      }
    }
  }

  private flee(npc: Entity, fighter: Fighter, dt: number, fromVehicle = false): void {
    const away = direction(this.player.position, npc.position);
    for (const offset of [0, .75, -.75, Math.PI / 2, -Math.PI / 2]) {
      fighter.speed = this.move(npc, away + offset, 5.3, dt, fromVehicle && !onSidewalk(npc.position));
      if (fighter.speed) break;
    }
  }

  private makeFighter(response: Fighter["response"]): Fighter {
    return { health: MAX_PEDESTRIAN_HEALTH, fallElapsed: 0, response, time: 0,
      stun: 0, cooldown: .6, nextMove: 0, speed: 0 };
  }

  private move(entity: Entity, yaw: number, speed: number, dt: number, crossRoad = false): number {
    const from = entity.position;
    const ahead = (step: number): Point => ({ x: from.x - Math.sin(yaw) * step, y: from.y, z: from.z - Math.cos(yaw) * step });
    const to = ahead(speed * dt);
    if ((onSidewalk(from) && !onSidewalk(to) && !crossRoad) || !this.clearPath(from, ahead(Math.max(.45, speed * dt)))) return 0;
    to.y = onSidewalk(to) ? .15 : -.01;
    entity.position = to;
    entity.yaw = yaw;
    return speed;
  }
}
