# AXIS

**Agricultural Excellence in Irrigation Schemes** is an offline-friendly PWA that turns crop age, plot area, irrigation method and weather into an explainable estimated daily irrigation requirement.

## Handoff status — 21 August 2026

| Status | Meaning |
|---|---|
| ✅ Complete | Implemented and verified by automated checks. |
| 🟡 Verification pending | Implemented but not yet proven against the live browser or physical phone. |
| ⬜ Pending | Not implemented or tested. |
| ⛔ Gated | Deliberately disabled until its acceptance gate passes. |

- ✅ The deterministic backend, contracts, fixtures, tests, frontend typecheck, production PWA build, container build/runtime smoke tests, and authenticated live KijaniSpace capture/adapter are verified.
- 🟡 The rich Today/Plots/History/More journey, IndexedDB persistence, offline shell, and P1 polish are implemented and require physical phone QA.
- ⬜ Fly deployment, two physical-phone offline cycles, second-device testing, and demo rehearsal remain release blockers.
- ⛔ AI is disabled by default, soil humidity is context-only, and automatic sensor/flow-meter hardware ingestion is not implemented.

See [`docs/TEAM-HANDOFF.md`](docs/TEAM-HANDOFF.md) for the team pickup brief and ownership map.

## What is implemented

- Deterministic FAO-56-oriented crop-stage/Kc pipeline with Hargreaves ETo.
- KijaniSpace provider, three-second timeout, one-hour memory cache, Kenya climatology fallback and deterministic demo mode.
- Litres, optional flow-rate runtime, crop timeline, weather context, confidence and step-by-step explanation.
- IndexedDB plots, recommendations, irrigation events, seven-day history, rain-adjustment analytics and offline PWA shell.
- Manual/recommendation-followed irrigation records and manually entered cumulative flow-meter start/end measurements.
- Optional soil-humidity observation contract with stale/calibration checks; adjustment is deliberately validation-gated.
- Optional AI explanations/history insights behind a disabled-by-default backend feature flag. AI never calculates or changes irrigation values.

## Run locally

Requirement: [Mise](https://mise.jdx.dev/). Mise installs the pinned Go and Node versions for this project.

```bash
mise install
npm ci --prefix frontend
mise run build
AXIS_WEATHER_MODE=fixture mise run run
```

Open `http://localhost:8080`. The fixture-mode golden scenario can be printed with:

```bash
mise exec -- go run ./backend/cmd/golden
```

A fresh source-only checkout embeds a small backend status page until `mise run build` generates the full PWA. Production bundles in `backend/web/dist` are intentionally not versioned.

## Live weather

```bash
export AXIS_WEATHER_MODE=live
export KIJANISPACE_API_KEY=replace-me
mise run run
```

`KIJANISPACE_API_URL` may override the default `/v1/agro_climate/water` endpoint. The response is deliberately mapped through documented aliases because the supplied provider schema is untyped. Live authentication, field names, units, and the organizer response must be captured and confirmed before judging.

## Bonus AI insights

The adapter expects an OpenAI-compatible chat-completions endpoint. Enable it only after the stretch gate and keep credentials server-side:

```bash
export AXIS_AI_INSIGHTS_ENABLED=true
export AXIS_AI_ENDPOINT=https://provider.example/v1/chat/completions
export AXIS_AI_API_KEY=replace-me
export AXIS_AI_MODEL=replace-me
```

The feature remains hidden when any configuration is missing. Provider failure never affects the native calculation or explanation.
Overview
In this project, you will create a function capable of merging multiple objects intelligently based on the type of each value. Rather than simply replacing properties, this function will combine arrays, concatenate strings, add numbers, and recursively merge objects, depending on their types.

Role Play
You’re designing a configuration system that must merge multiple data sources — user settings, default settings, and system configurations. These sources may contain arrays, strings, numbers, or nested objects. To ensure smooth integration, you’ll build a flexible fusion() function that combines all these inputs intelligently while respecting their data types.

Learning Objective
By completing this project, you will learn how to:

Traverse and manipulate objects recursively.

Handle type-based logic for merging different data types.

Combine and transform arrays, strings, numbers, and nested objects.

Apply robust conditional logic to manage type mismatches.

Instructions
General
Create a function named fusion that merges objects into a new one according to their value types.

Arrays
If both values are arrays, concatenate them.

fusion({ arr: [1, "2"] }, { arr: [2] });
// -> { arr: [1, "2", 2] }

fusion(
  { arr: [], arr1: [5] },
  { arr: [10, 3], arr1: [15, 3], arr2: ["7", "1"] },
);
// -> { arr: [10, 3], arr1: [5, 15, 3], arr2: ["7", "1"] }
Strings
If both values are strings, concatenate them with a space between them.

fusion({ str: "salem" }, { str: "alem" });
// -> { str: "salem alem" }

fusion({ str: "salem" }, { str: "" });
// -> { str: "salem " }
Numbers
If both values are numbers, add them.

fusion({ a: 10, b: 8, c: 1 }, { a: 10, b: 2 });
// -> { a: 20, b: 10, c: 1 }
Objects
If both values are objects, merge them recursively.

fusion({ a: 1, b: { c: "Salem" } }, { a: 10, x: [], b: { c: "alem" } });
// -> { a: 11, x: [], b: { c: "Salem alem" } }

fusion({ a: { b: [3, 2], c: { d: 8 } } }, { a: { b: [0, 3, 1], c: { d: 3 } } });
// -> { a: { b: [3, 2, 0, 3, 1], c: { d: 11 } } }
Type Mismatch
If the two values have different types, use the value from the second object.

fusion({ a: "hello", b: [] }, { a: 4 });
// -> { a: 4, b: [] }
## Verification

```bash
mise run check
podman build -f Containerfile .
```

`mise run check` is verified. The Podman command is a required next step, not a completed check.

Physical-device acceptance requires loading the deployed HTTPS app, saving a complete recommendation, enabling airplane mode, force-closing/reopening twice, recording irrigation offline, and confirming seven-day history survives. Repeat the smoke test on a second device if available.

## Safety boundary

AXIS estimates daily replacement demand; it does not directly measure the complete soil-water deficit. Raw, stale or uncalibrated sensor readings do not alter litres. The current UI saves soil-humidity readings as preview context only. Production sensor adjustment requires locally validated field-capacity, wilting-point and root-zone assumptions with agronomic review. Flow-meter readings are entered manually; automatic hardware adapters are future work.
