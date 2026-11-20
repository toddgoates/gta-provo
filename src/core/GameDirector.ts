export type GameMode = "exploration" | "driving" | "dialogue" | "cutscene" | "interior" | "paused" | "dead";
type ActiveMode = Exclude<GameMode, "paused" | "dead">;
type FreeMode = "exploration" | "driving" | "interior";
type SceneMode = "dialogue" | "cutscene";

const policies = {
  exploration: { physics: true, walk: true, drive: false, interact: true, camera: "follow" },
  interior: { physics: true, walk: true, drive: false, interact: true, camera: "follow" },
  driving: { physics: true, walk: false, drive: true, interact: false, camera: "vehicle" },
  dialogue: { physics: false, walk: false, drive: false, interact: false, camera: "focus" },
  cutscene: { physics: false, walk: false, drive: false, interact: false, camera: "focus" },
  paused: { physics: false, walk: false, drive: false, interact: false, camera: "hold" },
  dead: { physics: false, walk: false, drive: false, interact: false, camera: "hold" },
} as const;

export class GameDirector {
  private active: ActiveMode = "exploration";
  private returnTo: FreeMode = "exploration";
  private paused = false;
  private dead = false;

  get mode(): GameMode { return this.dead ? "dead" : this.paused ? "paused" : this.active; }
  get policy() { return policies[this.mode]; }

  setFreeMode(mode: FreeMode): boolean {
    if (this.dead || this.paused || this.active === "dialogue" || this.active === "cutscene") return false;
    this.active = mode;
    return true;
  }

  beginScene(mode: SceneMode): boolean {
    if (this.dead || this.paused || this.active === "dialogue" || this.active === "cutscene") return false;
    this.returnTo = this.active;
    this.active = mode;
    return true;
  }

  endScene(mode: SceneMode): boolean {
    if (this.dead || this.paused || this.active !== mode) return false;
    this.active = this.returnTo;
    return true;
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  die(): void { this.dead = true; }
}
