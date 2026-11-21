import RAPIER from "@dimforge/rapier3d-compat";
import type { Point } from "../entities/EntityManager";

// Reserve one Rapier group for humanoid blockers. Camera, sight, and drive casts ignore it.
const NPC_GROUP = 0x8000ffff;
export const WITHOUT_NPC_BODIES = 0xffff7fff;
const HALF_SEGMENT = .48;
const RADIUS = .30;

interface StandingNpc { id: string; position: Point }

export class NpcColliders {
  private bodies = new Map<string, RAPIER.RigidBody>();

  constructor(private readonly world: RAPIER.World) {}

  sync(npcs: Iterable<StandingNpc>): void {
    const present = new Set<string>();
    for (const { id, position } of npcs) {
      present.add(id);
      const center = { ...position, y: position.y + HALF_SEGMENT + RADIUS };
      const body = this.bodies.get(id);
      if (body) {
        body.setNextKinematicTranslation(center);
      } else {
        const created = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z),
        );
        this.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_SEGMENT, RADIUS).setCollisionGroups(NPC_GROUP), created);
        this.bodies.set(id, created);
      }
    }
    for (const [id, body] of this.bodies) {
      if (present.has(id)) continue;
      this.world.removeRigidBody(body);
      this.bodies.delete(id);
    }
  }

  dispose(): void { this.sync([]); }
}
