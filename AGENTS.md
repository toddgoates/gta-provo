# Agent and contributor guide

- Keep logic in strict TypeScript. Follow the surrounding style; prefer small, explicit systems over an ECS or generic framework.
- `core/` composes; `entities/` and `systems/` own simulation; `render/` and `world/` bridge to Three.js/Rapier; `ui/` presents snapshots. Pure systems should not import React, Three.js, or browser APIs.
- Keep game modes in `GameDirector` and apply policies at the orchestration boundary. Do not add mode checks to independent logic.
- Send cross-system gameplay facts through `GameEvents`; use stable IDs and typed payloads. Release every listener and browser/GPU/physics resource owned by a feature.
- Author NPCs, dialogue nodes, mission objectives, world placements, and vehicle specs in `src/content/`. Never branch on the current mission inside movement, NPC proximity, or rendering. See [Architecture](ARCHITECTURE.md) for conventions.
- Keep React/Zustand snapshots derived from the simulation. React may request a command but must not mutate entities or move camera nodes.
- Add a focused Vitest regression for gameplay rules. Before handing off, run `npm run typecheck`, `npm test`, and `npm run build`. For changes involving input, rendering or collisions, smoke-test the Marla → pavilion route in a WebGL 2 browser and check pause/resume.
- Keep the README and design documents aligned with implemented behavior. Do not ship empty placeholder systems for future features.
