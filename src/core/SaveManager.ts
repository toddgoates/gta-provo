import type { Point } from "../entities/EntityManager";
import type { MissionProgress } from "../systems/MissionSystem";

export interface SaveDataV1 {
  version: 1;
  player: { position: Point; yaw: number; locationId: string; money: number };
  missions: MissionProgress;
  flags: Record<string, boolean>;
  dialogueChoices: { dialogueId: string; choiceId: string }[];
  inventory: string[];
  ownedVehicles: string[];
}

/** Future IndexedDB adapter boundary; no persistence is wired up in this slice. */
export interface SaveRepository {
  read(slot: string): Promise<SaveDataV1 | null>;
  write(slot: string, save: SaveDataV1): Promise<void>;
}
