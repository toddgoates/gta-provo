import type { EventBus, GameEvents } from "../core/EventBus";

export type EventMatch = {
  [K in keyof GameEvents]: { event: K; where: Partial<GameEvents[K]> };
}[keyof GameEvents];

export interface MissionDefinition {
  id: string;
  title: string;
  kind: "main" | "side";
  prerequisites?: readonly string[];
  objectives: readonly { text: string; when: EventMatch; locationId?: string }[];
  reward?: { money?: number; flags?: readonly string[] };
}

export interface MissionProgress {
  completed: string[];
  active: { id: string; objectiveIndex: number } | null;
}

export class MissionSystem {
  private definitions: Map<string, MissionDefinition>;
  private completed = new Set<string>();
  private active: MissionProgress["active"] = null;
  private unbind?: () => void;

  constructor(private readonly events: EventBus, definitions: readonly MissionDefinition[]) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  available(id: string): boolean {
    const definition = this.definitions.get(id);
    return !!definition?.objectives.length && !this.active && !this.completed.has(id)
      && (definition.prerequisites ?? []).every((previous) => this.completed.has(previous));
  }

  start(id: string): boolean {
    if (!this.available(id)) return false;
    this.active = { id, objectiveIndex: 0 };
    this.bind();
    return true;
  }

  get current() {
    if (!this.active) return null;
    const mission = this.definitions.get(this.active.id)!;
    return { mission, objective: mission.objectives[this.active.objectiveIndex] };
  }

  snapshot(): MissionProgress {
    return { completed: [...this.completed], active: this.active && { ...this.active } };
  }

  restore(progress: MissionProgress): void {
    this.unbind?.();
    this.completed = new Set(progress.completed.filter((id) => this.definitions.has(id)));
    this.active = null;
    const active = progress.active;
    if (active && this.available(active.id)
      && Number.isInteger(active.objectiveIndex)
      && this.definitions.get(active.id)?.objectives[active.objectiveIndex]) {
      this.active = { ...active };
    }
    this.bind();
  }

  dispose(): void { this.unbind?.(); }

  private bind(): void {
    this.unbind?.();
    const current = this.current;
    if (!current) return;
    const { event, where } = current.objective.when;
    this.unbind = this.events.on(event, (payload) => {
      if (!Object.entries(where).every(([key, value]) => Reflect.get(payload, key) === value)) return;
      const active = this.active!;
      if (++active.objectiveIndex < current.mission.objectives.length) {
        this.bind();
        return;
      }
      const { id, reward } = current.mission;
      this.completed.add(id);
      this.active = null;
      this.unbind?.();
      for (const flag of reward?.flags ?? []) this.events.emit("world:flag-set", { flag, value: true });
      this.events.emit("mission:completed", { missionId: id, money: reward?.money ?? 0 });
    });
  }
}
