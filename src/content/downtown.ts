import type { Point } from "../entities/EntityManager";
import type { LocationTrigger } from "../systems/TriggerSystem";

export interface BuildingLot {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  front: 1 | -1; // Facing +Z or -Z.
  sign?: string;
  accent?: number;
  roofStairs?: { baseZ: number; run: number; width: number };
}

export interface DistrictDefinition {
  name: string;
  bounds: { width: number; depth: number };
  roadWidth: number;
  blocks: readonly { x: number; z: number; width: number; depth: number; plaza?: boolean }[];
  buildings: readonly BuildingLot[];
  trees: readonly (readonly [x: number, z: number, size: number])[];
  lamps: readonly (readonly [x: number, z: number])[];
  locations: readonly LocationTrigger[];
  spawns: { player: Point; npc: Point };
}

export const downtown: DistrictDefinition = {
  name: "Downtown / Center & University",
  bounds: { width: 140, depth: 112 },
  roadWidth: 18,
  blocks: [
    { x: -39.5, z: -32.5, width: 60.6, depth: 46.6 },
    { x: 39.5, z: -32.5, width: 60.6, depth: 46.6 },
    { x: -39.5, z: 32.5, width: 60.6, depth: 46.6 },
    { x: 39.5, z: 32.5, width: 60.6, depth: 46.6, plaza: true },
  ],
  buildings: [
    { id: "print-shop", x: -21, z: -24, width: 16, depth: 19, height: 9, color: 0xb46555, front: 1, sign: "CENTER PRINT CO.", accent: 0x455e72 },
    { id: "thrift", x: -43, z: -23, width: 22, depth: 17, height: 7, color: 0xe0a479, front: 1, sign: "SECOND SUNDAY", accent: 0x856754 },
    { id: "hotel", x: -61, z: -28, width: 12, depth: 27, height: 17, color: 0x92585a, front: 1 },
    { id: "record-shop", x: 21, z: -23, width: 17, depth: 18, height: 8, color: 0xe6b889, front: 1, sign: "B-SIDE RECORDS", accent: 0x64745f },
    { id: "insurance", x: 42, z: -27, width: 20, depth: 25, height: 15, color: 0xb19d91, front: 1, sign: "VALLEY MUTUAL", accent: 0x58697b },
    { id: "bakery", x: 61, z: -23, width: 14, depth: 16, height: 7, color: 0xd08a76, front: 1 },
    { id: "soda", x: -24, z: 34, width: 19, depth: 17, height: 8, color: 0xbf7563, front: -1, sign: "SODA DEPT.", accent: 0x40756e,
      roofStairs: { baseZ: 22.7, run: 15.8, width: 2.45 } },
    { id: "repair", x: -45, z: 29, width: 19, depth: 15, height: 7, color: 0xe1ae81, front: -1, sign: "WASATCH REPAIR", accent: 0x786a7d },
    { id: "annex", x: -62, z: 34, width: 12, depth: 25, height: 11, color: 0xa88476, front: -1 },
  ],
  trees: [[-12,-15,1],[-35,-13,.85],[-55,-12,.9],[12,-16,1],[33,-13,.85],[55,-12,.9],
    [-10.5,27,.95],[-38,16,.8],[-58,13,1],[17,17,1],[37,15,.8],[48,23,1.2],[58,19,1],
    [16,33,1],[23,44,1.1],[45,45,1],[63,42,1.2],[60,52,.9]],
  lamps: [[-11,-11],[11,-11],[-11,11],[11,11],[-47,-11],[48,-11],[-42,11],[44,11],[-11,42],[11,42]],
  locations: [{ id: "welcome-pavilion", position: { x: 28, y: 0.15, z: 19 }, radius: 2.7 }],
  spawns: { player: { x: -18, y: 0.18, z: 17 }, npc: { x: -20, y: 0.16, z: 13 } },
};

export const sodaRoofMedicine = { position: { x: -24, y: 8.30, z: 34 }, hp: 20 } as const;
