import type { HudSnapshot } from "./hudStore";
import type { WantedLevel } from "../systems/WantedLevelSystem";
import "./debug.css";

export default function DebugMenu({ hud, setWanted }: { hud: HudSnapshot; setWanted?: (level: WantedLevel) => void }) {
  const { x, y, z } = hud.player;
  return (
    <aside className="debug panel" aria-label="Developer debug">
      <b>DEVELOPER / F1</b>
      <div>Mode: {hud.mode}</div>
      <div>XYZ: {x.toFixed(2)}, {y.toFixed(2)}, {z.toFixed(2)}</div>
      <div>Mission: {hud.mission?.title ?? "—"}</div>
      <div>Objective: {hud.mission?.objective ?? "—"}</div>
      <div>FPS: {hud.debug?.fps}</div>
      <div>Wanted: {hud.wanted}/5 · Responders: {hud.debug?.responders}</div>
      <div>Visible to police: {hud.debug?.seenByPolice ? "yes" : "no"}</div>
      <div>Wanted decay: {hud.debug?.wantedDecay.toFixed(1)}s</div>
      <div className="debug-actions" aria-label="Wanted level controls">
        {([0, 1, 2, 3, 4, 5] as const).map((level) => <button key={level} type="button" onClick={() => setWanted?.(level)} aria-label={`Set wanted level ${level}`}>{level}</button>)}
        <button type="button" onClick={() => setWanted?.(0)}>Clear wanted</button>
      </div>
    </aside>
  );
}
