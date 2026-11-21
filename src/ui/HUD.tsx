import { lazy, Suspense, useEffect, useRef } from "react";
import { downtown } from "../content/downtown";
import { DialogueBox } from "./DialogueBox";
import type { HudSnapshot } from "./hudStore";
import type { WantedLevel } from "../systems/WantedLevelSystem";
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

function DeathScreen({ restart }: { restart: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { button.current?.focus(); }, []);
  return (
    <div className="veil death-veil">
      <section className="death-screen" role="dialog" aria-modal="true" aria-labelledby="death-title">
        <div className="eyebrow">Downtown · End of the road</div>
        <h2 id="death-title"><span>Frick!</span> You died</h2>
        <button ref={button} type="button" onClick={restart}>Start over <span aria-hidden="true">↵</span></button>
      </section>
    </div>
  );
}

export function HUD({ pause, advance, restart, setWanted }: {
  pause: () => void; advance: (choiceId?: string) => void; restart: () => void; setWanted?: (level: WantedLevel) => void;
}) {
  const hud = useHud((s) => s.snapshot);
  if (!hud) return null;
  const inScene = hud.mode === "dialogue" || hud.mode === "paused" || hud.mode === "dead";
  return (
    <div className="hud">
      <div className="masthead">
        <div className="brand">PROVO<span>.</span></div>
        <div className="edition">UTAH VALLEY <i /> DOWNTOWN</div>
        <div className="health panel">
          <div className="health-label" aria-hidden="true"><span>Health</span><span>{hud.health}%</span></div>
          <div className="health-track" role="progressbar" aria-label="Health" aria-valuenow={hud.health} aria-valuemin={0} aria-valuemax={100}>
            <div className="health-fill" style={{ width: `${hud.health}%` }} />
          </div>
          <div className="cash-balance"><span>Cash</span><output aria-label="Cash balance">${hud.money.toLocaleString("en-US")}</output></div>
          <div className="wanted" role="meter" aria-label="Wanted level" aria-valuenow={hud.wanted} aria-valuemin={0} aria-valuemax={5}>
            <span aria-hidden="true">Wanted</span>
            {[1, 2, 3, 4, 5].map((dot) => <i key={dot} className={hud.wanted >= dot ? "lit" : ""} aria-hidden="true" />)}
          </div>
        </div>
      </div>
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
            <p>+${hud.missionReward} · Downtown is yours to explore.</p>
          </section>}
          <DistrictMap {...hud} />
          {hud.prompt && <div className="interaction panel"><kbd>E</kbd> {hud.prompt}</div>}
          {hud.pulledOut && <div className="interaction panel" role="status">Police pulled you out!</div>}
          {hud.driving && <div className="interaction panel" role="status">
            {hud.driving.exiting ? "Stopping to get out…" : hud.driving.blocked ? "Exit blocked. Move the car to a clear spot." :
              <><kbd>E</kbd> Exit car <span className="driving-speed">{hud.driving.speed} mph</span></>}
          </div>}
          <div className="controls panel">
            {hud.driving ? <>
              <span><kbd>W</kbd> Accelerate</span><span><kbd>A / D</kbd> Steer</span>
              <span><kbd>S</kbd> Brake / Reverse</span><span><kbd>SPACE</kbd> Brake</span>
            </> : <>
              <span><kbd>WASD</kbd> Walk</span><span><kbd>SHIFT</kbd> Sprint</span>
              <span><kbd>SPACE</kbd> Jump</span><span><kbd>LMB</kbd> Melee</span>
              <span>{hud.locked ? "Mouse to look" : "Click to capture · Drag to look"}</span>
            </>}
          </div>
        </>
      )}
      {hud.mode === "dialogue" && hud.dialogue && <DialogueBox dialogue={hud.dialogue} advance={advance} />}
      {hud.mode === "paused" && <PauseMenu resume={pause} />}
      {hud.mode === "dead" && <DeathScreen restart={restart} />}
      {DebugMenu && hud.debug && <Suspense fallback={null}><DebugMenu hud={hud} setWanted={setWanted} /></Suspense>}
    </div>
  );
}
