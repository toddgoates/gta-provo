# Provo: Center & University

A client-side, third-person game prototype set in a fictionalized downtown Provo. The entire first mission concerns a folding chair.

## Run it

Use Node.js 20.19+ on the Node 20 line, or Node.js 22.12+. A desktop browser with WebGL 2, a keyboard, and a mouse is recommended.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Walk toward **Marla**, press **E**, choose a reply, and follow the gold marker across University Avenue to the Welcome Pavilion. Progress resets on reload.

| Key | Action |
| --- | --- |
| W / A / S / D | Walk relative to the camera |
| Shift | Sprint |
| Space | Jump |
| Click the scene / left-drag | Capture the mouse for camera control / look without pointer lock |
| E | Use the nearby interaction |
| F | Right punch; two taps chain right–left, three add a kick |
| Esc | Pause or resume; releasing pointer lock also pauses |
| F1 | Toggle the debug panel (development only) |

### Wanted level

Two officers patrol on foot. A civilian assault or vehicle theft only earns a wanted dot if a nearby officer has a clear view. A witnessed civilian knockout or a hit on an officer starts at two dots; knocking out an officer starts at three. Repeated detected offenses can raise the level further. Police investigate and chase on foot, including if you get in a vehicle. Break their line of sight for 20 seconds to lose one dot. A fresh run starts at zero.

Levels 1–3 call for 1, 2, and 4 responding officers respectively; levels 4–5 currently use the four-officer fallback. The development-only **F1** panel shows responders, visibility, and the decay timer, with controls for all five levels.

To take a car, approach it while it's stopped or crawling and press **E** when prompted. In the car, **W** accelerates, **A/D** steer, **S** brakes then reverses, and **Space** brakes without reversing. Press **E** to stop and get out. If the exit is blocked, move the car and try again.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Strict TypeScript checks |
| `npm test` | Vitest gameplay and Rapier collision tests |
| `npm run build` | Type-check and create `dist/` |
| `npm run preview` | Serve the production build locally |

## What’s in this build

- Three developed blocks and a public plaza with storefronts, crosswalks, trees, and a Wasatch-inspired skyline.
- Fixed-step Rapier capsule movement with gravity, curb stepping, jumping, and building collision; a follow camera with wall obstruction.
- Six low-poly NPC cars in three body styles. They keep right, brake behind other cars, take turns at the four-way stop, and yield to the player.
- Thirteen pedestrians in a mix of solo walkers, pairs, and small groups. Some stand and chat; walkers stay on sidewalks and use marked crosswalks when traffic clears.
- Take over a slow or stopped car, watch one of six distinct drivers tumble out and flee, and drive with an arcade chase camera.
- One NPC, one branching text conversation, and one event-driven mission with a destination marker and a $15 reward.
- A blond, blue-eyed player in a light gray tee and blue jeans. Clothing is defined in swappable slots; there is no wardrobe menu yet.
- A mission HUD, north-up minimap, pause menu, and development-only debug readout.
- A red health bar that starts at 100%. Fast traffic impacts on foot reduce health. At zero, **Start over** resets the run.
- Ambient pedestrians may flee or fight back after being hit. Those who fight stay committed, even after taking a full combo. Their counterattacks reduce player health. Marla remains a dialogue-only NPC.
- Ambient pedestrians have hidden health. When it reaches zero they collapse, stop fighting, and stay down.

No vehicle damage, audio, GLB assets, saves, or backend are shipped. Rapier’s compatibility package embeds WASM, so Vite can warn about the initial bundle size even when the build succeeds. See [Architecture](ARCHITECTURE.md) and [Game Design](GAME_DESIGN.md).
