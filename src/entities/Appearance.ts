export interface Wardrobe {
  readonly top: string;
  readonly bottoms: string;
  readonly shoes: string;
}

export interface CharacterAppearance {
  readonly skin: number;
  readonly hair: number;
  readonly eyes: number;
  readonly haircut: "cropped" | "short" | "bob" | "long";
  readonly build?: "slim" | "standard" | "broad";
  readonly defaultWardrobe: Wardrobe;
}

export interface DriverProfile {
  readonly gender: "male" | "female";
  readonly appearance: CharacterAppearance;
}
