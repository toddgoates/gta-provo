import * as THREE from "three";
import type { Entity, Point } from "../entities/EntityManager";
import { CameraRig } from "./CameraRig";
import { CashView } from "./CashView";
import type { CashDrop } from "../systems/CashSystem";
import { TrafficView } from "./TrafficView";
import type { TrafficSystem } from "../systems/TrafficSystem";
import { buildCharacter } from "./CharacterView";
import type { FleeingDriver } from "../systems/VehicleSystem";
import type { Pedestrian } from "../systems/PedestrianSystem";
import type { MeleePose, MeleeSystem } from "../systems/MeleeSystem";
import { poseCharacter } from "./CharacterMotion";

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  private actors = new Map<string, { entity: Entity; view: ReturnType<typeof buildCharacter> }>();
  private trafficViews: TrafficView[] = [];
  private driverViews = new Map<string, ReturnType<typeof buildCharacter>>();
  private downedMarks = new Map<string, THREE.Mesh>();
  private cash = new CashView();
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
    this.scene.add(this.marker, this.shadow, this.cash.root);
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
    const view = buildCharacter(entity);
    view.group.position.set(entity.position.x, entity.position.y, entity.position.z);
    view.group.rotation.y = entity.yaw;
    this.actors.set(entity.id, { entity, view });
    this.scene.add(view.group);
  }

  removeActor(id: string): void {
    const actor = this.actors.get(id);
    if (actor) {
      this.disposeMeshes(actor.view.group);
      actor.view.group.removeFromParent();
      this.actors.delete(id);
    }
    const stain = this.downedMarks.get(id);
    if (stain) {
      this.disposeMeshes(stain);
      stain.removeFromParent();
      this.downedMarks.delete(id);
    }
  }

  isOnScreen(point: Point): boolean {
    const camera = this.rig.camera;
    camera.updateMatrixWorld();
    const projected = new THREE.Vector3(point.x, point.y + .9, point.z).project(camera);
    return projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) < 1.12 && Math.abs(projected.y) < 1.2;
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

  updateCash(drops: Iterable<CashDrop>): void { this.cash.update(drops, this.time); }

  updateDrivers(drivers: readonly FleeingDriver[]): void {
    for (const view of this.driverViews.values()) view.group.visible = false;
    for (const driver of drivers) {
      let view = this.driverViews.get(driver.id);
      if (!view) {
        const { appearance } = driver.profile;
        const definition = { id: "driver", name: "Driver", kind: "npc" as const, modelId: "driver-proxy", appearance };
        view = buildCharacter({ id: driver.id, definition, position: driver.position, yaw: driver.yaw, enabled: true,
          wardrobe: appearance.defaultWardrobe });
        this.driverViews.set(driver.id, view);
        this.scene.add(view.group);
      }
      view.group.visible = true;
      view.group.position.set(driver.position.x, driver.position.y, driver.position.z);
      view.group.rotation.set(-driver.tumble, driver.yaw, 0, "YXZ");
      const stride = driver.running ? Math.sin(this.time * 15) * .78 : .45;
      poseCharacter(view, stride);
    }
  }

  updatePedestrians(walkers: readonly Pedestrian[], alpha: number, melee: MeleeSystem): void {
    for (const { entity, previous, phase, speed: walkSpeed } of walkers) {
      const speed = melee.hasReactor(entity.id) ? melee.reactionSpeed(entity.id) : walkSpeed;
      const view = this.actors.get(entity.id)!.view;
      const { x, y, z } = entity.position;
      view.group.position.set(previous.x + (x - previous.x) * alpha, previous.y + (y - previous.y) * alpha,
        previous.z + (z - previous.z) * alpha);
      const fall = melee.fallProgress(entity.id);
      view.group.rotation.set(fall === undefined ? 0 : Math.PI * .5 * fall * fall,
        entity.yaw, 0, "YXZ");
      if (fall !== undefined) {
        view.group.position.y += .19 * fall;
        poseCharacter(view, 0);
        view.limbs[1].rotation.z = -.48 * fall;
        view.limbs[3].rotation.z = .63 * fall;
        view.joints[1].rotation.x = .22 * fall;
        view.joints[2].rotation.x = -.12 * fall;
        if (fall === 1) this.addDownedMark(entity);
        continue;
      }
      poseCharacter(view, Math.sin(this.time * (speed > 4 ? 13 : speed > 2 ? 9 : 7) + phase) * Math.min(.66, speed * .175),
        melee.getPose(entity.id));
    }
  }

  private addDownedMark(entity: Entity): void {
    if (this.downedMarks.has(entity.id)) return;
    const { x, y, z } = entity.position;
    const stain = new THREE.Mesh(new THREE.CircleGeometry(.32, 9),
      new THREE.MeshBasicMaterial({ color: 0x6d292b, transparent: true, opacity: .68, depthWrite: false }));
    stain.rotation.x = -Math.PI / 2;
    stain.scale.set(1.35, .8, 1);
    stain.position.set(x + Math.sin(entity.yaw) * .98 + .14, y + .012, z + Math.cos(entity.yaw) * .98);
    this.downedMarks.set(entity.id, stain);
    this.scene.add(stain);
  }

  render(player: Entity, position: Point, speed: number, goal: Point | undefined, dt: number, seated = false, melee?: MeleePose): void {
    this.time += dt;
    for (const { entity, view } of this.actors.values()) {
      if (entity.wardrobe) view.updateWardrobe(entity.wardrobe);
    }
    const actor = this.actors.get(player.id)!.view;
    actor.group.visible = !seated;
    actor.group.position.set(position.x, position.y, position.z);
    actor.group.rotation.y = player.yaw;
    const stride = Math.sin(this.time * (speed > 6 ? 14 : 10)) * Math.min(.65, speed * .085);
    poseCharacter(actor, stride, melee);
    const onBlock = Math.abs(position.x) > 9.2 && Math.abs(position.z) > 9.2;
    this.shadow.position.set(position.x, onBlock ? .163 : .004, position.z);
    this.shadow.visible = !seated;
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
    this.cash.dispose();
    this.disposeMeshes(this.scene);
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private disposeMeshes(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const mat of [object.material].flat()) materials.add(mat);
      }
    });
    for (const geo of geometries) geo.dispose();
    for (const material of materials) material.dispose();
  }
}
