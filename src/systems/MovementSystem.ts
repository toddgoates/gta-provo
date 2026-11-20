import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity, Point } from "../entities/EntityManager";

const HALF_SEGMENT = .48;
const RADIUS = .32;
const CENTER = HALF_SEGMENT + RADIUS;
export interface WalkInput { forward: number; strafe: number; sprint: boolean; jump: boolean; heading: number }

export class MovementSystem {
  readonly collider: RAPIER.Collider;
  private body: RAPIER.RigidBody;
  private controller: RAPIER.KinematicCharacterController;
  private vertical = 0;
  private grounded = false;
  previous: Point;
  speed = 0;

  constructor(private readonly world: RAPIER.World, readonly player: Entity) {
    const { x, y, z } = player.position;
    this.previous = { x, y, z };
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CENTER, z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_SEGMENT, RADIUS), this.body);
    this.controller = world.createCharacterController(.025);
    this.controller.enableAutostep(.24, .18, false);
    this.controller.enableSnapToGround(.27);
  }

  prepare(dt: number, { forward, strafe, sprint, jump, heading }: WalkInput): Point {
    const magnitude = Math.max(1, Math.hypot(forward, strafe));
    const speed = (sprint ? 8.4 : 4.65) / magnitude;
    const dx = (strafe * Math.cos(heading) - forward * Math.sin(heading)) * speed;
    const dz = (-strafe * Math.sin(heading) - forward * Math.cos(heading)) * speed;
    if (forward || strafe) this.player.yaw = Math.atan2(-dx, -dz);
    this.vertical = jump && this.grounded ? 6.6 : Math.max(-36, this.vertical - 19 * dt);
    this.controller.computeColliderMovement(this.collider, { x: dx * dt, y: this.vertical * dt, z: dz * dt },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const delta = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if ((this.grounded && this.vertical < 0) || (this.vertical > 0 && delta.y < this.vertical * dt * .6)) {
      this.vertical = 0;
    }
    const pos = this.body.translation();
    this.body.setNextKinematicTranslation({ x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z + delta.z });
    return delta;
  }

  commit(dt: number): void {
    const { x, y, z } = this.body.translation();
    this.previous = this.player.position;
    this.player.position = { x, y: y - CENTER, z };
    this.speed = Math.hypot(x - this.previous.x, z - this.previous.z) / dt;
  }

  board(): void {
    this.collider.setEnabled(false);
    this.speed = 0;
  }

  disembark(position: Point, yaw: number): void {
    const center = { ...position, y: position.y + CENTER };
    this.body.setTranslation(center, true);
    this.body.setNextKinematicTranslation(center);
    this.collider.setEnabled(true);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.player.position = position;
    this.player.yaw = yaw;
    this.previous = position;
    this.vertical = 0;
    this.grounded = false;
  }

  dispose(): void {
    this.world.removeCharacterController(this.controller);
    this.world.removeRigidBody(this.body);
  }
}
