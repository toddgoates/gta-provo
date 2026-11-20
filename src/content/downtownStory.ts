import type { EntityDefinition } from "../entities/EntityManager";
import type { DialogueDefinition } from "../systems/DialogueSystem";
import type { MissionDefinition } from "../systems/MissionSystem";
import type { SceneSequence } from "../systems/SequenceDirector";
import { localAppearance, marlaAppearance } from "./characters/wardrobe";

export const playerDefinition: EntityDefinition = {
  id: "local", name: "The New Local", kind: "player", modelId: "local-proxy",
  appearance: localAppearance,
};
export const marlaDefinition: EntityDefinition = {
  id: "marla", name: "Marla", kind: "npc", modelId: "marla-proxy",
  appearance: marlaAppearance,
  interaction: { kind: "dialogue", dialogueId: "marla-first-shift", prompt: "Talk to Marla", range: 2.9 },
};
export const dialogueCamera: SceneSequence = { mode: "dialogue", focus: "subject" };

export const marlaDialogue: DialogueDefinition = {
  id: "marla-first-shift",
  start: "hello",
  nodes: {
    hello: {
      speaker: "Marla Jensen",
      text: "You look like someone who can cross University without starting a neighborhood Facebook thread. I have a job for you.",
      choices: [
        { id: "accept", text: "What’s the job?", next: "receipt" },
        { id: "soda", text: "Is this about the soda shop?", next: "soda", setFlag: { flag: "asked-about-soda", equals: true } },
      ],
    },
    soda: {
      speaker: "Marla Jensen",
      text: "Everything is about the soda shop eventually. This particular emergency is about a folding chair.",
      next: "receipt",
    },
    receipt: {
      speaker: "Marla Jensen",
      text: "Go to the golden marker by the Welcome Pavilion. I need a witness that the chair is there before the committee votes on whether it exists.",
    },
  },
};

export const firstShift: MissionDefinition = {
  id: "municipal-errand", title: "A Minor Civic Emergency", kind: "main",
  objectives: [
    { text: "Find Marla by the Soda Dept. and talk to her.", when: { event: "interaction:used", where: { entityId: "marla-downtown" } } },
    { text: "Finish talking with Marla.", when: { event: "dialogue:completed", where: { dialogueId: marlaDialogue.id, npcId: "marla-downtown" } } },
    { text: "Reach the Welcome Pavilion across University Ave.", locationId: "welcome-pavilion", when: { event: "location:entered", where: { locationId: "welcome-pavilion" } } },
  ],
  reward: { money: 15, flags: ["chair-confirmed"] },
};
