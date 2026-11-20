import * as THREE from "three";
import type { Point } from "../entities/EntityManager";

type Obstruction = (origin: Point, direction: Point, maxDistance: number) => number | undefined;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(62, 1, .08, 430);
  heading = .23;
  private pitch = .28;
  private target = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private initialized = false;

  look(dx: number, dy: number): void {
    this.heading -= dx * .0028;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .0028, -.12, 1.06);
  }

  update(dt: number, player: Point, focus: Point | undefined, obstruction: Obstruction): void {
    this.target.set(player.x, player.y + 1.48, player.z);
    if (focus) {
      this.target.lerp(new THREE.Vector3(focus.x, focus.y + 1.48, focus.z), .68);
      const towardPlayer = Math.atan2(player.x - focus.x, player.z - focus.z) + .55;
      this.offset.set(Math.sin(towardPlayer) * 3.3, 1.02, Math.cos(towardPlayer) * 3.3);
    } else {
      const radius = 5.3 * Math.cos(this.pitch);
      this.offset.set(radius * Math.sin(this.heading), 5.3 * Math.sin(this.pitch), radius * Math.cos(this.heading));
    }
    this.desired.copy(this.target).add(this.offset);
    if (!this.initialized) {
      this.camera.position.copy(this.desired);
      this.aim.copy(this.target);
      this.initialized = true;
    } else {
      this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * 12));
      this.aim.lerp(this.target, 1 - Math.exp(-dt * 14));
    }
    // Clamp the smoothed result, so a slow transition cannot leave the camera in a wall.
    this.offset.copy(this.camera.position).sub(this.aim);
    const length = this.offset.length();
    if (length > .001) {
      this.offset.divideScalar(length);
      const hit = obstruction(this.aim, this.offset, length);
      if (hit !== undefined) this.camera.position.copy(this.aim).addScaledVector(this.offset, Math.max(.14, hit - .26));
    }
    this.camera.lookAt(this.aim);
  }
}
