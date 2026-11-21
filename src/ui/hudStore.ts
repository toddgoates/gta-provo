import { create } from "zustand";
import type { GameMode } from "../core/GameDirector";
import type { Point } from "../entities/EntityManager";
import type { DialogueSystem } from "../systems/DialogueSystem";
import type { WantedLevel } from "../systems/WantedLevelSystem";

export interface HudSnapshot {
  mode: GameMode;
  health: number;
  wanted: WantedLevel;
  mission: { title: string; objective: string } | null;
  dialogue: DialogueSystem["view"];
  prompt: string | null;
  pulledOut: boolean;
  driving: { speed: number; exiting: boolean; blocked: boolean } | null;
  goal: Point | null;
  player: Point;
  yaw: number;
  money: number;
  missionReward: number;
  complete: boolean;
  locked: boolean;
  debug: { fps: number; responders: number; seenByPolice: boolean; wantedDecay: number } | null;
}

export const useHud = create<{ snapshot: HudSnapshot | null }>(() => ({ snapshot: null }));
