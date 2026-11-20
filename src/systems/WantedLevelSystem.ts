import { crimeRules, wantedConfig } from "../content/police";
import type { CrimeKind } from "./CrimeSystem";

export type WantedLevel = 0 | 1 | 2 | 3 | 4 | 5;

export class WantedLevelSystem {
  private score = 0;
  private current: WantedLevel = 0;
  private remaining: number;

  constructor(private readonly changed: () => void = () => {}, private readonly decaySeconds: number = wantedConfig.decaySeconds) {
    this.remaining = decaySeconds;
  }

  get level(): WantedLevel { return this.current; }
  get timeToDecay(): number { return this.current ? this.remaining : 0; }

  report(kind: CrimeKind): void {
    const { minimum, score } = crimeRules[kind];
    const thresholds = wantedConfig.thresholds;
    this.score = Math.min(thresholds[5], Math.max(thresholds[minimum], this.score + score));
    this.remaining = this.decaySeconds;
    const next = thresholds.findLastIndex((threshold) => this.score >= threshold) as WantedLevel;
    this.update(Math.max(next, minimum) as WantedLevel);
  }

  step(dt: number, seen: boolean): void {
    if (!this.current) return;
    if (seen) { this.remaining = this.decaySeconds; return; }
    this.remaining -= dt;
    if (this.remaining <= 0) this.setLevel((this.current - 1) as WantedLevel);
  }

  setLevel(level: WantedLevel): void {
    this.score = wantedConfig.thresholds[level];
    this.remaining = this.decaySeconds;
    this.update(level);
  }

  reset(): void { this.setLevel(0); }

  private update(level: WantedLevel): void {
    if (this.current === level) return;
    this.current = level;
    this.changed();
  }
}
