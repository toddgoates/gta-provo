import type { PedestrianGroupDefinition } from "../systems/PedestrianSystem";

export const downtownPedestrians: readonly PedestrianGroupDefinition[] = [
  { id: "center-pair", count: 2, path: [[-49, 11.15], [-25, 11.15], [-10.25, 11.15], [10.25, 11.15], [29, 11.15], [55, 11.15]], crossings: [2] },
  { id: "print-walker", count: 1, path: [[-35, -10.8], [-11.15, -10.25], [-11.15, 10.25], [-25, 12]], crossings: [1] },
  { id: "record-regular", count: 1, path: [[24, -11.3], [11.15, -10.25], [11.15, 10.25], [11.15, 30]], crossings: [1] },
  { id: "north-pair", count: 2, path: [[39, -11.2], [10.25, -11.15], [-10.25, -11.15], [-34, -11.15]], crossings: [1] },
  { id: "plaza-friends", count: 3, path: [[22, 22], [25, 31], [33, 34], [37, 25], [30, 20]] },
  { id: "downtown-chat", count: 3, path: [[-32, 16.5]] },
  { id: "plaza-visitor", count: 1, path: [[27, 23]] },
  { id: "center-patrol", faction: "police", count: 1, path: [[-23, 12.5], [-40, 12.5], [-53, 12]] },
  { id: "plaza-patrol", faction: "police", count: 1, path: [[35, 12.7], [16, 12.7], [17, 24]] },
];
