import RAPIER from "@dimforge/rapier3d-compat";
import { downtown } from "../content/downtown";
import { downtownTraffic } from "../content/vehicles/downtownTraffic";
import { dialogueCamera, firstShift, marlaDefinition, marlaDialogue, playerDefinition } from "../content/downtownStory";
import { EntityManager } from "../entities/EntityManager";
import type { Entity, Point } from "../entities/EntityManager";
import { GameView } from "../render/GameView";
import { DialogueSystem } from "../systems/DialogueSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { MissionSystem } from "../systems/MissionSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { SequenceDirector } from "../systems/SequenceDirector";
import { TriggerSystem } from "../systems/TriggerSystem";
import { TrafficSystem } from "../systems/TrafficSystem";
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
  private sequences = new SequenceDirector(this.director);
  private traffic = new TrafficSystem(downtownTraffic);
  private trafficBodies: RAPIER.RigidBody[];
  private player = this.entities.spawn("player", playerDefinition, downtown.spawns.player, .23);
  private npc = this.entities.spawn("marla-downtown", marlaDefinition, downtown.spawns.npc, Math.PI + .42);
  private view: GameView;
  private physics: RAPIER.World;
  private district: WorldManager;
  private movement: MovementSystem;
  private input: InputManager;
  private loop: GameLoop;
  private candidate: Entity | null = null;
  private money = 0;
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
    this.view.addActor(this.player);
    this.view.addActor(this.npc);
    this.view.addTraffic(this.traffic);
    this.trafficBodies = this.traffic.cars.map((car) => {
      const { x, z, yaw } = this.traffic.pose(car, 1);
      const { width, height, length } = car.spawn.model;
      const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(x, 0, z).setRotation(this.yawRotation(yaw)));
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, length / 2)
        .setTranslation(0, height / 2, 0), body);
      return body;
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
      this.money += money;
      this.complete = true;
      this.publishHud();
    });
    // Populate Rapier's query data before the first movement and camera casts.
    this.physics.step();
    this.loop = new GameLoop(this.advance, this.render, () => this.director.policy.physics);
    this.loop.start();
    this.publishHud();
  }

  togglePause(): void {
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.input.dispose();
    this.mission.dispose();
    this.events.clear();
    this.movement.dispose();
    for (const body of this.trafficBodies) this.physics.removeRigidBody(body);
    this.district.dispose();
    this.physics.free();
    this.view.dispose();
    this.entities.clear();
  }

  private advance = (dt: number): void => {
    const { policy } = this.director;
    if (policy.walk) {
      this.view.rig.look(...this.input.takeLook());
      this.movement.prepare(dt, {
        forward: Number(this.input.down("KeyW")) - Number(this.input.down("KeyS")),
        strafe: Number(this.input.down("KeyD")) - Number(this.input.down("KeyA")),
        sprint: this.input.down("ShiftLeft") || this.input.down("ShiftRight"),
        jump: this.input.take("Space"),
        heading: this.view.rig.heading,
      });
    }
    this.traffic.step(dt, this.player.position);
    this.traffic.cars.forEach((car, index) => {
      const { x, z, yaw } = this.traffic.pose(car, 1);
      const body = this.trafficBodies[index];
      body.setNextKinematicTranslation({ x, y: 0, z });
      body.setNextKinematicRotation(this.yawRotation(yaw));
    });
    this.physics.step();
    if (policy.walk) this.movement.commit(dt);
    this.triggers.update(this.player.position);
    this.candidate = policy.interact ? this.interaction.nearest(this.player.position, this.entities.all()) : null;
    if (this.input.take("KeyE") && this.candidate) this.interaction.use(this.candidate);
  };

  private render = (dt: number, alpha: number): void => {
    const { position } = this.player;
    const last = this.movement.previous;
    const interpolated = {
      x: last.x + (position.x - last.x) * alpha,
      y: last.y + (position.y - last.y) * alpha,
      z: last.z + (position.z - last.z) * alpha,
    };
    const { camera, walk } = this.director.policy;
    if (camera !== "hold") {
      const focusId = camera === "focus" ? this.sequences.focusId : undefined;
      const focus = focusId ? this.entities.get(focusId)?.position : undefined;
      this.view.rig.update(dt, interpolated, focus, this.castCameraRay);
    }
    this.view.updateTraffic(this.traffic, alpha);
    this.view.render(this.player, interpolated, walk ? this.movement.speed : 0, this.goal, camera === "hold" ? 0 : dt);
    if (import.meta.env.DEV && dt > 0) this.fps += (1 / dt - this.fps) * .09;
    this.hudElapsed += dt;
    if (this.hudElapsed >= .1) this.publishHud();
  };

  private yawRotation(yaw: number): RAPIER.Rotation {
    return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
  }

  private castCameraRay = (origin: Point, direction: Point, distance: number): number | undefined => {
    const hit = this.physics.castRay(new RAPIER.Ray(origin, direction), distance, true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.movement.collider);
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
      mission: current && { title: current.mission.title, objective: current.objective.text },
      dialogue: this.dialogue.view,
      prompt: this.director.policy.interact ? this.candidate?.definition.interaction?.prompt ?? null : null,
      goal: this.goal ?? null,
      player: this.player.position,
      yaw: this.player.yaw,
      money: this.money,
      complete: this.complete,
      locked: document.pointerLockElement === this.view.renderer.domElement,
      debug: import.meta.env.DEV && this.debug ? { fps: Math.round(this.fps) } : null,
    });
  }
}
