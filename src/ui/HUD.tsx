import { lazy, Suspense, useEffect, useRef } from "react";
import { downtown } from "../content/downtown";
import { DialogueBox } from "./DialogueBox";
import type { HudSnapshot } from "./hudStore";
import { useHud } from "./hudStore";

const DebugMenu = import.meta.env.DEV ? lazy(() => import("./DebugMenu")) : null;

function DistrictMap({ player, yaw, goal }: HudSnapshot) {
  const { width, depth } = downtown.bounds;
  return (
    <div className="district-map panel" aria-label="District map">
      <div className="map-title"><span>STREET MAP</span><span>N ↑</span></div>
      <svg viewBox={`${-width / 2} ${-depth / 2} ${width} ${depth}`} role="img" aria-label="North-up map of Center and University">
        <rect x={-width / 2} y={-depth / 2} width={width} height={depth} fill="#5d6064" />
        {downtown.blocks.map(({ x, z, width, depth, plaza }) =>
          <rect key={`${x},${z}`} x={x - width / 2} y={z - depth / 2} width={width} height={depth} fill={plaza ? "#777d61" : "#87796c"} />)}
        {downtown.buildings.map(({ id, x, z, width, depth }) =>
          <rect key={id} x={x - width / 2} y={z - depth / 2} width={width} height={depth} fill="#383e47" rx="1.2" />)}
        {goal && <circle cx={goal.x} cy={goal.z} r="5" fill="#ffd068" stroke="#252633" strokeWidth="1.5" />}
        <path d="M0 -5.5 L4.5 4 L0 2.5 L-4.5 4 Z" fill="#f7f3df" stroke="#252633" strokeWidth="1.2"
          transform={`translate(${player.x} ${player.z}) rotate(${-yaw * 180 / Math.PI})`} />
      </svg>
      <div className="map-caption">CENTER × UNIVERSITY</div>
    </div>
  );
}

function PauseMenu({ resume }: { resume: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { button.current?.focus(); }, []);
  return (
    <div className="veil">
      <section className="pause panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div className="eyebrow">Take a breather</div>
        <h2 id="pause-title">Paused</h2>
        <p>Downtown will still be here.</p>
        <button ref={button} onClick={resume}>Resume game <span aria-hidden="true">↵</span></button>
      </section>
    </div>
  );
}

export function HUD({ pause, advance }: { pause: () => void; advance: (choiceId?: string) => void }) {
  const hud = useHud((s) => s.snapshot);
  if (!hud) return null;
  const inScene = hud.mode === "dialogue" || hud.mode === "paused";
  return (
    <div className="hud">
      <div className="masthead"><div className="brand">PROVO<span>.</span></div><div className="edition">UTAH VALLEY <i /> DOWNTOWN</div></div>
      {!inScene && <button type="button" className="pause-toggle" onClick={pause} aria-label="Pause game">Ⅱ</button>}
      {!inScene && (
        <>
          {hud.mission && <section className="mission panel" aria-label="Mission" aria-live="polite">
            <div className="eyebrow">◆ &nbsp; Main mission</div>
            <h1>{hud.mission.title}</h1>
            <p>{hud.mission.objective}</p>
          </section>}
          {hud.complete && <section className="mission panel complete" role="status">
            <div className="eyebrow">✓ &nbsp; Mission complete</div>
            <h1>Chair confirmed.</h1>
            <p>+${hud.money} · Downtown is yours to explore.</p>
          </section>}
          <DistrictMap {...hud} />
          {hud.prompt && <div className="interaction panel"><kbd>E</kbd> {hud.prompt}</div>}
          <div className="controls panel">
            <span><kbd>WASD</kbd> Walk</span><span><kbd>SHIFT</kbd> Sprint</span>
            <span><kbd>SPACE</kbd> Jump</span><span>{hud.locked ? "Mouse to look" : "Click to capture · Drag to look"}</span>
          </div>
        </>
      )}
      {hud.mode === "dialogue" && hud.dialogue && <DialogueBox dialogue={hud.dialogue} advance={advance} />}
      {hud.mode === "paused" && <PauseMenu resume={pause} />}
      {DebugMenu && hud.debug && <Suspense fallback={null}><DebugMenu hud={hud} /></Suspense>}
    </div>
  );
}
