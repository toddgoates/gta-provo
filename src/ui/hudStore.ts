import { create } from "zustand";
import type { GameMode } from "../core/GameDirector";
import type { Point } from "../entities/EntityManager";
import type { DialogueSystem } from "../systems/DialogueSystem";

export interface HudSnapshot {
  mode: GameMode;
  health: number;
  mission: { title: string; objective: string } | null;
  dialogue: DialogueSystem["view"];
  prompt: string | null;
  driving: { speed: number; exiting: boolean; blocked: boolean } | null;
  goal: Point | null;
  player: Point;
  yaw: number;
  money: number;
  complete: boolean;
  locked: boolean;
  debug: { fps: number } | null;
}

export const useHud = create<{ snapshot: HudSnapshot | null }>(() => ({ snapshot: null }));
