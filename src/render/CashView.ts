import * as THREE from "three";
import type { CashDrop } from "../systems/CashSystem";

export class CashView {
  readonly root = new THREE.Group();
  private models = new Map<string, THREE.Group>();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private green = new THREE.MeshBasicMaterial({ color: 0x54c777 });
  private light = new THREE.MeshBasicMaterial({ color: 0xb8f996 });
  private halo = this.makeHalo();

  update(drops: Iterable<CashDrop>, time: number): void {
    const present = new Set<string>();
    for (const { id, position } of drops) {
      present.add(id);
      let model = this.models.get(id);
      if (!model) {
        model = new THREE.Group();
        const glow = new THREE.Sprite(this.halo);
        glow.scale.set(1.6, 1.6, 1);
        model.add(glow);
        for (const [x, y, angle] of [[-.10, -.05, .16], [.10, .02, -.17]]) {
          const bundle = new THREE.Group();
          bundle.position.set(x, y, 0);
          bundle.rotation.y = angle;
          const bills = new THREE.Mesh(this.box, this.green);
          bills.scale.set(.46, .065, .26);
          const band = new THREE.Mesh(this.box, this.light);
          band.scale.set(.10, .071, .275);
          bundle.add(bills, band);
          model.add(bundle);
        }
        this.models.set(id, model);
        this.root.add(model);
      }
      model.position.set(position.x, position.y + .29 + .075 * Math.sin(time * 3.6), position.z);
      model.rotation.y = time * 1.6;
    }
    for (const [id, model] of this.models) {
      if (!present.has(id)) { model.removeFromParent(); this.models.delete(id); }
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    this.models.clear();
    this.box.dispose();
    this.green.dispose();
    this.light.dispose();
    this.halo.map?.dispose();
    this.halo.dispose();
  }

  private makeHalo(): THREE.SpriteMaterial {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "#9aff9866");
    gradient.addColorStop(.46, "#4cff7760");
    gradient.addColorStop(1, "#27e95900");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  }
}
