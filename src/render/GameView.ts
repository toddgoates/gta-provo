import * as THREE from "three";
import type { Entity, Point } from "../entities/EntityManager";
import { CameraRig } from "./CameraRig";
import { TrafficView } from "./TrafficView";
import type { TrafficSystem } from "../systems/TrafficSystem";

function buildPerson(modelId: string) {
  const group = new THREE.Group();
  const local = modelId === "local-proxy";
  const materials = new Map<number, THREE.MeshLambertMaterial>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function part(parent: THREE.Group, color: number, x: number, y: number, z: number, w: number, h: number, d: number) {
    let material = materials.get(color);
    if (!material) materials.set(color, material = new THREE.MeshLambertMaterial({ color, flatShading: true }));
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
  }
  const shirt = local ? 0xca7546 : 0x61857d;
  const pants = local ? 0x414c67 : 0x4b4254;
  const skin = local ? 0xba7856 : 0xd69b78;
  part(group, shirt, 0, 1.18, 0, .55, .62, .34);
  part(group, local ? 0x634f48 : 0xe5bd8d, 0, 1.21, -.179, .035, .56, .018);
  part(group, pants, 0, .82, 0, .47, .16, .29);
  part(group, skin, 0, 1.62, -.015, .34, .34, .31);
  part(group, local ? 0x485875 : 0x653e46, 0, 1.8, -.015, .39, .12, .35);
  if (local) part(group, 0x485875, 0, 1.759, -.225, .34, .04, .19);
  else {
    part(group, 0x653e46, 0, 1.63, .13, .35, .33, .12);
    part(group, 0xe2b775, 0, 1.13, -.185, .12, .077, .026);
  }
  for (const side of [-1, 1]) part(group, 0x3a2f38, side * .083, 1.65, -.171, .035, .035, .02);
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * .13, .78, 0);
    part(leg, pants, 0, -.34, 0, .208, .65, .24);
    part(leg, 0x393741, 0, -.705, -.05, .22, .15, .34);
    group.add(leg);
    const arm = new THREE.Group();
    arm.position.set(side * .35, 1.44, 0);
    part(arm, shirt, 0, -.22, 0, .145, .48, .19);
    part(arm, skin, 0, -.49, 0, .135, .15, .16);
    group.add(arm);
    limbs.push(leg, arm);
  }
  return { group, limbs };
}

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  private actors = new Map<string, ReturnType<typeof buildPerson>>();
  private trafficViews: TrafficView[] = [];
  private marker = new THREE.Group();
  private crystal: THREE.Mesh;
  private shadow = new THREE.Mesh(new THREE.CircleGeometry(.49, 12),
    new THREE.MeshBasicMaterial({ color: 0x453e46, opacity: .34, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  private resizeObserver: ResizeObserver;
  private time = 0;

  constructor(mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setClearColor(0xadc2d2);
    this.renderer.domElement.setAttribute("aria-label", "Downtown Provo game view");
    this.scene.background = new THREE.Color(0xb2c7d4);
    this.scene.fog = new THREE.FogExp2(0xbac8d1, .0051);
    this.scene.add(new THREE.HemisphereLight(0xffe7c9, 0xa398ab, 1.85));
    const sun = new THREE.DirectionalLight(0xffddaa, 2.1);
    sun.position.set(-24, 46, 29);
    this.scene.add(sun);

    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd168 });
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.59), markerMat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.94, 2.08, 36),
      new THREE.MeshBasicMaterial({ color: 0xffd168, side: THREE.DoubleSide, transparent: true, opacity: .9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .09;
    this.marker.add(ring, this.crystal);
    this.marker.visible = false;
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker, this.shadow);
    mount.append(this.renderer.domElement);
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = mount;
      if (!width || !height) return;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25) * .85);
      this.renderer.setSize(width, height, false);
      this.rig.camera.aspect = width / height;
      this.rig.camera.updateProjectionMatrix();
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(mount);
    resize();
  }

  addActor(entity: Entity): void {
    const actor = buildPerson(entity.definition.modelId);
    actor.group.position.set(entity.position.x, entity.position.y, entity.position.z);
    actor.group.rotation.y = entity.yaw;
    this.actors.set(entity.id, actor);
    this.scene.add(actor.group);
  }

  addTraffic(traffic: TrafficSystem): void {
    this.trafficViews = traffic.cars.map(({ spawn }) => {
      const view = new TrafficView(spawn);
      this.scene.add(view.root);
      return view;
    });
  }

  updateTraffic(traffic: TrafficSystem, alpha: number): void {
    traffic.cars.forEach((car, index) => {
      this.trafficViews[index].update(traffic.pose(car, alpha), car.travelled, car.braking);
    });
  }

  render(player: Entity, position: Point, speed: number, goal: Point | undefined, dt: number): void {
    this.time += dt;
    const actor = this.actors.get(player.id)!;
    actor.group.position.set(position.x, position.y, position.z);
    actor.group.rotation.y = player.yaw;
    const stride = Math.sin(this.time * (speed > 6 ? 14 : 10)) * Math.min(.65, speed * .085);
    actor.limbs.forEach((limb, index) => { limb.rotation.x = (index === 0 || index === 3) ? stride : -stride; });
    const onBlock = Math.abs(position.x) > 9.2 && Math.abs(position.z) > 9.2;
    this.shadow.position.set(position.x, onBlock ? .163 : .004, position.z);
    this.marker.visible = !!goal;
    if (goal) {
      this.marker.position.set(goal.x, goal.y, goal.z);
      this.crystal.position.y = 1.65 + .24 * Math.sin(this.time * 3);
      this.crystal.rotation.y = this.time * 1.8;
    }
    this.renderer.render(this.scene, this.rig.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const mat of [object.material].flat()) materials.add(mat);
      }
    });
    for (const geo of geometries) geo.dispose();
    for (const material of materials) material.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
