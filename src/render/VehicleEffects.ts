import * as THREE from "three";
import { FIRE_DAMAGE, SMOKE_DAMAGE } from "../systems/VehicleDamage";

export class VehicleEffects {
  readonly group = new THREE.Group();
  private smoke: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private burst: THREE.Mesh[] = [];
  private wreck = new THREE.Group();

  constructor(length: number, width: number) {
    const particle = new THREE.IcosahedronGeometry(1, 0);
    const rock = new THREE.MeshLambertMaterial({ color: 0x292b2d, flatShading: true });
    const soot = new THREE.MeshLambertMaterial({ color: 0x43403d, flatShading: true });
    const steel = new THREE.MeshLambertMaterial({ color: 0x594a43, flatShading: true });
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const chassis = new THREE.Mesh(cube, rock);
    chassis.scale.set(width * .91, .34, length * .86);
    chassis.position.y = .19;
    this.wreck.add(chassis);
    for (let index = 0; index < 8; index++) {
      const scrap = new THREE.Mesh(cube, index % 3 === 0 ? steel : soot);
      scrap.position.set((index % 2 ? -.29 : .31) * width, .29, (index % 4 - 1.5) * length * .23);
      scrap.rotation.set(index * .47, index * 1.6, index * .62);
      scrap.scale.set(.48 + index % 3 * .21, .17 + index % 2 * .20, .52);
      this.wreck.add(scrap);
    }
    this.group.add(this.wreck);
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Mesh(particle, new THREE.MeshBasicMaterial({ color: 0x767470,
        opacity: 0, transparent: true, depthWrite: false }));
      this.smoke.push(puff);
      this.group.add(puff);
    }
    const warm = new THREE.MeshBasicMaterial({ color: 0xff7325 });
    const hot = new THREE.MeshBasicMaterial({ color: 0xffd571 });
    for (let i = 0; i < 6; i++) {
      const flame = new THREE.Mesh(particle, i % 3 ? warm : hot);
      this.flames.push(flame);
      this.group.add(flame);
    }
    for (let i = 0; i < 12; i++) {
      const fireball = new THREE.Mesh(particle, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff7528 : 0xffd171,
        transparent: true, opacity: 1, depthWrite: false }));
      this.burst.push(fireball);
      this.group.add(fireball);
    }
  }

  update(damage: number, explosionAge: number | undefined, time: number, hood: number): void {
    const wrecked = explosionAge !== undefined;
    const burning = damage >= FIRE_DAMAGE && !wrecked;
    this.wreck.visible = wrecked;
    this.smoke.forEach((puff, index) => {
      puff.visible = damage >= SMOKE_DAMAGE;
      if (!puff.visible) return;
      const age = (time * (wrecked || burning ? .75 : .55) + index / this.smoke.length) % 1;
      puff.position.set(Math.cos(index * 2.4) * (.18 + age * .30), (wrecked ? .32 : .91) + age * (wrecked ? 1.9 : 1.5),
        (wrecked ? 0 : hood) + age * .46);
      puff.rotation.set(age, index, age * 2);
      puff.scale.setScalar(.15 + age * (wrecked ? .60 : .43));
      (puff.material as THREE.MeshBasicMaterial).opacity = (1 - age) * (wrecked || burning ? .62 : .30);
    });
    this.flames.forEach((flame, index) => {
      flame.visible = burning || (wrecked && index < 2 && explosionAge > .55);
      if (!flame.visible) return;
      const phase = (time * 3.2 + index / 6) % 1;
      flame.position.set((index - 2.5) * .17, (wrecked ? .35 : .86) + phase * (wrecked ? .24 : .66), wrecked ? -.21 : hood);
      flame.scale.set(.15 * (1 - phase * .65), (wrecked ? .22 : .49) * (1 - phase * .72), .14 * (1 - phase * .7));
    });
    this.burst.forEach((ball, index) => {
      ball.visible = wrecked && explosionAge < .83;
      if (!ball.visible || explosionAge === undefined) return;
      const age = explosionAge / .83;
      const angle = index * 2.4;
      const radius = .12 + age * (1.55 + index % 3 * .66);
      ball.position.set(Math.cos(angle) * radius, .84 + age * (1.05 + index % 4 * .39), Math.sin(angle) * radius);
      ball.scale.setScalar((.59 + age * 1.16) * (1 - age * .58) * (.77 + index % 3 * .12));
      (ball.material as THREE.MeshBasicMaterial).opacity = (1 - age) ** .72;
    });
  }
}
