import type { Point } from "../entities/EntityManager";

export class MedicinePickup {
  private consumed = false;
  constructor(private readonly definition: { position: Point; hp: number }) {}

  get position(): Point | undefined { return this.consumed ? undefined : this.definition.position; }

  collect(player: Point, restore: (hp: number) => boolean): boolean {
    const position = this.position;
    if (!position || Math.abs(position.y - player.y) > .9 ||
        Math.hypot(position.x - player.x, position.z - player.z) > .75 ||
        !restore(this.definition.hp)) return false;
    this.consumed = true;
    return true;
  }
}
