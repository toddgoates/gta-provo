import type { Entity, EntityManager, Point } from "../entities/EntityManager";
import type { DriverProfile } from "../entities/Appearance";
import type { RoadPose } from "./TrafficRoute";

type Waypoint = readonly [x: number, z: number];
export interface PedestrianGroupDefinition {
  id: string;
  count: number;
  path: readonly Waypoint[];
  crossings?: readonly number[]; // Segment indices in the forward direction.
}
export interface Crosswalk { from: Point; to: Point }
export interface CrossingTraffic extends RoadPose { speed: number; length: number; width: number }

export interface Pedestrian {
  entity: Entity;
  previous: Point;
  speed: number;
  phase: number;
}
interface Group {
  definition: PedestrianGroupDefinition;
  walkers: Pedestrian[];
  from: number;
  direction: number;
  t: number;
  wait: number;
  speed: number;
  crossing?: Crosswalk;
}

const CURB = .15;
const STREET = -.01;
const point = ([x, z]: Waypoint): Point => ({ x, y: CURB, z });

export function crossingIsClear({ from, to }: Crosswalk, traffic: readonly CrossingTraffic[]): boolean {
  const acrossX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
  const band = acrossX ? from.z : from.x;
  const min = Math.min(acrossX ? from.x : from.z, acrossX ? to.x : to.z);
  const max = Math.max(acrossX ? from.x : from.z, acrossX ? to.x : to.z);
  return !traffic.some((car) => {
    const along = acrossX ? car.x : car.z;
    const axis = acrossX ? car.z : car.x;
    const motion = -(acrossX ? Math.cos(car.yaw) : Math.sin(car.yaw)) * car.speed;
    if (along < min - car.length / 2 || along > max + car.length / 2) return false;
    const angle = acrossX ? Math.abs(Math.cos(car.yaw)) : Math.abs(Math.sin(car.yaw));
    const reach = angle * car.length / 2 + Math.sqrt(1 - angle ** 2) * car.width / 2;
    const distance = Math.abs(axis - band) - reach;
    return distance < 1.65 || ((band - axis) * motion > 0 && distance < 1.65 + Math.abs(motion) * 2.3);
  });
}

export class PedestrianSystem {
  readonly walkers: readonly Pedestrian[];
  private groups: Group[];
  private crossingWalkers = new Set<string>();

  isCrossing(id: string): boolean { return this.crossingWalkers.has(id); }

  constructor(
    entities: EntityManager,
    definitions: readonly PedestrianGroupDefinition[],
    createProfile: (index: number) => DriverProfile,
    private readonly random: () => number = Math.random,
  ) {
    let index = 0;
    this.groups = definitions.map((definition) => {
      const origin = point(definition.path[0]);
      const walkers = Array.from({ length: definition.count }, (_, member) => {
        const { appearance } = createProfile(index++);
        const position = { ...origin, x: origin.x + (member % 2 ? .68 : 0), z: origin.z + (member === 2 ? 1 : 0) };
        const entity = entities.spawn(`ped-${definition.id}-${member}`, {
          id: "pedestrian", name: "Pedestrian", kind: "npc", modelId: "pedestrian-proxy", appearance,
        }, position, definition.path.length === 1 ? member * 2.1 : 0);
        return { entity, previous: entity.position, speed: 0, phase: this.random() * Math.PI * 2 };
      });
      return { definition, walkers, from: 0, direction: 1, t: 0, wait: this.random() * 2, speed: 1.55 + this.random() * .45 };
    });
    this.walkers = this.groups.flatMap(({ walkers }) => walkers);
  }

  step(dt: number, traffic: readonly CrossingTraffic[], reacting: (id: string) => boolean = () => false): Crosswalk[] {
    const crossings: Crosswalk[] = [];
    this.crossingWalkers.clear();
    for (const group of this.groups) {
      const { path, crossings: marked } = group.definition;
      for (const walker of group.walkers) { walker.previous = walker.entity.position; walker.speed = 0; }
      if (path.length < 2) continue;
      if (group.wait > 0) { group.wait -= dt; continue; }
      const next = group.from + group.direction;
      const from = point(path[group.from]), to = point(path[next]);
      const dx = to.x - from.x, dz = to.z - from.z;
      const length = Math.hypot(dx, dz);
      const crosswalk = marked?.includes(Math.min(group.from, next)) ? { from, to } : undefined;
      if (crosswalk && !group.crossing) {
        if (!crossingIsClear(crosswalk, traffic)) continue;
        group.crossing = crosswalk;
      }
      const speed = crosswalk ? 2.45 : group.speed;
      if (group.crossing) crossings.push(group.crossing);
      group.t = Math.min(1, group.t + speed * dt / length);
      const yaw = Math.atan2(-dx, -dz);
      const baseX = from.x + dx * group.t, baseZ = from.z + dz * group.t;
      group.walkers.forEach((walker, i) => {
        if (reacting(walker.entity.id)) return;
        if (crosswalk) this.crossingWalkers.add(walker.entity.id);
        // World-aligned crossing offsets keep both directions inside the marked strip.
        const spacing = group.walkers.length === 1 ? 0 : (i % 2 ? .45 : -.45);
        const along = i === 2 ? .83 : 0;
        const x = baseX + dz / length * spacing - Math.abs(dx / length) * along;
        const z = baseZ - dx / length * spacing - Math.abs(dz / length) * along;
        const y = Math.abs(x) > 9.2 && Math.abs(z) > 9.2 ? CURB : STREET;
        walker.entity.position = { x, y, z };
        walker.entity.yaw = yaw;
        walker.speed = speed;
      });
      if (group.t === 1) {
        group.from = next;
        group.t = 0;
        group.crossing = undefined;
        if (next === 0 || next === path.length - 1) {
          group.direction *= -1;
          group.wait = 1.2 + this.random() * 2.7;
        } else if (!crosswalk && !marked?.includes(Math.min(next, next + group.direction)) && this.random() < .36) {
          group.wait = .7 + this.random() * 2;
        }
      }
    }
    return crossings;
  }
}
