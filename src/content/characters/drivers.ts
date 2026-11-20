import type { DriverProfile } from "../../entities/Appearance";

// Profiles are assigned at spawn, so the same car has the same driver throughout a run.
export const drivers = {
  sienna: { gender: "female", appearance: {
    skin: 0x93614a, hair: 0x292332, eyes: 0x48323b, haircut: "long", build: "standard",
    silhouette: "tapered",
    defaultWardrobe: { top: "berry-tee", bottoms: "sand-chinos", shoes: "dark-sneakers" },
  } },
  cal: { gender: "male", appearance: {
    skin: 0xe2af8c, hair: 0xb16b48, eyes: 0x476c64, haircut: "short", build: "slim",
    defaultWardrobe: { top: "blue-jacket", bottoms: "olive-chinos", shoes: "dark-sneakers" },
  } },
  ellis: { gender: "male", appearance: {
    skin: 0xbf896b, hair: 0x625843, eyes: 0x4c4c3c, haircut: "long", build: "broad",
    defaultWardrobe: { top: "driver-jacket", bottoms: "dark-jeans", shoes: "dark-sneakers" },
  } },
  mira: { gender: "female", appearance: {
    skin: 0xd2a17e, hair: 0xc29a52, eyes: 0x51758c, haircut: "bob", build: "slim",
    silhouette: "tapered",
    defaultWardrobe: { top: "mint-tee", bottoms: "marla-trousers", shoes: "dark-sneakers" },
  } },
  jade: { gender: "female", appearance: {
    skin: 0xebbcab, hair: 0x673e46, eyes: 0x546a45, haircut: "cropped", build: "broad",
    silhouette: "tapered",
    defaultWardrobe: { top: "brick-tee", bottoms: "slate-trousers", shoes: "dark-sneakers" },
  } },
  leon: { gender: "male", appearance: {
    skin: 0x704535, hair: 0xa9a7a3, eyes: 0x493b42, haircut: "cropped", build: "standard",
    defaultWardrobe: { top: "gold-tee", bottoms: "blue-jeans", shoes: "dark-sneakers" },
  } },
} as const satisfies Record<string, DriverProfile>;
