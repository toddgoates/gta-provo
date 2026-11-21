import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { BuildingLot, DistrictDefinition } from "../content/downtown";

/** Owns one loaded district. Collision stays primitive even if meshes become GLBs. */
export class WorldManager {
  readonly root = new THREE.Group();
  private colliders: RAPIER.Collider[] = [];
  private materials = new Map<number, THREE.MeshLambertMaterial>();
  private cube = new THREE.BoxGeometry(1, 1, 1);

  constructor(private readonly physics: RAPIER.World, district: DistrictDefinition) {
    this.root.name = district.name;
    const { width, depth } = district.bounds;
    this.box(0, -.41, 0, width + 35, .8, depth + 35, 0x777a81, true);
    for (const block of district.blocks) {
      this.box(block.x, .07, block.z, block.width, .16, block.depth, 0xc6b9aa, true);
      if (block.plaza) this.plaza(block.x, block.z);
    }
    this.streetMarkings(width, depth, district.roadWidth);
    for (const lot of district.buildings) this.building(lot);
    for (const [x, z, size] of district.trees) this.tree(x, z, size);
    for (const [x, z] of district.lamps) this.lamp(x, z);
    this.box(0, 1, -depth / 2, width, 5, .2, 0x000000, true, false);
    this.box(0, 1, depth / 2, width, 5, .2, 0x000000, true, false);
    this.box(-width / 2, 1, 0, .2, 5, depth, 0x000000, true, false);
    this.box(width / 2, 1, 0, .2, 5, depth, 0x000000, true, false);
    this.mountains();
  }

  dispose(): void {
    for (const collider of this.colliders) this.physics.removeCollider(collider, false);
    const geometry = new Set<THREE.BufferGeometry>([this.cube]);
    const material = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometry.add(object.geometry);
        for (const mat of [object.material].flat()) material.add(mat);
      }
    });
    for (const geo of geometry) geo.dispose();
    const textures = new Set<THREE.Texture>();
    for (const mat of material) {
      if ("map" in mat && mat.map instanceof THREE.Texture) textures.add(mat.map);
      mat.dispose();
    }
    for (const texture of textures) texture.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }

  private mat(color: number): THREE.MeshLambertMaterial {
    let cached = this.materials.get(color);
    if (!cached) {
      cached = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.materials.set(color, cached);
    }
    return cached;
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, solid = false, visible = true) {
    if (solid) this.colliders.push(this.physics.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z)));
    if (!visible) return;
    const mesh = new THREE.Mesh(this.cube, this.mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    this.root.add(mesh);
  }

  private streetMarkings(width: number, depth: number, roadWidth: number): void {
    const half = roadWidth / 2;
    for (let x = -width / 2 + 12; x < width / 2 - 10; x += 5) {
      if (Math.abs(x) > half + 6) this.box(x, .005, 0, 2.6, .012, .14, 0xf3cb77);
    }
    for (let z = -depth / 2 + 12; z < depth / 2 - 10; z += 5) {
      if (Math.abs(z) > half + 6) this.box(0, .005, z, .14, .012, 2.6, 0xf3cb77);
    }
    for (let n = -7; n <= 7; n += 2) {
      for (const side of [-1, 1]) {
        this.box(n, .006, side * (half + 2), .75, .012, 2.3, 0xf1e0ca);
        this.box(side * (half + 2), .006, n, 2.3, .012, .75, 0xf1e0ca);
      }
    }
    const line = half + 4;
    const curb = half + .85;
    for (const side of [-1, 1]) {
      this.box(-side * half / 2, .012, -side * line, half - .5, .014, .24, 0xf1e0ca);
      this.box(-side * line, .012, side * half / 2, .24, .014, half - .5, 0xf1e0ca);
      this.stopSign(-side * curb, -side * (line + .7), side === 1 ? Math.PI : 0);
      this.stopSign(-side * (line + .7), side * curb, -side * Math.PI / 2);
    }
  }

  private stopSign(x: number, z: number, yaw: number): void {
    this.box(x, 1.29, z, .065, 2.28, .065, 0x74787d);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i + .5) * Math.PI / 4;
      ctx.lineTo(64 + Math.cos(angle) * 63, 64 + Math.sin(angle) * 63);
    }
    ctx.closePath();
    ctx.fillStyle = "#a84440";
    ctx.fill();
    ctx.strokeStyle = "#fff2d7";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#fff2d7";
    ctx.font = "bold 35px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STOP", 64, 76);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8),
      new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .3 }));
    mesh.position.set(x + Math.sin(yaw) * .04, 2.37, z + Math.cos(yaw) * .04);
    mesh.rotation.y = yaw;
    const back = new THREE.Mesh(new THREE.CircleGeometry(.391, 8, Math.PI / 8), this.mat(0x84888b));
    back.position.set(x - Math.sin(yaw) * .04, 2.37, z - Math.cos(yaw) * .04);
    back.rotation.y = yaw + Math.PI;
    this.root.add(mesh, back);
  }

  private building({ x, z, width: w, depth: d, height: h, color, front, sign, accent = 0x6a5a60, roofStairs }: BuildingLot): void {
    const face = z + front * (d / 2 + .04);
    this.box(x, h / 2 + .15, z, w, h, d, color, true);
    this.box(x, h + .16, z, w + .36, .28, d + .36, accent, !!roofStairs);
    this.box(x + w * .21, h + .61, z - 1.8, w * .24, .76, d * .25, 0x8a8588);
    this.box(x, .56, face + front * .06, w, .8, .17, accent);
    this.box(x, 1.52, face, 1.65, 2.76, .18, 0x354957);
    for (let dx = -w / 2 + 2; dx < w / 2 - 1; dx += 3) {
      if (Math.abs(dx) > 1.3) {
        this.box(x + dx, 1.92, face, 1.8, 1.66, .14, 0x526875);
        this.box(x + dx, 1.08, face + front * .09, 1.96, .13, .18, 0xe6bf9d);
      }
      for (let y = 5.25; y < h - .7; y += 2.6) {
        this.box(x + dx, y, face, 1.13, 1.35, .13, 0x536577);
        this.box(x + dx, y - .74, face, 1.34, .12, .22, 0xd7b29b);
      }
    }
    for (let dz = -d / 2 + 2.3; dz < d / 2 - 1; dz += 3.8) {
      for (const side of [-1, 1]) {
        for (let y = 2; y < h - .8; y += 2.8) this.box(x + side * w / 2, y, z + dz, .14, 1.3, 1.25, 0x536577);
      }
    }
    if (sign) {
      this.box(x, 3.04, face + front * .45, w * .68, .19, 1.22, accent);
      this.sign(sign, x, 3.85, face + front * .15, w * .69, front, accent);
    }
    if (roofStairs) this.roofStairway(x + w / 2, h + .30, roofStairs);
  }

  private roofStairway(wallX: number, roof: number, { baseZ, run, width }: NonNullable<BuildingLot["roofStairs"]>): void {
    const base = .15;
    const rise = roof - base;
    const x = wallX + width / 2;
    const endZ = baseZ + run;
    const rail = 0x414950;
    const tread = 0x687474;
    const steps = Math.ceil(rise / .21);
    const depth = run / steps;
    // Render individual treads, but use one sloped collision surface to avoid snagging on risers.
    for (let i = 0; i < steps; i++) {
      const y = base + rise * (i + 1) / steps;
      const z = baseZ + depth * (i + .5);
      this.box(x, y - .065, z, width, .13, depth + .025, tread);
      this.box(x, y - .015, z - depth / 2 + .026, width, .03, .06, 0xbfaa83);
    }
    const angle = Math.atan2(rise, run);
    const span = Math.hypot(rise, run);
    const rotatedBox = (cx: number, top: number, w: number, thickness: number, color: number, visible: boolean) => {
      const y = top - thickness * .5 * Math.cos(angle);
      const z = baseZ + run / 2 + thickness * .5 * Math.sin(angle);
      this.colliders.push(this.physics.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, thickness / 2, span / 2)
        .setTranslation(cx, y, z).setRotation({ x: -Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) })));
      if (!visible) return;
      const mesh = new THREE.Mesh(this.cube, this.mat(color));
      mesh.position.set(cx, y, z);
      mesh.scale.set(w, thickness, span);
      mesh.rotation.x = -angle;
      this.root.add(mesh);
    };
    rotatedBox(x, (base + roof) / 2, width, .23, tread, false);
    const outer = wallX + width;
    rotatedBox(outer, (base + roof) / 2 + 1.04, .095, .09, rail, true);
    rotatedBox(outer, (base + roof) / 2 + .57, .09, .09, rail, true);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      this.box(outer, base + rise * t + .51, baseZ + run * t, .092, 1.02, .092, rail);
    }
    this.box(x - .42, roof - .11, endZ + .98, width + .84, .22, 2.03, tread, true);
    this.box(outer, roof + .5, endZ + .98, .095, 1, 2.03, rail, true);
    this.box(x - .42, roof + .5, endZ + 1.98, width + .84, 1, .095, rail, true);
    this.box(x, roof / 2, endZ + 1.46, .16, roof, .16, rail);
    this.sign("ROOF ACCESS ↑", outer + .64, 1.18, baseZ - .13, 1.65, -1, 0x344951);
    this.box(outer + .64, .63, baseZ - .1, .07, 1.26, .07, rail);
  }

  private sign(text: string, x: number, y: number, z: number, width: number, front: number, accent: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = `#${accent.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, 512, 80);
    ctx.strokeStyle = "#f6dcab";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, 500, 68);
    ctx.fillStyle = "#fff2d7";
    ctx.font = "bold 46px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 42, 478);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * .15625), new THREE.MeshBasicMaterial({ map }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = front < 0 ? Math.PI : 0;
    this.root.add(mesh);
  }

  private lamp(x: number, z: number): void {
    this.box(x, 1.46, z, .13, 2.6, .13, 0x3b4248);
    this.box(x, 2.8, z, .33, .27, .33, 0xf4d7a0);
    this.box(x, 3, z, .46, .13, .46, 0x3b4248);
  }

  private tree(x: number, z: number, scale: number): void {
    this.box(x, .15 + scale, z, .24 * scale, 2 * scale, .25 * scale, 0x755953, true);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.48, 0), this.mat(0x778359));
    crown.position.set(x, .15 + 2.5 * scale, z);
    crown.scale.set(scale, scale * 1.2, scale);
    crown.rotation.y = x * .8;
    this.root.add(crown);
  }

  private plaza(x: number, z: number): void {
    this.box(x + 4, .17, z + 3, 36, .03, 28, 0xa5aa80);
    this.box(x - 11, .18, z - 1, 5, .04, 43, 0xdec9a8);
    this.box(x, .18, z - 8, 52, .04, 4, 0xdec9a8);
    for (const dx of [-3, 3]) this.box(29 + dx, 1.65, 27, .28, 3, .28, 0x6a6263, true);
    this.box(29, 3.25, 27, 7, .34, 4.2, 0x587575, true);
    this.sign("WELCOME PAVILION", 29, 3.42, 24.84, 6, -1, 0x446666);
    this.box(29, .7, 27.85, 1.5, 1.1, .15, 0xa96b55);
    this.box(29, .56, 27.5, 1.5, .12, .66, 0xa96b55);
  }

  private mountains(): void {
    const peaks: [number, number, number, number, number][] = [
      [-143,-151,49,72,0x8b8ea0],[-92,-187,53,96,0x9295a6],[-60,-130,46,65,0x798798],
      [0,-167,62,91,0x7b899d],[63,-145,56,89,0x858fa5],[113,-140,45,69,0x798698],
      [177,-111,57,107,0x9495a6],[191,-35,44,91,0x8993a3],[167,45,41,67,0x89899d],
      [-175,-81,36,77,0x9691a2],[-180,17,28,77,0xa1929c],
    ];
    for (const [x, z, height, width, color] of peaks) {
      const geometry = new THREE.ConeGeometry(1, 1, 5);
      const mountain = new THREE.Mesh(geometry, this.mat(color));
      mountain.position.set(x, height / 2 - 5, z);
      mountain.scale.set(width, height, width * .52);
      mountain.rotation.y = x * .09;
      this.root.add(mountain);
    }
  }
}
