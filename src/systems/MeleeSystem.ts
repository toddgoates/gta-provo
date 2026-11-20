import type { Entity, Point } from "../entities/EntityManager";

export const meleeMoves = [
  { duration: .39, impact: .17, reach: 1.36, damage: 9 },
  { duration: .46, impact: .23, reach: 1.45, damage: 12 },
  { duration: .61, impact: .32, reach: 1.65, damage: 16 },
] as const;

export interface MeleePose { move: number; progress: number; flinch: number }
interface Swing { move: number; elapsed: number }
interface Fighter {
  swing?: Swing;
  response: "flee" | "fight";
  time: number;
  stun: number;
  cooldown: number;
  nextMove: number;
  speed: number;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const direction = (a: Point, b: Point) => Math.atan2(a.x - b.x, a.z - b.z);
const onSidewalk = ({ x, z }: Point) => Math.abs(x) > 9.2 && Math.abs(z) > 9.2;
type ClearPath = (from: Point, to: Point) => boolean;

export class MeleeSystem {
  private swing?: Swing;
  private queued = 0;
  private queuedFor = 0;
  private nextMove = 0;
  private flinch = 0;
  private fighters = new Map<string, Fighter>();

  constructor(
    private readonly player: Entity,
    private readonly pedestrians: readonly Entity[],
    private readonly clearPath: ClearPath,
    private readonly random: () => number = Math.random,
  ) {}

  get attacking(): boolean { return !!this.swing; }
  hasReactor(id: string): boolean { return this.fighters.has(id); }
  reactionSpeed(id: string): number { return this.fighters.get(id)?.speed ?? 0; }

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

  step(dt: number, pressed: boolean, canFight: boolean, canTarget: (id: string) => boolean = () => true): number {
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
        const target = this.pedestrians.filter((npc) => canTarget(npc.id) && this.inReach(this.player, npc, swing.move))
          .sort((a, b) => distance(this.player.position, a.position) - distance(this.player.position, b.position))[0];
        if (target) this.react(target.id);
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
    for (const npc of this.pedestrians) {
      const fighter = this.fighters.get(npc.id);
      if (!fighter) continue;
      fighter.speed = 0;
      fighter.stun = Math.max(0, fighter.stun - dt);
      fighter.cooldown = Math.max(0, fighter.cooldown - dt);
      fighter.time = Math.max(0, fighter.time - dt);
      if (fighter.stun > 0) continue;
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
          const away = direction(this.player.position, npc.position);
          for (const offset of [0, .75, -.75, 1.5, -1.5]) {
            fighter.speed = this.move(npc, away + offset, 5.3, dt);
            if (fighter.speed) break;
          }
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

  private react(id: string): void {
    const fighter = this.fighters.get(id);
    if (fighter) {
      fighter.stun = .28;
      fighter.swing = undefined;
      if (fighter.response === "flee") fighter.time = 4;
    } else {
      const response = this.random() < .5 ? "flee" : "fight";
      this.fighters.set(id, { response, time: response === "flee" ? 4 : 0,
        stun: .32, cooldown: .6, nextMove: 0, speed: 0 });
    }
  }

  private move(entity: Entity, yaw: number, speed: number, dt: number): number {
    const from = entity.position;
    const ahead = (step: number): Point => ({ x: from.x - Math.sin(yaw) * step, y: from.y, z: from.z - Math.cos(yaw) * step });
    const to = ahead(speed * dt);
    if ((onSidewalk(from) && !onSidewalk(to)) || !this.clearPath(from, ahead(Math.max(.45, speed * dt)))) return 0;
    to.y = onSidewalk(to) ? .15 : -.01;
    entity.position = to;
    entity.yaw = yaw;
    return speed;
  }
}
