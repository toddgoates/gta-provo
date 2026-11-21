import { expect, it, vi } from "vitest";
import { EventBus } from "../src/core/EventBus";
import type { CrimeIncident } from "../src/core/EventBus";
import { EntityManager } from "../src/entities/EntityManager";
import { CrimeSystem } from "../src/systems/CrimeSystem";
import { WantedLevelSystem } from "../src/systems/WantedLevelSystem";
import { PoliceResponseSystem } from "../src/systems/PoliceResponseSystem";
import { policeConfig } from "../src/content/police";
import { reinforcementLooks } from "../src/content/police";
import { downtownPedestrians } from "../src/content/pedestrians";

const origin = { x: 0, y: 0, z: 0 };
const npc = { id: "npc", kind: "npc", modelId: "proxy", name: "NPC" } as const;
const police = { ...npc, id: "police", faction: "police" } as const;

it("includes different officer silhouettes in both the foot patrols and reinforcements", () => {
  const patrols = downtownPedestrians.filter(({ faction }) => faction === "police");
  expect(patrols.some(({ appearance }) => appearance?.silhouette === "tapered")).toBe(true);
  expect(patrols.some(({ appearance }) => appearance && !appearance.silhouette)).toBe(true);
  expect(reinforcementLooks.some(({ silhouette }) => silhouette === "tapered")).toBe(true);
  expect(reinforcementLooks.some(({ silhouette }) => !silhouette)).toBe(true);
});

it("only counts player crimes witnessed by a conscious nearby officer with a clear view", () => {
  const events = new EventBus();
  const entities = new EntityManager();
  const officer = entities.spawn("cop", police, { ...origin, x: 22 });
  const victim = entities.spawn("npc", npc, origin);
  let conscious = true, clear = true;
  const detected = vi.fn();
  const crimes = new CrimeSystem(events, "player", {
    findEntity: (id) => entities.get(id), officers: () => [officer], conscious: () => conscious,
    clearSight: () => clear, radius: 14, detected,
  });
  let id = 0;
  const hit = (offenderId = "player", victimId = victim.id, knockedOut = false) => events.emit("combat:hit", {
    id: `strike-${++id}`, victimId, offenderId, position: origin, knockedOut,
  });
  hit();
  officer.position = { ...origin, x: 4 };
  clear = false; hit();
  clear = true; conscious = false; hit();
  conscious = true; hit("someone-else");
  expect(detected).not.toHaveBeenCalled();
  hit();
  expect(detected).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "civilian:assaulted", witnessIds: ["cop"] }));
  clear = false;
  hit("player", officer.id);
  expect(detected).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "police:assaulted" }));
  conscious = false; // The lethal hit itself just made the active officer unconscious.
  hit("player", officer.id, true);
  expect(detected).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "police:knocked_out" }));
  crimes.dispose();
  hit("player", officer.id, true);
  expect(detected).toHaveBeenCalledTimes(3);
});

it("grades witnessed vehicle hits more severely if the impact is fatal", () => {
  const events = new EventBus();
  const entities = new EntityManager();
  const officer = entities.spawn("cop", police, { ...origin, x: 8 });
  const victim = entities.spawn("ped", npc, origin);
  const wanted = new WantedLevelSystem();
  let clear = false;
  new CrimeSystem(events, "player", {
    findEntity: (id) => entities.get(id), officers: () => [officer], conscious: () => true,
    clearSight: () => clear, radius: 14, detected: ({ kind }) => wanted.report(kind),
  });
  const incident = { offenderId: "player", victimId: victim.id, position: origin, source: "vehicle" as const };
  events.emit("combat:hit", { ...incident, id: "unseen", knockedOut: false });
  expect(wanted.level).toBe(0);
  clear = true;
  events.emit("combat:hit", { ...incident, id: "slow", knockedOut: false });
  expect(wanted.level).toBe(1);
  events.emit("combat:hit", { ...incident, id: "fast", knockedOut: true });
  expect(wanted.level).toBe(3);
});

it("counts a knockout once even if an overlapping event repeats the incident ID", () => {
  const events = new EventBus();
  const entities = new EntityManager();
  const officer = entities.spawn("cop", police, origin);
  const victim = entities.spawn("npc", npc, origin);
  const detected = vi.fn();
  new CrimeSystem(events, "player", {
    findEntity: (id) => entities.get(id), officers: () => [officer], conscious: () => true,
    clearSight: () => true, radius: 14, detected,
  });
  const incident: CrimeIncident = { id: "same-strike", offenderId: "player", victimId: victim.id, position: origin };
  events.emit("combat:hit", { ...incident, knockedOut: true });
  events.emit("civilian:assaulted", incident);
  events.emit("civilian:knocked_out", incident);
  expect(detected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: "civilian:knocked_out" }));
});

it("applies minimum levels and escalates repeated detected offenses", () => {
  for (const [kind, minimum] of [
    ["civilian:assaulted", 1], ["civilian:knocked_out", 2], ["police:assaulted", 2], ["police:knocked_out", 3],
    ["vehicle:stolen", 1],
  ] as const) {
    const wanted = new WantedLevelSystem();
    wanted.report(kind);
    expect(wanted.level).toBe(minimum);
  }
  const wanted = new WantedLevelSystem();
  for (let i = 0; i < 8; i++) wanted.report("civilian:assaulted");
  expect(wanted.level).toBe(3);
  for (let i = 0; i < 12; i++) wanted.report("police:assaulted");
  expect(wanted.level).toBe(5);
});

it("requires uninterrupted loss of sight, decaying one dot at a time", () => {
  const changed = vi.fn();
  const wanted = new WantedLevelSystem(changed, 20);
  wanted.setLevel(3);
  wanted.step(19, false);
  expect(wanted.timeToDecay).toBe(1);
  wanted.step(10, true);
  expect(wanted.timeToDecay).toBe(20);
  for (const level of [2, 1, 0]) {
    wanted.step(20, false);
    expect(wanted.level).toBe(level);
  }
  expect(wanted.timeToDecay).toBe(0);
  expect(changed).toHaveBeenCalledTimes(4);
});

function makeResponse() {
  const wanted = new WantedLevelSystem();
  const entities = new EntityManager();
  const patrol = entities.spawn("patrol", police, { ...origin, x: 6 });
  const defeated = new Set<string>();
  let sequence = 0, seen = true;
  const response = new PoliceResponseSystem(wanted, {
    officers: () => [...entities.all()],
    active: (id) => !defeated.has(id),
    clearSight: () => seen,
    clearRoute: () => true,
    isOnScreen: (point) => point.x > 0,
    canSpawnAt: () => true,
    spawn: (point) => entities.spawn(`reserve-${++sequence}`, police, point),
    remove: (id) => entities.remove(id),
  }, [9, 15, 20, -17, -22, -27, -32, -36].map((x) => ({ ...origin, x })));
  return { wanted, entities, patrol, defeated, response, hide: () => { seen = false; }, spawns: () => sequence };
}

it("recruits patrols first, then spawns out of view with cooldowns and a response cap", () => {
  const { response, wanted, patrol, spawns, defeated, entities } = makeResponse();
  expect(response.step(.1, origin).size).toBe(0);
  wanted.setLevel(1);
  expect(response.step(.1, origin).get(patrol.id)?.attack).toBe(true);
  expect(spawns()).toBe(0);
  wanted.setLevel(5);
  response.step(.1, origin);
  expect(spawns()).toBe(1);
  expect(entities.get("reserve-1")?.position.x).toBeLessThanOrEqual(-policeConfig.spawnMinDistance);
  response.step(.1, origin);
  expect(spawns()).toBe(1);
  for (let i = 0; i < 10; i++) response.step(policeConfig.spawnCooldown, origin);
  expect(response.count).toBe(4);
  expect(spawns()).toBe(3);
  defeated.add("reserve-1");
  response.step(policeConfig.spawnCooldown, origin);
  expect(response.count).toBe(4);
  expect(spawns()).toBe(4);
});

it("searches last known position and clears responders and temporary officers on death", () => {
  const { response, wanted, patrol, hide, entities, spawns } = makeResponse();
  wanted.setLevel(3);
  response.step(.1, origin);
  hide();
  const hidden = { ...origin, z: 10 };
  const order = response.step(.2, hidden).get(patrol.id);
  expect(order).toEqual({ destination: origin, attack: false });
  response.reset();
  expect(wanted.level).toBe(0);
  expect(response.count).toBe(0);
  expect(response.visible).toBe(false);
  expect([...entities.all()].map(({ id }) => id)).toEqual(["patrol"]);
  const before = spawns();
  response.step(100, hidden);
  expect(spawns()).toBe(before);
  wanted.setLevel(1);
  expect(response.step(.1, origin).has(patrol.id)).toBe(true);
});
