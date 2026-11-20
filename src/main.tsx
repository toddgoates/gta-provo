import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Game } from "./core/Game";
import { HUD } from "./ui/HUD";
import { useHud } from "./ui/hudStore";
import "./style.css";

function App() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const token = new AbortController();
    void Game.create(mount.current!, (snapshot) => useHud.setState({ snapshot }), token.signal)
      .then((created) => {
        if (token.signal.aborted) { created?.dispose(); return; }
        game.current = created;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!token.signal.aborted) {
          console.error("Game initialization failed:", error);
          setStatus("error");
        }
      });
    return () => {
      token.abort();
      game.current?.dispose();
      game.current = null;
      useHud.setState({ snapshot: null });
    };
  }, []);
  return (
    <main className="app">
      <div ref={mount} className="world" />
      {status === "ready" ?
        <HUD pause={() => game.current?.togglePause()} advance={(id) => game.current?.advanceDialogue(id)} /> :
        <div className="loading" role={status === "error" ? "alert" : "status"}>
          <div className="brand">PROVO<span>.</span></div>
          <p>{status === "error" ? "Couldn’t start the game. A browser with WebGL 2 enabled is required." : "Loading downtown…"}</p>
        </div>}
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
