import type { CharacterAppearance, Wardrobe } from "../../entities/Appearance";

export const garments = {
  top: {
    "gray-tee": { color: 0xc9ccd1, sleeves: "short", trim: null },
    "marla-cardigan": { color: 0x61857d, sleeves: "long", trim: 0xe5bd8d },
  },
  bottoms: {
    "blue-jeans": { color: 0x426792, seam: 0x375478 },
    "marla-trousers": { color: 0x4b4254, seam: null },
  },
  shoes: {
    "dark-sneakers": { color: 0x393741 },
  },
} satisfies {
  top: Record<string, { color: number; sleeves: "short" | "long"; trim: number | null }>;
  bottoms: Record<string, { color: number; seam: number | null }>;
  shoes: Record<string, { color: number }>;
};

export const localAppearance: CharacterAppearance = {
  skin: 0xe3b396, hair: 0xd9b767, eyes: 0x367aba, haircut: "short",
  defaultWardrobe: { top: "gray-tee", bottoms: "blue-jeans", shoes: "dark-sneakers" },
};

export const marlaAppearance: CharacterAppearance = {
  skin: 0xd69b78, hair: 0x653e46, eyes: 0x3a2f38, haircut: "bob",
  defaultWardrobe: { top: "marla-cardigan", bottoms: "marla-trousers", shoes: "dark-sneakers" },
};

export function resolveWardrobe({ top, bottoms, shoes }: Wardrobe) {
  function find<T>(catalog: Record<string, T>, id: string): T {
    if (!Object.hasOwn(catalog, id)) throw new Error(`Unknown garment: ${id}`);
    return catalog[id];
  }
  return {
    top: find(garments.top, top),
    bottoms: find(garments.bottoms, bottoms),
    shoes: find(garments.shoes, shoes),
  };
}
