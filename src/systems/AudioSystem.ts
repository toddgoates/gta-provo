/** An adapter can implement this when the first audio assets are added. */
export interface GameAudio {
  play(request: { url: string; channel: "voice" | "music" | "ambience" | "sfx"; loop?: boolean }): void;
  stop(channel: "voice" | "music" | "ambience" | "sfx"): void;
  dispose(): void;
}
