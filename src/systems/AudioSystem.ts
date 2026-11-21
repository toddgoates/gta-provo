export type AudioChannel = "voice" | "music" | "ambience" | "sfx";
export interface AudioRequest { url: string; channel: AudioChannel; loop?: boolean; gain?: number }

const baseVolumes: Record<AudioChannel, number> = { voice: .95, music: .46, ambience: .42, sfx: .8 };
const duckVolumes: Record<AudioChannel, number> = { voice: 1, music: .54, ambience: .38, sfx: 1 };
const fadeTime = .16;

interface Track {
  request: AudioRequest;
  media: HTMLAudioElement;
  volume: number;
  blocked: boolean;
}

/** Layered media playback. Long-running tracks stream instead of decoding into memory. */
export class AudioSystem {
  private tracks = new Set<Track>();
  private unlocked = false;
  private paused = false;
  private ducking = false;
  private muted = false;
  private disposed = false;

  constructor(private readonly createMedia: (url: string) => HTMLAudioElement = (url) => {
    const media = document.createElement("audio");
    media.preload = "none";
    media.src = url;
    return media;
  }) {}

  play(request: AudioRequest): void {
    if (this.disposed) return;
    if (request.channel !== "sfx") this.stop(request.channel);
    const media = this.createMedia(request.url);
    const track = { request, media, volume: this.targetVolume(request), blocked: false };
    media.preload = "none";
    media.loop = !!request.loop;
    media.volume = track.volume;
    media.muted = this.muted;
    media.addEventListener("ended", () => this.release(track), { once: true });
    media.addEventListener("error", () => this.release(track), { once: true });
    this.tracks.add(track);
    if (this.unlocked && !this.paused) this.start(track);
  }

  unlock(): void {
    if (this.disposed) return;
    const first = !this.unlocked;
    this.unlocked = true;
    if (!this.paused) for (const track of this.tracks) if (first || track.blocked) this.start(track);
  }

  stop(channel: AudioChannel): void {
    for (const track of this.tracks) if (track.request.channel === channel) this.release(track);
  }

  stopAll(): void {
    for (const track of this.tracks) this.release(track);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused || this.disposed) return;
    this.paused = paused;
    for (const track of this.tracks) {
      if (paused) track.media.pause();
      else if (this.unlocked) this.start(track);
    }
  }

  setDialogue(active: boolean): void { this.ducking = active; }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.tracks) track.media.muted = muted;
  }

  update(dt: number): void {
    const weight = 1 - Math.exp(-dt / fadeTime);
    for (const track of this.tracks) {
      const target = this.targetVolume(track.request);
      const next = Math.abs(target - track.volume) < .001 ? target : track.volume + (target - track.volume) * weight;
      if (next !== track.volume) track.media.volume = track.volume = next;
    }
  }

  dispose(): void {
    this.stopAll();
    this.disposed = true;
  }

  private targetVolume({ channel, gain = 1 }: AudioRequest): number {
    return Math.max(0, Math.min(1, baseVolumes[channel] * gain * (this.ducking ? duckVolumes[channel] : 1)));
  }

  private start(track: Track): void {
    track.blocked = false;
    void track.media.play().catch((error: DOMException) => {
      if (error.name === "NotAllowedError") track.blocked = true;
      else if (error.name !== "AbortError") this.release(track);
    });
  }

  private release(track: Track): void {
    if (!this.tracks.delete(track)) return;
    track.media.pause();
    track.media.removeAttribute("src");
    track.media.load();
  }
}
