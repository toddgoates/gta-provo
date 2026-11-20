import type { Point } from "../entities/EntityManager";
import type { CharacterAppearance } from "../entities/Appearance";

export const wantedConfig = {
  thresholds: [0, 1, 4, 8, 14, 22],
  decaySeconds: 20,
} as const;

export const policeConfig = {
  response: [0, 1, 2, 4, 4, 4],
  maxResponders: 4,
  maxReinforcements: 5,
  witnessRadius: 14,
  sightRadius: 19,
  recruitRadius: 36,
  spawnCooldown: 3.5,
  spawnMinDistance: 13,
  spawnMaxDistance: 49,
  searchSeconds: 8,
  investigateSeconds: 3,
  repathSeconds: .55,
} as const;

export const crimeRules = {
  "civilian:assaulted": { minimum: 1, score: 1, direct: false },
  "civilian:knocked_out": { minimum: 2, score: 3, direct: false },
  "police:assaulted": { minimum: 2, score: 2, direct: true },
  "police:knocked_out": { minimum: 3, score: 4, direct: true },
  "vehicle:stolen": { minimum: 1, score: 1, direct: false },
} as const;

export const reinforcementPoints: readonly Point[] = [
  [-46, 11.5], [-25, 11.5], [-10.5, 36], [-10.5, 47], [-46, -11.5], [-23, -11.5],
  [-10.5, -38], [-10.5, -48], [10.5, -47], [10.5, -34], [23, -11.5], [47, -11.5],
  [46, 11.5], [29, 11.5], [10.5, 35], [10.5, 47], [-53, 17], [56, 22],
].map(([x, z]) => ({ x, y: .15, z }));

const uniform = { top: "police-uniform", bottoms: "police-trousers", shoes: "dark-sneakers" } as const;
export const policeAppearances = {
  ramirez: {
    skin: 0xbf8868, hair: 0x38252b, eyes: 0x533926, haircut: "ponytail",
    silhouette: "tapered", defaultWardrobe: uniform,
  },
  jensen: {
    skin: 0xc68c67, hair: 0x413027, eyes: 0x524a41, haircut: "cropped", defaultWardrobe: uniform,
  },
} as const satisfies Record<string, CharacterAppearance>;

export const reinforcementLooks: readonly CharacterAppearance[] = [policeAppearances.ramirez, policeAppearances.jensen];
