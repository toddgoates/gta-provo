export interface VehicleDefinition {
  id: string;
  name: string;
  modelId: string;
  handling: { topSpeed: number; acceleration: number; steering: number };
}
