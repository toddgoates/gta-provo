import type { CrimeIncident, EventBus } from "../core/EventBus";
import type { Entity, Point } from "../entities/EntityManager";
import { crimeRules } from "../content/police";

export type CrimeKind = keyof typeof crimeRules;
export type DetectedCrime = CrimeIncident & { kind: CrimeKind; witnessIds: readonly string[] };

export class CrimeSystem {
  private seen = new Set<string>();
  private unsubscribe: (() => void)[] = [];

  constructor(events: EventBus, playerId: string, dependencies: {
    findEntity: (id: string) => Entity | undefined;
    officers: () => readonly Entity[];
    conscious: (id: string) => boolean;
    clearSight: (from: Point, to: Point) => boolean;
    radius: number;
    detected: (crime: DetectedCrime) => void;
  }) {
    const observe = (kind: CrimeKind, incident: CrimeIncident) => {
      if (incident.offenderId !== playerId || this.seen.has(incident.id)) return;
      if (crimeRules[kind].direct) {
        const victim = dependencies.findEntity(incident.victimId);
        if (!victim?.enabled || victim.definition.faction !== "police" ||
            ((kind === "police:assaulted" || kind === "police:vehicle_hit") && !dependencies.conscious(victim.id))) return;
      }
      this.seen.add(incident.id);
      const witnesses = dependencies.officers().filter((officer) => officer.enabled &&
        dependencies.conscious(officer.id) &&
        Math.hypot(officer.position.x - incident.position.x, officer.position.z - incident.position.z) <= dependencies.radius &&
        dependencies.clearSight(officer.position, incident.position)).map(({ id }) => id);
      // A direct hit came from a combatant who was conscious immediately before impact.
      if (crimeRules[kind].direct && !witnesses.includes(incident.victimId)) witnesses.push(incident.victimId);
      if (witnesses.length) dependencies.detected({ ...incident, kind, witnessIds: witnesses });
    };
    for (const kind of Object.keys(crimeRules) as CrimeKind[]) {
      this.unsubscribe.push(events.on(kind, (incident) => observe(kind, incident)));
    }
    this.unsubscribe.push(events.on("combat:hit", ({ knockedOut, source, ...incident }) => {
      const victim = dependencies.findEntity(incident.victimId);
      if (!victim?.enabled || victim.definition.kind !== "npc") return;
      const kind = source === "vehicle" ? victim.definition.faction === "police"
        ? knockedOut ? "police:vehicle_fatality" : "police:vehicle_hit"
        : knockedOut ? "civilian:vehicle_fatality" : "civilian:vehicle_hit"
        : victim.definition.faction === "police"
        ? knockedOut ? "police:knocked_out" : "police:assaulted"
        : knockedOut ? "civilian:knocked_out" : "civilian:assaulted";
      events.emit(kind, incident);
    }));
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.seen.clear();
  }
}
