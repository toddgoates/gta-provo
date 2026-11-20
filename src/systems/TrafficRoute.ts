export interface RoadLoop {
  id: string;
  axis: "x" | "z";
  end: number; // Distance from the junction to the center of each turnaround.
  lane: number;
  stop: number; // Distance from junction center to a stopped vehicle's center.
}

export interface RoadPose { x: number; z: number; yaw: number; turning: boolean }

export const loopLength = (road: RoadLoop): number => 4 * road.end + 2 * Math.PI * road.lane;
export function forwardGap(from: number, to: number, length: number): number {
  const delta = (to - from) % length;
  return delta < 0 ? delta + length : delta;
}

export function roadPose(road: RoadLoop, distance: number): RoadPose {
  const { end, lane } = road;
  const arc = Math.PI * lane;
  let s = forwardGap(0, distance, loopLength(road));
  let x: number, z: number, yaw: number, turning = false;
  if (s < 2 * end) {
    x = s - end;
    z = lane;
    yaw = -Math.PI / 2;
  } else if ((s -= 2 * end) < arc) {
    const a = s / lane;
    x = end + lane * Math.sin(a);
    z = lane * Math.cos(a);
    yaw = a - Math.PI / 2;
    turning = true;
  } else if ((s -= arc) < 2 * end) {
    x = end - s;
    z = -lane;
    yaw = Math.PI / 2;
  } else {
    const a = (s - 2 * end) / lane;
    x = -end - lane * Math.sin(a);
    z = -lane * Math.cos(a);
    yaw = a + Math.PI / 2;
    turning = true;
  }
  return road.axis === "x" ? { x, z, yaw, turning } : { x: -z, z: x, yaw: yaw - Math.PI / 2, turning };
}

export function stopDistances(road: RoadLoop): [number, number] {
  return [road.end - road.stop, 3 * road.end + Math.PI * road.lane - road.stop];
}
