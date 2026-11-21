/** Paths are relative to public/, without a leading slash. */
export const cityAmbiencePath = "audio/ambience/city-ambience-1.mp3";
export const cashPickupPath = "audio/sfx/chaching.mp3";

export const localAudioUrl = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
