import type { DriverProfile } from "../../entities/Appearance";
import { drivers } from "./drivers";
import { garments } from "./wardrobe";

const profiles = Object.values(drivers);
const tops = Object.keys(garments.top).filter((id) => id !== "marla-cardigan");
const bottoms = Object.keys(garments.bottoms);

export function createPedestrianLook(index: number, random = Math.random): DriverProfile {
  const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const gender = index % 2 === 0 ? "female" : "male";
  const base = pick(profiles.filter((profile) => profile.gender === gender));
  return {
    gender,
    appearance: {
      ...base.appearance,
      skin: pick(profiles).appearance.skin,
      hair: pick(profiles).appearance.hair,
      haircut: pick(["cropped", "short", "bob", "long"] as const),
      defaultWardrobe: { top: pick(tops), bottoms: pick(bottoms), shoes: "dark-sneakers" },
    },
  };
}
