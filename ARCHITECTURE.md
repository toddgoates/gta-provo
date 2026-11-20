# Architecture

## Ownership and boundaries

| Area | Responsibility |
| --- | --- |
| `src/core/Game.ts` | Composition root: owns the session, wiring, command entry points, and teardown. |
| `src/core/GameDirector.ts` | Owns mode transitions and policy for input, simulation, and camera. Pause overlays the previous mode; a scene returns to its originating free mode. |
| `src/core/GameLoop.ts` | `requestAnimationFrame`; 60 Hz simulation, frame delta capped at 100 ms, accumulator cleared during pause/dialogue, interpolated render. |
| `src/core/InputManager.ts` | Browser keyboard/pointer state and edge-triggered actions. Mode changes and focus loss clear held input. |
| `src/entities/` | Stable instance IDs, reusable definitions, and runtime transforms; no scene nodes or UI objects. |
| `src/systems/` | Movement, nearby interaction, location triggers, ordered missions, dialogue, and scene focus. |
| `src/render/` | A Three.js view and camera rig. Reads transforms, animates proxies, and draws objective markers. Camera avoidance uses a Rapier ray supplied by `Game`. |
| `src/world/` | Loads one content-defined district into a Three.js group and creates its static colliders. It owns both resources and can unload them together. |
| `src/content/` | Authored definitions. The initial area keeps story content in one file; split it by content type as it grows. |
| `src/ui/` | React renders HUD, map, pause and dialogue. Zustand receives read-only-by-convention snapshots and never owns gameplay state. Buttons call commands on `Game`. |

Rapier owns the physical player pose. After each step, `MovementSystem` publishes that pose to the entity transform (origin at the feet). Three.js interpolates between the last two poses and never writes gameplay state. `GameDirector`, `DialogueSystem`, and `MissionSystem` each own their portion of session state. The UI gets snapshots around 10 Hz and immediately after major transitions; it does not tick the game.

## Simulation and event flow

1. At a fixed tick, read director policy and buffered input; prepare the capsule’s intended motion.
2. Step Rapier and publish the resolved transform.
3. Detect location entry, find the closest enabled interactable, and emit `interaction:used` on **E**.
4. The typed, synchronous `EventBus` fans out that event. The mission can advance its current objective; the interaction handler starts a scene and dialogue from the selected entity definition.
5. Dialogue choices can set world flags. `dialogue:completed` closes the scene and advances the mission to its location objective. `location:entered` completes that objective; `mission:completed` grants the reward. A location event fires only on entry, not every tick while inside.

Only the current objective listens for its matching event, and a single emission advances at most one objective. Rewards and world-state effects are events, not direct calls into unrelated systems. In this slice, only one mission may be active; prerequisites make later missions available but do not auto-start them.

## Coordinates and world loading

Right-handed, meter-like units: **+X east**, **+Y up**, **−Z north**. The road surface is near `Y=0`, sidewalks at `Y=.15`, and the district origin is the Center Street / University Avenue intersection. An actor with yaw zero faces north; positive yaw turns toward west. A block or building is placed by its footprint center, an entity by its feet.

Each future chunk can use the same district-style boundary: authored footprints/placements in, Three.js group and Rapier colliders out. There is no streaming scheduler. Place colliders from authored dimensions independently of art. When art arrives, resolve `modelId` to a glTF 2.0 `.glb` through a rendering-side adapter such as Three.js `GLTFLoader`; the current renderer resolves it to procedural proxies instead.

## Adding content

- **Entity:** Add an `EntityDefinition`, then spawn its instance with a unique stable ID and pose. Add a view/proxy for the `modelId`. For **E**, give it an interaction range and descriptor (`dialogue` or `use`); register a listener for new behavior rather than specializing the proximity test.
- **Character and clothing:** Define skin, hair, eyes, and a default outfit in `src/content/characters/wardrobe.ts`. Each spawned character has its own equipped top, bottoms, and shoes. Add catalog items to a slot and equip them through `Game.equipPlayerGarment`; the renderer updates the outfit on the existing rig without changing the collision capsule or animation pivots. A wardrobe menu, ownership rules, and save persistence are not implemented.
- **Traffic drivers:** Author profiles in `src/content/characters/drivers.ts` and assign them to vehicle spawns in `src/content/vehicles/downtownTraffic.ts`. Driver profiles reuse the wardrobe catalog. Gender, body build, hair length, and colors are independent settings, and the profile stays with the car until the driver flees.
- **Pedestrians:** Author standing spots or sidewalk routes in `src/content/pedestrians.ts`, marking only crosswalk segments as crossings. `PedestrianSystem` checks traffic before a group commits and reports occupied crossings so NPC drivers yield. Looks are generated from wardrobe and appearance palettes per run. Walkers are visual actors on authored paths, not a general navigation mesh or physics crowd.
- **Melee:** `MeleeSystem` buffers strikes and resolves hits at fixed-tick impact times using distance, facing, and a line-of-sight query. Hit pedestrians detach from their normal routes and flee or fight; counters use `HealthSystem`. `MeleeSystem` tracks pedestrian health and fall progress without exposing a health meter. At zero health, the pedestrian leaves combat and stays down. `CharacterMotion` applies wind-up, contact, and recovery poses using separate torso, elbow, and knee joints. Dialogue NPCs are kept out of ambient combat.
- **Dialogue:** Add a `DialogueDefinition` keyed by ID and assign it to an NPC interaction. Nodes identify the speaker and subtitle; set a `next` node or supply choices. A missing next node ID means end, an unknown referenced ID is an authoring error. Choices may be gated by a flag and set a flag. `audio` is optional metadata; playback is not implemented.
- **Mission:** Register a `MissionDefinition` with stable ID, optional prerequisite IDs, ordered `when` event/payload matches, and optional reward. Add a location trigger to world data when needed, then reference its ID from the objective to show the marker. Wire the start to the appropriate game rule.

## Extension points and lifecycle

- `SceneSequence` currently describes mode and subject focus. Extend this data for scripted actions only as cutscene needs appear.
- `TrafficSystem` runs NPC lane following on the fixed tick. `VehicleSystem` owns the cars' kinematic colliders, driving and exit checks. Boarding detaches a car from its route without changing its ID, releases any junction reservation, disables the on-foot capsule, and spawns a short fleeing-driver animation. `GameDirector` switches input and camera policies and `Game` emits typed enter/exit events. A car stays where the player leaves it and traffic treats it as an obstacle. Exiting requires a clear capsule placement and restores on-foot controls. Driving sweeps against obstacles but does not simulate damage or crash reactions.
- `SaveDataV1` and `SaveRepository` define the future IndexedDB boundary. Mission state supports snapshot/restore in memory; no slot management, serialization, or restoration of full sessions is wired.
- `GameAudio` is an interface only. Start with local asset playback when the first audio arrives.
- `VehicleSystem` checks footsteps and traffic together using a swept collision query. `HealthSystem` owns health and hit cooldown; `GameDirector` freezes the session on death. **Start over** disposes the current `Game` and starts a fresh one.
- React unmount aborts pending initialization and disposes a running game. Teardown stops RAF, removes browser/event subscriptions, removes physics objects, frees the Rapier world, and disposes the window view’s Three.js resources.
