import { useEffect, useRef } from "react";
import type { HudSnapshot } from "./hudStore";

export function DialogueBox({ dialogue, advance }: {
  dialogue: NonNullable<HudSnapshot["dialogue"]>;
  advance: (choiceId?: string) => void;
}) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => { box.current?.querySelector("button")?.focus(); }, [dialogue.nodeId]);
  return (
    <section ref={box} className="dialogue panel" role="dialog" aria-modal="true" aria-labelledby="speaker">
      <div className="eyebrow">Conversation</div>
      <h2 id="speaker">{dialogue.speaker}</h2>
      <p>{dialogue.text}</p>
      <div className="choices">
        {dialogue.choices.length ? dialogue.choices.map((choice) =>
          <button key={choice.id} onClick={() => advance(choice.id)}>{choice.text}</button>
        ) : <button onClick={() => advance()}>{dialogue.ends ? "End conversation" : "Continue"} <span aria-hidden="true">↵</span></button>}
      </div>
    </section>
  );
}
