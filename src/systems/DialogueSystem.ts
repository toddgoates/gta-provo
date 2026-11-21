import type { EventBus } from "../core/EventBus";

export type FlagCondition = { flag: string; equals: boolean };
type Choice = { id: string; text: string; next?: string; when?: FlagCondition; setFlag?: FlagCondition };
export interface DialogueDefinition {
  id: string;
  start: string;
  nodes: Record<string, { speaker: string; text: string; audio?: string; next?: string; choices?: readonly Choice[] }>;
}

export class DialogueSystem {
  private active: { definition: DialogueDefinition; nodeId: string; npcId: string } | null = null;

  constructor(private readonly events: EventBus, private readonly readFlag: (flag: string) => boolean) {}

  get currentAudio(): string | undefined {
    return this.active?.definition.nodes[this.active.nodeId].audio;
  }

  start(definition: DialogueDefinition, npcId: string): boolean {
    if (this.active || !definition.nodes[definition.start]) return false;
    this.active = { definition, nodeId: definition.start, npcId };
    return true;
  }

  get view() {
    if (!this.active) return null;
    const { definition, nodeId } = this.active;
    const node = definition.nodes[nodeId];
    const choices = (node.choices ?? []).filter(({ when }) => !when || this.readFlag(when.flag) === when.equals);
    return { nodeId, speaker: node.speaker, text: node.text, choices, ends: !node.next && !choices.length };
  }

  advance(choiceId?: string): boolean {
    if (!this.active) return false;
    const { definition, nodeId, npcId } = this.active;
    const choices = this.view!.choices;
    const choice = choices.find(({ id }) => id === choiceId);
    if ((choices.length > 0 || choiceId !== undefined) && !choice) return false;
    const next = choice ? choice.next : definition.nodes[nodeId].next;
    if (next !== undefined && !definition.nodes[next]) throw new Error(`Unknown dialogue node ${definition.id}:${next}`);
    if (choice) {
      this.events.emit("dialogue:choice", { dialogueId: definition.id, choiceId: choice.id });
      if (choice.setFlag) {
        this.events.emit("world:flag-set", { flag: choice.setFlag.flag, value: choice.setFlag.equals });
      }
    }
    if (next !== undefined) this.active.nodeId = next;
    else {
      this.active = null;
      this.events.emit("dialogue:completed", { dialogueId: definition.id, npcId });
    }
    return true;
  }
}
