import type { HudSnapshot } from "./hudStore";
import "./debug.css";

export default function DebugMenu({ hud }: { hud: HudSnapshot }) {
  const { x, y, z } = hud.player;
  return (
    <aside className="debug panel" aria-label="Developer debug">
      <b>DEVELOPER / F1</b>
      <div>Mode: {hud.mode}</div>
      <div>XYZ: {x.toFixed(2)}, {y.toFixed(2)}, {z.toFixed(2)}</div>
      <div>Mission: {hud.mission?.title ?? "—"}</div>
      <div>Objective: {hud.mission?.objective ?? "—"}</div>
      <div>FPS: {hud.debug?.fps}</div>
    </aside>
  );
}
