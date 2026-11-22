import * as THREE from "three";
import type { TrafficSpawn } from "../systems/TrafficSystem";
import type { RoadPose } from "../systems/TrafficRoute";
import { VehicleEffects } from "./VehicleEffects";

export class TrafficView {
  readonly root = new THREE.Group();
  private intact = new THREE.Group();
  private effects: VehicleEffects;
  private hood: number;
  private wheels: THREE.Group[] = [];
  private brakes = new THREE.MeshBasicMaterial({ color: 0x942e3c });

  constructor({ id, model, color }: TrafficSpawn) {
    this.root.name = id;
    const { width: w, length: l, height: h, wheelbase, body } = model;
    this.effects = new VehicleEffects(l, w);
    this.hood = -l * .39;
    this.root.add(this.intact, this.effects.group);
    const pickup = body === "pickup";
    const hatch = body === "hatchback";
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const tireGeo = new THREE.CylinderGeometry(.31, .31, .22, 10).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(.17, .17, .23, 8).rotateZ(Math.PI / 2);
    const paint = new THREE.MeshLambertMaterial({ color });
    const trim = new THREE.MeshLambertMaterial({ color: 0x39424a });
    const glass = new THREE.MeshLambertMaterial({ color: 0x435967, flatShading: true });
    const tires = new THREE.MeshLambertMaterial({ color: 0x272831 });
    const metal = new THREE.MeshLambertMaterial({ color: 0xaaa6a1 });
    const lights = new THREE.MeshBasicMaterial({ color: 0xffedc0 });
    const box = (material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) => {
      const mesh = new THREE.Mesh(cube, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      this.intact.add(mesh);
    };
    const deck = pickup ? 1.03 : .85;
    box(paint, 0, (deck + .39) / 2, 0, w, deck - .39, l);
    box(trim, 0, .43, -l / 2, w * .97, .17, .13);
    box(trim, 0, .43, l / 2, w * .98, .17, .13);
    box(hatch ? trim : metal, 0, .66, -l / 2 - .008, w * .42, .14, .04);
    box(metal, 0, .6, l / 2 + .008, .29, .12, .04);
    const front = -l * (pickup ? .32 : .28);
    const back = l * (pickup ? .06 : hatch ? .42 : .28);
    const topFront = front + .45;
    const topBack = back - (hatch || pickup ? .12 : .43);
    const bottom = w * .438;
    const top = w * .36;
    const vertices = [
      -bottom, deck, front, bottom, deck, front, bottom, deck, back, -bottom, deck, back,
      -top, h - .085, topFront, top, h - .085, topFront, top, h - .085, topBack, -top, h - .085, topBack,
    ];
    const cabin = new THREE.BufferGeometry();
    cabin.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    cabin.setIndex([0,4,5,0,5,1, 1,5,6,1,6,2, 2,6,7,2,7,3, 3,7,4,3,4,0, 4,7,6,4,6,5]);
    cabin.computeVertexNormals();
    this.intact.add(new THREE.Mesh(cabin, glass));
    box(paint, 0, h - .045, (topFront + topBack) / 2, top * 2.05, .09, topBack - topFront + .06);
    for (const side of [-1, 1]) {
      box(lights, side * w * .33, deck - .14, -l / 2 - .02, .31, .15, .07);
      box(this.brakes, side * w * .37, deck - .145, l / 2 + .02, .25, .17, .07);
      box(trim, side * w * .52, deck + .08, front + .47, .16, .105, .2);
      if (pickup) box(paint, side * w * .44, deck + .12, (back + l / 2) / 2, w * .12, .24, l / 2 - back);
      for (const z of [-wheelbase / 2, wheelbase / 2]) {
        const wheel = new THREE.Group();
        wheel.position.set(side * (w / 2 - .055), .31, z);
        wheel.add(new THREE.Mesh(tireGeo, tires), new THREE.Mesh(hubGeo, metal));
        this.intact.add(wheel);
        this.wheels.push(wheel);
      }
    }
    if (pickup) {
      box(trim, 0, deck + .008, (back + l / 2) / 2, w * .76, .028, l / 2 - back);
      box(paint, 0, deck + .12, l / 2 - .095, w, .24, .19);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 12),
      new THREE.MeshBasicMaterial({ color: 0x34343d, opacity: .3, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .012;
    shadow.scale.set(w * .64, l * .54, 1);
    this.root.add(shadow);
  }

  update(pose: RoadPose, travelled: number, braking: boolean, damage: number, explosionAge: number | undefined, time: number): void {
    this.root.position.set(pose.x, 0, pose.z);
    this.root.rotation.y = pose.yaw;
    this.intact.visible = explosionAge === undefined;
    this.effects.update(damage, explosionAge, time, this.hood);
    for (const wheel of this.wheels) wheel.rotation.x = -travelled / .31;
    this.brakes.color.setHex(braking ? 0xff5751 : 0x942e3c);
  }
}
