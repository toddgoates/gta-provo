import type { Point } from "../entities/EntityManager";
import type { DriverProfile } from "../entities/Appearance";

export interface CrimeIncident {
  id: string;
  offenderId: string;
  victimId: string;
  position: Point;
}

export interface GameEvents {
  "combat:hit": CrimeIncident & { knockedOut: boolean; source?: "vehicle" };
  "civilian:assaulted": CrimeIncident;
  "civilian:knocked_out": CrimeIncident;
  "police:assaulted": CrimeIncident;
  "police:knocked_out": CrimeIncident;
  "vehicle:stolen": CrimeIncident;
  "civilian:vehicle_hit": CrimeIncident;
  "civilian:vehicle_fatality": CrimeIncident;
  "police:vehicle_hit": CrimeIncident;
  "police:vehicle_fatality": CrimeIncident;
  "interaction:used": { entityId: string };
  "dialogue:completed": { dialogueId: string; npcId: string };
  "dialogue:choice": { dialogueId: string; choiceId: string };
  "location:entered": { locationId: string };
  "vehicle:entered": { vehicleId: string };
  "vehicle:exited": { vehicleId: string };
  "vehicle:driver_ejected": { vehicleId: string; gender: DriverProfile["gender"] };
  "vehicle:crashed": { vehicleId: string; speed: number };
  "item:collected": { itemId: string };
  "item:delivered": { itemId: string; locationId: string };
  "world:flag-set": { flag: string; value: boolean };
  "mission:completed": { missionId: string; money: number };
}

export class EventBus {
  private channels = new Map<keyof GameEvents, Set<(event: unknown) => void>>();

  on<K extends keyof GameEvents>(key: K, listener: (event: GameEvents[K]) => void): () => void {
    let channel = this.channels.get(key);
    if (!channel) this.channels.set(key, channel = new Set());
    // Payload erasure is confined to the bus; only emit() can deliver to this channel.
    const receive = (event: unknown) => listener(event as GameEvents[K]);
    channel.add(receive);
    return () => { channel.delete(receive); };
  }

  emit<K extends keyof GameEvents>(key: K, event: GameEvents[NoInfer<K>]): void {
    for (const listener of [...(this.channels.get(key) ?? [])]) listener(event);
  }

  clear(): void {
    this.channels.clear();
  }
}
