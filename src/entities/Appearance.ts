export interface Wardrobe {
  readonly top: string;
  readonly bottoms: string;
  readonly shoes: string;
}

export interface CharacterAppearance {
  readonly skin: number;
  readonly hair: number;
  readonly eyes: number;
  readonly haircut: "short" | "bob";
  readonly defaultWardrobe: Wardrobe;
}
