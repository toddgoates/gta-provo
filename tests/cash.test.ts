import { expect, it } from "vitest";
import { EventBus } from "../src/core/EventBus";
import { CashSystem } from "../src/systems/CashSystem";

const point = { x: 3, y: .15, z: 5 };
const hit = { id: "strike-1", offenderId: "player", victimId: "npc", position: point, knockedOut: true };

it("starts at zero and creates a single pickup for a player knockout", () => {
  const events = new EventBus();
  const cash = new CashSystem(events, "player", () => .1);
  expect(cash.money).toBe(0);
  events.emit("combat:hit", { ...hit, knockedOut: false });
  events.emit("combat:hit", { ...hit, offenderId: "npc-2" });
  expect([...cash.pickups]).toHaveLength(0);
  events.emit("combat:hit", hit);
  events.emit("combat:hit", hit);
  expect([...cash.pickups]).toHaveLength(1);
  expect(cash.money).toBe(0);
  expect(cash.step(.2, point)).toBe(false);
  expect(cash.step(.2, { ...point, x: 5 })).toBe(false);
  expect(cash.step(.2, { ...point, y: 3 })).toBe(false);
  expect(cash.step(.1, point)).toBe(true);
  expect(cash.money).toBe(10);
  expect([...cash.pickups]).toHaveLength(0);
  events.emit("combat:hit", hit);
  expect(cash.step(1, point)).toBe(false);
  expect(cash.money).toBe(10);
});

it("adds mission earnings to the same wallet and resets on a fresh session", () => {
  const events = new EventBus();
  const cash = new CashSystem(events, "player", () => .1);
  events.emit("mission:completed", { missionId: "demo", money: 15 });
  events.emit("combat:hit", hit);
  cash.step(1, point);
  expect(cash.money).toBe(25);
  cash.dispose();
  const fresh = new CashSystem(events, "player");
  expect(fresh.money).toBe(0);
  expect([...fresh.pickups]).toHaveLength(0);
});

it.each([[0, 0, 1], [.899, .999, 99], [.9, 0, 100], [.999, .999, 300]])(
  "maps tier roll %s and amount roll %s to $%i",
  (tier, roll, amount) => {
    const events = new EventBus();
    const samples = [tier, roll];
    const cash = new CashSystem(events, "player", () => samples.shift()!);
    events.emit("combat:hit", hit);
    expect([...cash.pickups][0].amount).toBe(amount);
  },
);
