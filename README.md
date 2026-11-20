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
| Esc | Pause or resume; releasing pointer lock also pauses |
| F1 | Toggle the debug panel (development only) |

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
- One NPC, one branching text conversation, and one event-driven mission with a destination marker and a $15 reward.
- A mission HUD, north-up minimap, pause menu, and development-only debug readout.

No player-drivable vehicles, audio, GLB assets, saves, or backend are shipped. Rapier’s compatibility package embeds WASM, so Vite can warn about the initial bundle size even when the build succeeds. See [Architecture](ARCHITECTURE.md) and [Game Design](GAME_DESIGN.md).
