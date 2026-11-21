import RAPIER from "@dimforge/rapier3d-compat";
import { downtown } from "../content/downtown";
import { downtownPedestrians } from "../content/pedestrians";
import { policeConfig, reinforcementLooks, reinforcementPoints } from "../content/police";
import { createPedestrianLook } from "../content/characters/pedestrianLooks";
import { downtownTraffic } from "../content/vehicles/downtownTraffic";
import { dialogueCamera, firstShift, marlaDefinition, marlaDialogue, playerDefinition } from "../content/downtownStory";
import { EntityManager } from "../entities/EntityManager";
import type { Wardrobe } from "../entities/Appearance";
import type { Entity, Point } from "../entities/EntityManager";
import { GameView } from "../render/GameView";
import { DialogueSystem } from "../systems/DialogueSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { HealthSystem } from "../systems/HealthSystem";
import { CashSystem } from "../systems/CashSystem";
import { MeleeSystem } from "../systems/MeleeSystem";
import { CrimeSystem } from "../systems/CrimeSystem";
import { WantedLevelSystem } from "../systems/WantedLevelSystem";
import type { WantedLevel } from "../systems/WantedLevelSystem";
import { PoliceResponseSystem } from "../systems/PoliceResponseSystem";
import { MissionSystem } from "../systems/MissionSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { NpcColliders, WITHOUT_NPC_BODIES } from "../systems/NpcColliders";
import { SequenceDirector } from "../systems/SequenceDirector";
import { TriggerSystem } from "../systems/TriggerSystem";
import { TrafficSystem } from "../systems/TrafficSystem";
import { PedestrianSystem } from "../systems/PedestrianSystem";
import type { TrafficCar } from "../systems/TrafficSystem";
import { VehicleSystem } from "../systems/VehicleSystem";
import { equipGarment } from "../systems/WardrobeSystem";
import type { HudSnapshot } from "../ui/hudStore";
import { WorldManager } from "../world/WorldManager";
import { EventBus } from "./EventBus";
import { GameDirector } from "./GameDirector";
import { FIXED_DT, GameLoop } from "./GameLoop";
import { InputManager } from "./InputManager";

let rapierReady: Promise<void> | undefined;

export class Game {
  private events = new EventBus();
  private director = new GameDirector();
  private entities = new EntityManager();
  private flags = new Map<string, boolean>();
  private mission = new MissionSystem(this.events, [firstShift]);
  private dialogue = new DialogueSystem(this.events, (flag) => this.flags.get(flag) ?? false);
  private triggers = new TriggerSystem(this.events, downtown.locations);
  private interaction = new InteractionSystem(this.events);
  private health = new HealthSystem();
  private sequences = new SequenceDirector(this.director);
  private traffic = new TrafficSystem(downtownTraffic);
  private vehicles: VehicleSystem;
  private player = this.entities.spawn("player", playerDefinition, downtown.spawns.player, .23);
  private npc = this.entities.spawn("marla-downtown", marlaDefinition, downtown.spawns.npc, Math.PI + .42);
  private pedestrians = new PedestrianSystem(this.entities, downtownPedestrians, createPedestrianLook);
  private melee: MeleeSystem;
  private wanted = new WantedLevelSystem(() => this.publishHud());
  private police: PoliceResponseSystem;
  private crime: CrimeSystem;
  private reinforcementId = 0;
  private view: GameView;
  private physics: RAPIER.World;
  private district: WorldManager;
  private movement: MovementSystem;
  private npcColliders: NpcColliders;
  private input: InputManager;
  private loop: GameLoop;
  private candidate: Entity | null = null;
  private carCandidate: TrafficCar | null = null;
  private cash = new CashSystem(this.events, this.player.id);
  private missionReward = 0;
  private complete = false;
  private debug = false;
  private fps = 60;
  private hudElapsed = 0;
  private disposed = false;

  static async create(mount: HTMLElement, publish: (hud: HudSnapshot) => void, signal: AbortSignal): Promise<Game | null> {
    await (rapierReady ??= RAPIER.init());
    return signal.aborted ? null : new Game(mount, publish);
  }

  private constructor(mount: HTMLElement, private readonly publish: (hud: HudSnapshot) => void) {
    this.view = new GameView(mount);
    this.physics = new RAPIER.World({ x: 0, y: -19, z: 0 });
    this.physics.timestep = FIXED_DT;
    this.district = new WorldManager(this.physics, downtown);
    this.view.scene.add(this.district.root);
    this.movement = new MovementSystem(this.physics, this.player);
    this.npcColliders = new NpcColliders(this.physics);
    this.melee = new MeleeSystem(this.player, () => this.pedestrians.walkers.map(({ entity }) => entity),
      (from, to) => this.clearSight(from, to, .88), Math.random, (hit) => this.events.emit("combat:hit", hit),
      (point) => {
        const ray = new RAPIER.Ray({ ...point, y: .55 }, { x: 0, y: -1, z: 0 });
        const ground = this.physics.castRay(ray, 1.5, true,
          RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          WITHOUT_NPC_BODIES);
        return ground ? .55 - ground.timeOfImpact : -.01;
      });
    this.view.addActor(this.player);
    this.view.addActor(this.npc);
    for (const { entity } of this.pedestrians.walkers) this.view.addActor(entity);
    this.view.addTraffic(this.traffic);
    this.vehicles = new VehicleSystem(this.physics, this.traffic, this.events);
    const officers = () => this.pedestrians.walkers.flatMap(({ entity }) => entity.definition.faction === "police" ? [entity] : []);
    const conscious = (id: string) => this.melee.healthOf(id) > 0;
    this.police = new PoliceResponseSystem(this.wanted, {
      officers, active: conscious,
      clearSight: (a, b) => this.clearSight(a, b, 1.25),
      clearRoute: (a, b) => this.clearSight(a, b, .85, true),
      isOnScreen: (point) => this.view.isOnScreen(point),
      canSpawnAt: (point) => !this.physics.intersectionWithShape({ ...point, y: point.y + .83 },
        { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(.44, .29)),
      spawn: (point) => {
        const appearance = reinforcementLooks[this.reinforcementId % reinforcementLooks.length];
        const officer = this.entities.spawn(`reinforcement-${++this.reinforcementId}`, {
          id: "reinforcement", kind: "npc", name: "Police officer", modelId: "pedestrian-proxy",
          faction: "police", appearance,
        }, point);
        this.pedestrians.add(officer);
        this.view.addActor(officer);
        return officer;
      },
      remove: (id) => {
        this.pedestrians.remove(id);
        this.melee.forget(id);
        this.view.removeActor(id);
        this.entities.remove(id);
      },
    }, reinforcementPoints);
    this.crime = new CrimeSystem(this.events, this.player.id, {
      findEntity: (id) => this.entities.get(id), officers, conscious,
      clearSight: (a, b) => this.clearSight(a, b, 1.25), radius: policeConfig.witnessRadius,
      detected: (incident) => {
        this.police.investigate(incident);
        this.wanted.report(incident.kind);
      },
    });

    this.input = new InputManager(this.view.renderer.domElement,
      () => this.director.policy.walk || this.director.policy.drive,
      () => this.togglePause(),
      () => { if (this.director.policy.physics) this.togglePause(); },
      import.meta.env.DEV ? () => { this.debug = !this.debug; this.publishHud(); } : undefined,
    );
    this.mission.start(firstShift.id);
    const dialogues = new Map([[marlaDialogue.id, marlaDialogue]]);
    this.events.on("interaction:used", ({ entityId }) => {
      const entity = this.entities.get(entityId);
      const interaction = entity?.definition.interaction;
      if (interaction?.kind !== "dialogue") return;
      const definition = dialogues.get(interaction.dialogueId);
      if (!definition || !this.sequences.begin(dialogueCamera, entityId)) return;
      if (!this.dialogue.start(definition, entityId)) { this.sequences.end(); return; }
      this.input.clear();
      this.input.unlock();
      this.publishHud();
    });
    this.events.on("dialogue:completed", () => this.sequences.end());
    this.events.on("world:flag-set", ({ flag, value }) => this.flags.set(flag, value));
    this.events.on("mission:completed", ({ money }) => {
      this.missionReward = money;
      this.complete = true;
      this.publishHud();
    });
    // Populate Rapier's query data before the first movement and camera casts.
    this.syncNpcColliders();
    this.physics.step();
    this.loop = new GameLoop(this.advance, this.render, () => this.director.policy.physics);
    this.loop.start();
    this.publishHud();
  }

  togglePause(): void {
    if (this.director.mode === "dead") return;
    if (this.director.mode === "paused") this.director.resume();
    else this.director.pause();
    this.input.clear();
    this.input.unlock();
    this.publishHud();
  }

  advanceDialogue(choiceId?: string): void {
    if (this.director.mode !== "dialogue") return;
    this.dialogue.advance(choiceId);
    this.publishHud();
  }

  equipPlayerGarment(slot: keyof Wardrobe, garmentId: string): boolean {
    return !this.disposed && equipGarment(this.player, slot, garmentId);
  }

  setDebugWanted(level: WantedLevel): void {
    if (import.meta.env.DEV && this.director.mode !== "dead") this.wanted.setLevel(level);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.input.dispose();
    this.mission.dispose();
    this.crime.dispose();
    this.cash.dispose();
    this.events.clear();
    this.movement.dispose();
    this.npcColliders.dispose();
    this.vehicles.dispose();
    this.district.dispose();
    this.physics.free();
    this.view.dispose();
    this.entities.clear();
  }

  private advance = (dt: number): void => {
    const { policy } = this.director;
    this.health.step(dt);
    const strike = this.input.takeAttack() && policy.walk;
    const attackSpeed = this.melee.attacking || strike ? .28 : 1;
    let walkDelta: Point | undefined;
    if (policy.walk) {
      this.view.rig.look(...this.input.takeLook());
      walkDelta = this.movement.prepare(dt, {
        forward: attackSpeed * (Number(this.input.down("KeyW")) - Number(this.input.down("KeyS"))),
        strafe: attackSpeed * (Number(this.input.down("KeyD")) - Number(this.input.down("KeyA"))),
        sprint: attackSpeed === 1 && (this.input.down("ShiftLeft") || this.input.down("ShiftRight")),
        jump: this.input.take("Space") && attackSpeed === 1,
        heading: this.view.rig.heading,
      });
    }
    const use = this.input.take("KeyE");
    if (policy.drive && use) this.vehicles.exitRequested = true;
    const crossings = this.pedestrians.step(dt, this.traffic.cars.map((car) => ({
      ...this.traffic.pose(car, 1), speed: car.speed, length: car.spawn.model.length, width: car.spawn.model.width,
    })), (id) => this.entities.get(id)?.definition.faction === "police"
      ? this.police.controls(id) || this.melee.isDown(id) : this.melee.hasReactor(id),
    (from, to) => {
      const player = this.player.position;
      if (!walkDelta || Math.abs(player.y - to.y) >= 1.35) return false;
      const x = player.x + walkDelta.x, z = player.z + walkDelta.z;
      const nextGap = Math.hypot(to.x - x, to.z - z);
      return nextGap < .65 && nextGap < Math.hypot(from.x - x, from.z - z);
    });
    this.vehicles.step(dt, {
      throttle: Number(this.input.down("KeyW")) - Number(this.input.down("KeyS")),
      steer: Number(this.input.down("KeyA")) - Number(this.input.down("KeyD")),
      brake: this.input.down("Space"),
    }, policy.walk ? this.player.position : undefined, crossings);
    if (policy.drive) {
      const targets = this.pedestrians.walkers.map(({ entity }) => entity).filter(({ id }) => !this.melee.isDown(id));
      for (const contact of this.vehicles.npcContacts(targets, dt)) this.melee.reactToVehicle(contact, dt);
    }
    const impact = walkDelta && this.health.canTakeDamage
      ? this.vehicles.pedestrianImpact(this.movement.collider, walkDelta, dt) : 0;
    this.syncNpcColliders();
    this.physics.step();
    const occupied = this.vehicles.occupied;
    if (occupied) {
      this.cash.step(dt);
      const { x, z, yaw } = this.traffic.pose(occupied, 1);
      this.player.position = { x, y: 0, z };
      this.player.yaw = yaw;
      this.melee.step(dt, false, false, undefined, this.police.step(dt, this.player.position));
      if (this.vehicles.exitRequested) {
        const exit = this.vehicles.exit();
        if (exit) {
          this.movement.disembark(exit.point, exit.yaw);
          this.view.rig.heading = exit.yaw;
          this.director.setFreeMode("exploration");
          this.input.clear();
          this.events.emit("vehicle:exited", { vehicleId: exit.car.spawn.id });
          this.publishHud();
        }
      }
      return;
    }
    if (!policy.walk) return;
    const landed = this.movement.commit(dt);
    const counterDamage = this.melee.step(dt, strike, true, (id) => !this.pedestrians.isCrossing(id),
      this.police.step(dt, this.player.position));
    const counterHit = this.health.applyMeleeHit(counterDamage);
    if (counterHit) this.melee.playerHit();
    const trafficHit = this.health.applyTrafficImpact(impact);
    const fallHit = this.health.applyFall(landed);
    if (trafficHit || counterHit || fallHit) {
      if (this.health.depleted) {
        this.director.die();
        this.police.reset();
        this.input.clear();
        this.input.unlock();
      }
      this.publishHud();
      if (this.health.depleted) return;
    }
    if (this.cash.step(dt, this.player.position)) this.publishHud();
    this.triggers.update(this.player.position);
    this.candidate = this.interaction.nearest(this.player.position, this.entities.all());
    this.carCandidate = this.vehicles.nearest(this.player.position, this.movement.collider)?.car ?? null;
    if (!use || this.melee.attacking) return;
    if (this.candidate) this.interaction.use(this.candidate);
    else if (this.carCandidate && this.director.setFreeMode("driving")) {
      this.vehicles.enter(this.carCandidate, this.player.position, this.player.id);
      this.movement.board();
      this.carCandidate = null;
      this.input.clear();
      this.events.emit("vehicle:entered", { vehicleId: this.vehicles.occupied!.spawn.id });
      this.publishHud();
    }
  };

  private clearSight(from: Point, to: Point, height: number, fixedOnly = false): boolean {
    const direction = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    if (Math.hypot(direction.x, direction.y, direction.z) < .02) return true;
    const ray = new RAPIER.Ray({ ...from, y: from.y + height }, direction);
    const flags = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | (fixedOnly ? RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC : 0);
    const occupied = this.vehicles?.occupiedCollider;
    return !this.physics.castRay(ray, 1, true, flags, WITHOUT_NPC_BODIES, this.movement.collider,
      undefined, (collider) => collider.handle !== occupied?.handle);
  }

  private syncNpcColliders(): void {
    this.npcColliders.sync([
      this.npc,
      ...this.pedestrians.walkers.map(({ entity }) => entity).filter((entity) =>
        entity.enabled && !this.melee.isDown(entity.id)),
      ...this.vehicles.drivers.filter((driver) => driver.running),
    ]);
  }

  private render = (dt: number, alpha: number): void => {
    const { position } = this.player;
    const last = this.movement.previous;
    const interpolated = {
      x: last.x + (position.x - last.x) * alpha,
      y: last.y + (position.y - last.y) * alpha,
      z: last.z + (position.z - last.z) * alpha,
    };
    const { camera, walk } = this.director.policy;
    const occupied = this.vehicles.occupied;
    const vehiclePose = occupied ? this.traffic.pose(occupied, alpha) : undefined;
    if (camera !== "hold") {
      const focusId = camera === "focus" ? this.sequences.focusId : undefined;
      const focus = focusId ? this.entities.get(focusId)?.position : undefined;
      this.view.rig.update(dt, vehiclePose ? { ...vehiclePose, y: 0 } : interpolated, focus, this.castCameraRay, vehiclePose?.yaw);
    }
    this.view.updateTraffic(this.traffic, alpha);
    this.view.updatePedestrians(this.pedestrians.walkers, alpha, this.melee);
    this.view.updateDrivers(this.vehicles.drivers);
    this.view.updateCash(this.cash.pickups);
    this.view.render(this.player, interpolated, walk ? this.movement.speed : 0, this.goal,
      camera === "hold" ? 0 : dt, !!occupied, this.melee.getPose(this.player.id));
    if (import.meta.env.DEV && dt > 0) this.fps += (1 / dt - this.fps) * .09;
    this.hudElapsed += dt;
    if (this.hudElapsed >= .1) this.publishHud();
  };

  private castCameraRay = (origin: Point, direction: Point, distance: number): number | undefined => {
    const car = this.vehicles.occupiedCollider;
    const hit = this.physics.castRay(new RAPIER.Ray(origin, direction), distance, true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, WITHOUT_NPC_BODIES, this.movement.collider,
      undefined, (collider) => collider.handle !== car?.handle);
    return hit?.timeOfImpact;
  };

  private get goal(): Point | undefined {
    const id = this.mission.current?.objective.locationId;
    return downtown.locations.find((location) => location.id === id)?.position;
  }

  private publishHud(): void {
    this.hudElapsed = 0;
    const current = this.mission.current;
    this.publish({
      mode: this.director.mode,
      health: this.health.value,
      wanted: this.wanted.level,
      mission: current && { title: current.mission.title, objective: current.objective.text },
      dialogue: this.dialogue.view,
      prompt: this.director.policy.interact ? this.candidate?.definition.interaction?.prompt ??
        (this.carCandidate ? this.carCandidate.offRoute ? "Get in car" : "Take car" : null) : null,
      driving: this.vehicles.occupied ? { speed: Math.round(Math.abs(this.vehicles.occupied.speed) * 2.237),
        exiting: this.vehicles.exitRequested, blocked: this.vehicles.exitBlocked } : null,
      goal: this.goal ?? null,
      player: this.player.position,
      yaw: this.player.yaw,
      money: this.cash.money,
      missionReward: this.missionReward,
      complete: this.complete,
      locked: document.pointerLockElement === this.view.renderer.domElement,
      debug: import.meta.env.DEV && this.debug ? { fps: Math.round(this.fps), responders: this.police.count,
        seenByPolice: this.police.visible, wantedDecay: this.wanted.timeToDecay } : null,
    });
  }
}
