import * as THREE from "three";
import { resolveWardrobe } from "../content/characters/wardrobe";
import type { Wardrobe } from "../entities/Appearance";
import type { Entity } from "../entities/EntityManager";

export function buildCharacter(entity: Entity) {
  const { appearance } = entity.definition;
  const { wardrobe } = entity;
  if (!appearance || !wardrobe) throw new Error(`Missing character appearance: ${entity.id}`);

  const root = new THREE.Group();
  root.scale.x = appearance.build === "slim" ? .9 : appearance.build === "broad" ? 1.1 : 1;
  const torso = new THREE.Group();
  torso.position.y = .91;
  const group = new THREE.Group();
  group.position.y = -.91;
  torso.add(group);
  root.add(torso);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const skin = mat(appearance.skin);
  const hair = mat(appearance.hair);
  const eyes = mat(appearance.eyes);
  const whites = mat(0xf4eee8);
  const shirt = mat(0xffffff);
  const pants = mat(0xffffff);
  const shoes = mat(0xffffff);
  const trim = mat(0xffffff);
  const seams = mat(0xffffff);

  function part(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }

  part(group, shirt, 0, 1.18, 0, .55, .62, .34);
  const placket = part(group, trim, 0, 1.21, -.179, .035, .56, .018);
  part(group, pants, 0, .82, 0, .47, .16, .29);
  part(group, skin, 0, 1.62, -.015, .34, .34, .31);

  if (appearance.haircut === "short") {
    part(group, hair, 0, 1.787, -.014, .366, .103, .337);
    part(group, hair, -.052, 1.846, -.062, .231, .033, .232);
    part(group, hair, -.096, 1.746, -.172, .152, .039, .042);
    part(group, hair, 0, 1.736, .131, .35, .105, .064);
  } else if (appearance.haircut === "cropped") {
    part(group, hair, 0, 1.778, -.012, .351, .065, .322);
    part(group, hair, 0, 1.731, .126, .336, .05, .041);
  } else {
    part(group, hair, 0, 1.8, -.015, .39, .12, .35);
    part(group, hair, 0, 1.63, .13, .35, .33, .12);
    if (appearance.haircut === "long") {
      part(group, hair, 0, 1.418, .18, .357, .52, .155);
      part(group, hair, -.167, 1.565, .014, .079, .419, .209);
      part(group, hair, .164, 1.59, .058, .086, .344, .16);
    }
  }

  if (entity.definition.faction === "police") {
    const cap = mat(0x24324e);
    part(group, cap, 0, 1.823, -.013, .403, .103, .372);
    part(group, cap, 0, 1.783, -.214, .363, .031, .132);
    part(group, mat(0xd5b170), -.117, 1.334, -.176, .083, .081, .023);
  }

  const limbs: THREE.Group[] = [];
  const joints: THREE.Group[] = [];
  const sleeves: THREE.Mesh[] = [];
  const lowerSleeves: THREE.Mesh[] = [];
  const jeanSeams: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    part(group, whites, side * .082, 1.648, -.171, .074, .044, .014);
    part(group, eyes, side * .074, 1.648, -.181, .043, .044, .012);

    const leg = new THREE.Group();
    leg.position.set(side * .13, .78, 0);
    const knee = new THREE.Group();
    knee.position.y = -.33;
    part(leg, pants, 0, -.17, 0, .208, .35, .24);
    part(knee, pants, 0, -.17, 0, .198, .35, .23);
    jeanSeams.push(part(leg, seams, side * .104, -.16, -.03, .013, .31, .02));
    jeanSeams.push(part(knee, seams, side * .099, -.16, -.03, .013, .31, .02));
    part(knee, shoes, 0, -.375, -.05, .22, .15, .34);
    leg.add(knee);
    root.add(leg);

    const arm = new THREE.Group();
    arm.position.set(side * .35, 1.44, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -.25;
    part(arm, skin, 0, -.135, 0, .133, .28, .154);
    sleeves.push(part(arm, shirt, 0, -.125, 0, .153, .27, .193));
    part(elbow, skin, 0, -.145, 0, .132, .31, .153);
    lowerSleeves.push(part(elbow, shirt, 0, -.097, 0, .149, .22, .185));
    arm.add(elbow);
    group.add(arm);
    limbs.push(leg, arm);
    joints.push(knee, elbow);
  }

  let applied: Wardrobe | undefined;
  function updateWardrobe(next: Wardrobe) {
    if (next === applied) return;
    const outfit = resolveWardrobe(next);
    shirt.color.setHex(outfit.top.color);
    pants.color.setHex(outfit.bottoms.color);
    shoes.color.setHex(outfit.shoes.color);
    placket.visible = outfit.top.trim !== null;
    if (outfit.top.trim !== null) trim.color.setHex(outfit.top.trim);
    for (const seam of jeanSeams) seam.visible = outfit.bottoms.seam !== null;
    if (outfit.bottoms.seam !== null) seams.color.setHex(outfit.bottoms.seam);
    const short = outfit.top.sleeves === "short";
    for (const sleeve of sleeves) {
      sleeve.position.y = short ? -.078 : -.125;
      sleeve.scale.y = short ? .19 : .27;
    }
    for (const sleeve of lowerSleeves) sleeve.visible = !short;
    applied = next;
  }

  updateWardrobe(wardrobe);
  return { group: root, limbs, joints, torso, updateWardrobe };
}
