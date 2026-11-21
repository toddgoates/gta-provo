import { describe, expect, it } from "vitest";
import { AudioSystem } from "../src/systems/AudioSystem";

class FakeAudio extends EventTarget {
  volume = 1;
  loop = false;
  muted = false;
  started = 0;
  paused = true;
  released = false;
  denied = false;
  play() {
    this.started++;
    if (this.denied) return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  removeAttribute(name: string) { this.released = name === "src"; }
  load() {}
}

const setup = () => {
  const clips = new Map<string, FakeAudio>();
  const audio = new AudioSystem((url) => {
    const media = new FakeAudio();
    clips.set(url, media);
    return media as unknown as HTMLAudioElement;
  });
  return { audio, clip: (url: string) => clips.get(url)! };
};

describe("audio mixer", () => {
  it("waits for a gesture, then layers and ducks without stopping ambience", () => {
    const { audio, clip } = setup();
    audio.play({ url: "city", channel: "ambience", loop: true });
    expect(clip("city").started).toBe(0);
    expect(clip("city").loop).toBe(true);
    audio.unlock();
    audio.play({ url: "music", channel: "music", loop: true });
    audio.play({ url: "line", channel: "voice" });
    audio.play({ url: "step", channel: "sfx" });
    audio.play({ url: "horn", channel: "sfx" });
    for (const id of ["city", "music", "line", "step", "horn"]) expect(clip(id).paused).toBe(false);

    const cityVolume = clip("city").volume;
    const musicVolume = clip("music").volume;
    audio.setDialogue(true);
    audio.update(.16);
    expect(clip("city").volume).toBeLessThan(cityVolume);
    expect(clip("music").volume).toBeLessThan(musicVolume);
    expect(clip("step").volume).toBe(.8);
    expect(clip("city").started).toBe(1);
    audio.setDialogue(false);
    audio.update(2);
    expect(clip("city").volume).toBeCloseTo(cityVolume, 3);
  });

  it("pauses and resumes, cleans finished clips, and releases tracks on teardown", () => {
    const { audio, clip } = setup();
    audio.unlock();
    audio.play({ url: "city", channel: "ambience", loop: true });
    audio.play({ url: "first", channel: "voice" });
    audio.play({ url: "second", channel: "voice" });
    expect(clip("first").released).toBe(true);
    audio.setPaused(true);
    expect(clip("city").paused).toBe(true);
    audio.setPaused(false);
    expect(clip("city").started).toBe(2);
    clip("second").dispatchEvent(new Event("ended"));
    expect(clip("second").released).toBe(true);
    clip("city").dispatchEvent(new Event("error"));
    expect(clip("city").released).toBe(true);
    audio.play({ url: "step", channel: "sfx" });
    audio.dispose();
    expect(clip("step").released).toBe(true);
  });

  it("retries browser-blocked playback on a later gesture", async () => {
    const { audio, clip } = setup();
    audio.play({ url: "city", channel: "ambience" });
    clip("city").denied = true;
    audio.unlock();
    await Promise.resolve();
    clip("city").denied = false;
    audio.unlock();
    expect(clip("city").started).toBe(2);
    expect(clip("city").paused).toBe(false);
  });
});
