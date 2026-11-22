import type { Entity, Point } from "../entities/EntityManager";
import { policeConfig } from "../content/police";
import type { DetectedCrime } from "./CrimeSystem";
import type { OfficerOrder } from "./MeleeSystem";
import type { WantedLevelSystem } from "./WantedLevelSystem";

type Phase = "investigate" | "pursue" | "search" | "standby" | "return";
interface Response {
  officer: Entity;
  anchor: Point;
  phase: Phase;
  lastKnown: Point;
  remaining: number;
  repath: number;
  waypoint?: Point;
}
interface PoliceWorld {
  officers: () => readonly Entity[];
  active: (id: string) => boolean;
  clearSight: (a: Point, b: Point) => boolean;
  clearRoute: (a: Point, b: Point) => boolean;
  searchHint?: (lastSeen: Point) => Point | undefined;
  isOnScreen: (point: Point) => boolean;
  canSpawnAt: (point: Point) => boolean;
  spawn: (at: Point) => Entity;
  remove: (id: string) => void;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class PoliceResponseSystem {
  private active = new Map<string, Response>();
  private reserves = new Map<string, Entity>();
  private incident?: DetectedCrime;
  private cooldown = 0;
  private graph?: number[][];
  visible = false;

  constructor(private readonly wanted: WantedLevelSystem, private readonly world: PoliceWorld,
    private readonly spawnPoints: readonly Point[], private readonly navigationPoints: readonly Point[] = spawnPoints) {}

  get count(): number {
    return [...this.active.values()].filter(({ phase, officer }) => phase !== "return" && this.world.active(officer.id)).length;
  }
  controls(id: string): boolean { return this.active.has(id); }

  investigate(crime: DetectedCrime): void {
    this.incident = crime;
    for (const response of this.active.values()) {
      if (response.phase === "return" || response.phase === "pursue") continue;
      response.phase = "investigate";
      response.lastKnown = crime.position;
      response.remaining = policeConfig.investigateSeconds;
      response.repath = 0;
    }
  }

  step(dt: number, player: Point, approachVehicle?: (officer: Point) => Point | undefined): ReadonlyMap<string, OfficerOrder> {
    const orders = new Map<string, OfficerOrder>();
    const officers = this.world.officers().filter(({ id, enabled }) => enabled && this.world.active(id));
    const seeing = new Set(this.wanted.level ? officers.filter(({ position }) =>
      distance(position, player) <= policeConfig.sightRadius && this.world.clearSight(position, player)).map(({ id }) => id) : []);
    this.visible = seeing.size > 0;
    this.wanted.step(dt, this.visible);
    this.cooldown = Math.max(0, this.cooldown - dt);

    for (const [id, response] of this.active) {
      if (!this.world.active(id)) this.active.delete(id);
      else if (response.phase === "return" && !this.reserves.has(id) &&
        distance(response.officer.position, response.anchor) < .65) this.active.delete(id);
    }
    for (const [id, officer] of this.reserves) {
      const response = this.active.get(id);
      if ((!response || response.phase === "return") && !this.world.isOnScreen(officer.position) &&
        distance(officer.position, player) >= policeConfig.spawnMinDistance) this.remove(id);
    }

    const target = Math.min(policeConfig.maxResponders, policeConfig.response[this.wanted.level]);
    const direct = this.incident?.kind === "police:assaulted" || this.incident?.kind === "police:vehicle_hit"
      ? officers.find(({ id }) => id === this.incident?.victimId) : undefined;
    if (target && direct && (!this.active.has(direct.id) || this.active.get(direct.id)?.phase === "return")) {
      this.recruit(direct, player);
    }
    const responding = [...this.active.values()].filter(({ phase }) => phase !== "return");
    responding.sort((a, b) => Number(b.officer === direct) - Number(a.officer === direct) ||
      Number(seeing.has(b.officer.id)) - Number(seeing.has(a.officer.id)) ||
      distance(a.officer.position, player) - distance(b.officer.position, player));
    for (const response of responding.slice(target)) {
      response.phase = "return";
      response.repath = 0;
    }
    if (!target) this.incident = undefined;

    if (this.count < target) {
      const available = officers.filter((officer) => officer.enabled &&
        (!this.active.has(officer.id) || this.active.get(officer.id)?.phase === "return") &&
        distance(officer.position, player) <= policeConfig.recruitRadius);
      available.sort((a, b) => Number(seeing.has(b.id)) - Number(seeing.has(a.id)) ||
        distance(a.position, this.incident?.position ?? player) - distance(b.position, this.incident?.position ?? player));
      for (const officer of available) {
        if (this.count >= target) break;
        this.recruit(officer, player);
      }
      if (this.count < target && this.cooldown === 0 && this.reserves.size < policeConfig.maxReinforcements) {
        const origin = this.spawnPoints.filter((point) => distance(point, player) >= policeConfig.spawnMinDistance &&
          distance(point, player) <= policeConfig.spawnMaxDistance && !this.world.isOnScreen(point) &&
          this.world.canSpawnAt(point) && officers.every(({ position }) => distance(position, point) > 3))
          .sort((a, b) => distance(a, this.incident?.position ?? player) - distance(b, this.incident?.position ?? player))[0];
        if (origin) {
          const officer = this.world.spawn(origin);
          this.reserves.set(officer.id, officer);
          this.recruit(officer, player);
          this.cooldown = policeConfig.spawnCooldown;
        } else this.cooldown = 1;
      }
    }

    const crowd = [...this.active.values()];
    crowd.forEach((response, index) => {
      const { officer } = response;
      const before = response.phase;
      if (before !== "return") {
        if (seeing.has(officer.id)) {
          response.phase = "pursue";
          response.lastKnown = { ...player };
          response.remaining = policeConfig.searchSeconds;
        } else if (before === "pursue" || before === "investigate" && distance(officer.position, response.lastKnown) < 1.1) {
          const hint = this.world.searchHint?.(response.lastKnown);
          if (hint) {
            response.lastKnown = hint;
            response.remaining = Math.max(response.remaining, policeConfig.searchSeconds + 4);
            response.repath = 0;
          }
          response.phase = "search";
        }
        else if (before === "search" || before === "investigate" && distance(officer.position, response.lastKnown) < 1.5) {
          response.remaining -= dt;
          if (distance(officer.position, response.lastKnown) < 1.15) officer.yaw += dt * .95;
          if (response.remaining <= 0) response.phase = "standby";
        }
      }
      const attack = response.phase === "pursue";
      let goal = response.phase === "return" ? response.anchor : response.lastKnown;
      if (response.phase === "standby") goal = officer.position;
      if (attack && approachVehicle) {
        goal = approachVehicle(officer.position) ?? goal;
      } else if (attack && distance(officer.position, player) < 4.5 && crowd.length > 1) {
        const angle = index * 2.4;
        const flank = { x: player.x + Math.cos(angle) * .92, y: player.y, z: player.z + Math.sin(angle) * .92 };
        if (this.world.clearRoute(officer.position, flank)) goal = flank;
      }
      response.repath -= dt;
      if (this.world.clearRoute(officer.position, goal)) response.waypoint = goal;
      else if (response.repath <= 0 || before !== response.phase) {
        response.waypoint = this.route(officer.position, goal);
        response.repath = policeConfig.repathSeconds;
      }
      orders.set(officer.id, { destination: response.waypoint ?? officer.position, attack });
    });
    return orders;
  }

  reset(): void {
    for (const id of this.reserves.keys()) this.remove(id);
    this.active.clear();
    this.visible = false;
    this.incident = undefined;
    this.cooldown = 0;
    this.wanted.reset();
  }

  private recruit(officer: Entity, player: Point): void {
    const anchor = this.active.get(officer.id)?.anchor ?? officer.position;
    this.active.set(officer.id, { officer, anchor, phase: "investigate",
      lastKnown: this.incident?.position ?? { ...player }, remaining: policeConfig.investigateSeconds, repath: 0 });
  }

  private remove(id: string): void {
    this.active.delete(id);
    this.reserves.delete(id);
    this.world.remove(id);
  }

  private route(start: Point, goal: Point): Point {
    const points = this.navigationPoints;
    this.graph ??= points.map((a, i) => points.flatMap((b, j) => i !== j && this.world.clearRoute(a, b) ? [j] : []));
    const cost = points.map((point) => this.world.clearRoute(start, point) ? distance(start, point) : Infinity);
    const first = points.map((_, i) => i);
    const visited = new Set<number>();
    let best = Infinity;
    let waypoint = start;
    while (visited.size < points.length) {
      let i = -1;
      for (let j = 0; j < points.length; j++) if (!visited.has(j) && cost[j] < (i < 0 ? Infinity : cost[i])) i = j;
      if (i < 0 || cost[i] >= best) break;
      visited.add(i);
      const candidate = cost[i] + distance(points[i], goal);
      if (candidate < best && this.world.clearRoute(points[i], goal)) {
        best = candidate;
        waypoint = points[first[i]];
      }
      for (const j of this.graph[i]) {
        const next = cost[i] + distance(points[i], points[j]);
        if (next < cost[j]) { cost[j] = next; first[j] = first[i]; }
      }
    }
    return waypoint;
  }
}
