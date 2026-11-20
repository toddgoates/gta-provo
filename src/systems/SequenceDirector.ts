import type { GameDirector } from "../core/GameDirector";

export interface SceneSequence {
  mode: "dialogue" | "cutscene";
  focus: "subject";
}

export class SequenceDirector {
  private active: { sequence: SceneSequence; entityId: string } | null = null;

  constructor(private readonly director: GameDirector) {}

  get focusId(): string | undefined {
    return this.active?.sequence.focus === "subject" ? this.active.entityId : undefined;
  }

  begin(sequence: SceneSequence, entityId: string): boolean {
    if (this.active || !this.director.beginScene(sequence.mode)) return false;
    this.active = { sequence, entityId };
    return true;
  }

  end(): void {
    if (this.active && this.director.endScene(this.active.sequence.mode)) this.active = null;
  }
}
