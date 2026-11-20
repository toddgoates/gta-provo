import { describe, expect, it, vi } from "vitest";
import { downtown } from "../src/content/downtown";
import { firstShift, marlaDialogue, marlaDefinition } from "../src/content/downtownStory";
import { EventBus } from "../src/core/EventBus";
import { GameDirector } from "../src/core/GameDirector";
import { EntityManager } from "../src/entities/EntityManager";
import { DialogueSystem } from "../src/systems/DialogueSystem";
import { InteractionSystem } from "../src/systems/InteractionSystem";
import { MissionSystem } from "../src/systems/MissionSystem";
import { SequenceDirector } from "../src/systems/SequenceDirector";
import { TriggerSystem } from "../src/systems/TriggerSystem";
import type { MissionDefinition } from "../src/systems/MissionSystem";

const npcId = "marla-downtown";
const pavilion = downtown.locations[0];
const successor: MissionDefinition = {
  id: "successor", title: "Another errand", kind: "side", prerequisites: [firstShift.id],
  objectives: [{ text: "Try again", when: { event: "interaction:used", where: { entityId: npcId } } }],
};

describe("missions", () => {
  it("requires the right events in order, pays once, and unlocks prerequisites", () => {
    const events = new EventBus();
    const missions = new MissionSystem(events, [firstShift, successor]);
    const triggers = new TriggerSystem(events, downtown.locations);
    const finished = vi.fn();
    const flag = vi.fn();
    events.on("mission:completed", finished);
    events.on("world:flag-set", flag);
    expect(missions.start(successor.id)).toBe(false);
    expect(missions.start(firstShift.id)).toBe(true);
    triggers.update(pavilion.position);
    events.emit("interaction:used", { entityId: "someone-else" });
    expect(missions.snapshot().active?.objectiveIndex).toBe(0);
    events.emit("interaction:used", { entityId: npcId });
    events.emit("dialogue:completed", { dialogueId: marlaDialogue.id, npcId: "someone-else" });
    expect(missions.snapshot().active?.objectiveIndex).toBe(1);
    events.emit("dialogue:completed", { dialogueId: marlaDialogue.id, npcId });
    triggers.update(pavilion.position); // Still inside; no second entry.
    expect(missions.current?.objective.locationId).toBe(pavilion.id);
    triggers.update(downtown.spawns.player);
    triggers.update(pavilion.position);
    triggers.update(pavilion.position);
    expect(missions.snapshot()).toEqual({ completed: [firstShift.id], active: null });
    expect(finished).toHaveBeenCalledExactlyOnceWith({ missionId: firstShift.id, money: 15 });
    expect(flag).toHaveBeenCalledExactlyOnceWith({ flag: "chair-confirmed", value: true });
    expect(missions.start(firstShift.id)).toBe(false);
    expect(missions.start(successor.id)).toBe(true);
  });

  it("restores objective progress and detaches listeners on disposal", () => {
    const events = new EventBus();
    const missions = new MissionSystem(events, [firstShift, successor]);
    missions.restore({ completed: [], active: { id: successor.id, objectiveIndex: 0 } });
    expect(missions.current).toBeNull();
    missions.restore({ completed: [], active: { id: firstShift.id, objectiveIndex: 1 } });
    expect(missions.current?.objective.when.event).toBe("dialogue:completed");
    events.emit("dialogue:completed", { dialogueId: marlaDialogue.id, npcId });
    expect(missions.snapshot().active?.objectiveIndex).toBe(2);
    missions.dispose();
    events.emit("location:entered", { locationId: pavilion.id });
    expect(missions.snapshot().completed).toEqual([]);
  });

  it("does not advance two consecutive objectives on a single emitted event", () => {
    const events = new EventBus();
    const objective = successor.objectives[0];
    const missions = new MissionSystem(events, [{ ...successor, prerequisites: [], objectives: [objective, objective] }]);
    missions.start(successor.id);
    events.emit("interaction:used", { entityId: npcId });
    expect(missions.snapshot().active?.objectiveIndex).toBe(1);
  });
});

describe("dialogue and modes", () => {
  it("branches, emits choice actions and finishes only after the last subtitle", () => {
    const events = new EventBus();
    const dialogue = new DialogueSystem(events, () => false);
    const flag = vi.fn();
    const choice = vi.fn();
    const finish = vi.fn();
    events.on("world:flag-set", flag);
    events.on("dialogue:choice", choice);
    events.on("dialogue:completed", finish);
    expect(dialogue.start(marlaDialogue, npcId)).toBe(true);
    expect(dialogue.advance("unknown")).toBe(false);
    expect(dialogue.advance()).toBe(false);
    expect(dialogue.advance("soda")).toBe(true);
    expect(dialogue.view?.nodeId).toBe("soda");
    expect(choice).toHaveBeenCalledExactlyOnceWith({ dialogueId: marlaDialogue.id, choiceId: "soda" });
    expect(flag).toHaveBeenCalledExactlyOnceWith({ flag: "asked-about-soda", value: true });
    expect(dialogue.advance()).toBe(true);
    expect(dialogue.view?.nodeId).toBe("receipt");
    expect(finish).not.toHaveBeenCalled();
    expect(dialogue.advance()).toBe(true);
    expect(dialogue.view).toBeNull();
    expect(finish).toHaveBeenCalledExactlyOnceWith({ dialogueId: marlaDialogue.id, npcId });
  });

  it("does not expose or accept unavailable choices", () => {
    const dialogue = new DialogueSystem(new EventBus(), () => false);
    dialogue.start({
      id: "conditional", start: "first",
      nodes: { first: { speaker: "Marla", text: "Hi", choices: [{ id: "secret", text: "Secret", when: { flag: "knows-secret", equals: true } }] } },
    }, npcId);
    expect(dialogue.view?.choices).toEqual([]);
    expect(dialogue.advance("secret")).toBe(false);
    expect(dialogue.advance()).toBe(true);
  });

  it("pauses a dialogue scene and restores its previous gameplay mode after completion", () => {
    const director = new GameDirector();
    const sequences = new SequenceDirector(director);
    expect(director.setFreeMode("interior")).toBe(true);
    expect(sequences.begin({ mode: "dialogue", focus: "subject" }, npcId)).toBe(true);
    expect(director.policy).toMatchObject({ walk: false, interact: false, camera: "focus" });
    expect(director.setFreeMode("driving")).toBe(false);
    director.pause();
    sequences.end();
    expect(director.mode).toBe("paused");
    expect(director.policy.physics).toBe(false);
    director.resume();
    expect(director.mode).toBe("dialogue");
    expect(sequences.focusId).toBe(npcId);
    sequences.end();
    expect(director.mode).toBe("interior");
    expect(director.policy.walk).toBe(true);
  });
});

it("selects the closest enabled interactable and emits its stable instance ID", () => {
  const events = new EventBus();
  const entities = new EntityManager();
  const interaction = new InteractionSystem(events);
  const origin = { x: 0, y: 0, z: 0 };
  entities.spawn("far", marlaDefinition, { ...origin, x: 20 });
  entities.spawn("other", marlaDefinition, { ...origin, x: 2 });
  entities.spawn("disabled", marlaDefinition, origin).enabled = false;
  const nearest = entities.spawn(npcId, marlaDefinition, { ...origin, x: 1 });
  expect(interaction.nearest(origin, entities.all())).toBe(nearest);
  const listener = vi.fn();
  events.on("interaction:used", listener);
  interaction.use(nearest);
  expect(listener).toHaveBeenCalledExactlyOnceWith({ entityId: npcId });
});
