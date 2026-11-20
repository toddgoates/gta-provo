import * as THREE from "three";
import { resolveWardrobe } from "../content/characters/wardrobe";
import type { Wardrobe } from "../entities/Appearance";
import type { Entity } from "../entities/EntityManager";

export function buildCharacter(entity: Entity) {
  const { appearance } = entity.definition;
  const { wardrobe } = entity;
  if (!appearance || !wardrobe) throw new Error(`Missing character appearance: ${entity.id}`);

  const group = new THREE.Group();
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
  } else {
    part(group, hair, 0, 1.8, -.015, .39, .12, .35);
    part(group, hair, 0, 1.63, .13, .35, .33, .12);
  }

  const limbs: THREE.Group[] = [];
  const sleeves: THREE.Mesh[] = [];
  const jeanSeams: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    part(group, whites, side * .082, 1.648, -.171, .074, .044, .014);
    part(group, eyes, side * .074, 1.648, -.181, .043, .044, .012);

    const leg = new THREE.Group();
    leg.position.set(side * .13, .78, 0);
    part(leg, pants, 0, -.34, 0, .208, .65, .24);
    jeanSeams.push(part(leg, seams, side * .104, -.34, -.03, .013, .62, .02));
    part(leg, shoes, 0, -.705, -.05, .22, .15, .34);
    group.add(leg);

    const arm = new THREE.Group();
    arm.position.set(side * .35, 1.44, 0);
    part(arm, skin, 0, -.268, 0, .133, .55, .154);
    sleeves.push(part(arm, shirt, 0, -.22, 0, .153, .48, .193));
    group.add(arm);
    limbs.push(leg, arm);
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
      sleeve.position.y = short ? -.078 : -.22;
      sleeve.scale.y = short ? .19 : .48;
    }
    applied = next;
  }

  updateWardrobe(wardrobe);
  return { group, limbs, updateWardrobe };
}
