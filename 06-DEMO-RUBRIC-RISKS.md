# Demo, Rubric Mapping, Definition of Done, and Risks

## Current implementation status

- ✅ Backend tests/vet and frontend typecheck/build have passed locally; deterministic rainy/dry, stage, unit, confidence, SKIP, fixture, rolling Kijani window, timestamp, and authentication behavior are covered.
- 🟡 The rich P0/P1 screens and local data paths are implemented, but the checklist below deliberately remains unchecked until verified through the deployed URL and physical demo phone.
- ✅ A sanitized authenticated live Kijani capture/parser and container build/runtime have recorded verification.
- ⬜ Fly deployment, two offline cycles, second-device testing, browser refresh timing, recording, and rehearsal are pending.
- ⛔ AI and calibrated sensor adjustment have not passed the stretch gate and must remain disabled for release.

## 1. P0 Definition of Done

Every item is verified on the deployed HTTPS URL and the physical demo phone.

- [ ] Farmer can create a plot with location, crop, crop age/date, area and irrigation method in under 90 seconds.
- [ ] Crop age is entered once and AXIS displays a derived canonical stage.
- [ ] Today screen shows a specific litre recommendation.
- [ ] Flow rate shows practical irrigation minutes when known.
- [ ] A different irrigation method changes the litres in the expected direction.
- [ ] Rainy fixture reduces or eliminates irrigation.
- [ ] “Why?” shows ETo, Kc, stage/age, crop need, rain reduction, efficiency, area, litres.
- [ ] Real KijaniSpace weather has successfully driven at least one deployed recommendation. The local sanitized live-payload regression is complete but is not deployment evidence.
- [ ] Kijani failure falls back without blanking the product.
- [ ] Airplane mode + force-close + reopen still shows plot and last recommendation.
- [ ] “I irrigated” records a local event offline; flow-meter mode stores the measured start/end delta.
- [ ] Seven-day history shows recommended and applied volumes.
- [ ] Rain adjustment is labeled against a no-rain baseline, never as an unsupported total-savings claim.
- [ ] App shell is installable or at minimum behaves as a working PWA.
- [x] `go test ./...` passes the engine's critical cases.
- [x] Frontend typecheck/build passes.
- [x] `podman build -f Containerfile .` has recorded success on at least one team machine.
- [x] Demo fixture mode produces the pinned recommendation.

## 2. P1 Definition of Done

- [x] Seven-day chart is implemented in addition to the P0 list; physical-device verification remains pending.
- [x] Deterministic previous-day comparison identifies input deltas in automated tests.
- [ ] PWA home-screen install works on demo phone.
- [x] Multi-plot selection is implemented; physical-device verification remains pending.
- [ ] Unit/language/default-method settings are only partially implemented and are not accepted as complete localization.

## 3. Four-minute demo

### 0:00–0:30 — problem

“A farmer does not need another weather dashboard. They need to know how much water this exact plot needs today.”

Use one concrete scenario: Kisumu-area tomato plot, quarter-acre, known age, drip irrigation.

### 0:30–1:10 — setup

Create/edit the plot quickly:

- GPS/location
- tomato
- crop age, e.g. 10 weeks
- 0.25 acre
- drip
- optional 45 L/min

Point out that AXIS converts age to a planting-date anchor and automatically identifies the stage.

### 1:10–1:45 — action

Show the Today screen.

“The answer is about **N litres today**, or **M minutes** if flow is known.”

Pause on the number. Do not bury it under weather cards.

### 1:45–2:25 — explainability

Open “Why?” and show:

```text
weather demand → crop stage/Kc → rain credit → irrigation efficiency → area → litres
```

State: “AI does not decide this volume. It is deterministic and testable.”

### 2:25–3:05 — offline

Turn on airplane mode, force-close, reopen.

Show that the recommendation and explanation remain available with a saved/stale badge.

### 3:05–3:30 — close the loop

Tap “I irrigated” and show the local history update. If a flow-meter demo is available, show cumulative start/end readings becoming measured litres.

### 3:30–4:00 — impact/scalability

Show one architecture slide:

- KijaniSpace weather adapter
- deterministic engine
- device-side offline data
- future optional sensor adjuster

Close with: “Value today with no sensor; better calibration later when a sensor is available.”

## 4. Demo safety

1. Rehearse with `AXIS_WEATHER_MODE=fixture` and exact known inputs.
2. Before the demo, also fetch one real live recommendation and keep it locally cached.
3. Use wired USB mirroring if available, not venue Wi-Fi mirroring.
4. Prepare a second phone or browser profile.
5. Record a full successful demo video as last fallback.
6. Treat deployment changes as release changes and repeat the full smoke test afterward.

## 5. Rubric mapping

| Criterion | AXIS evidence | What to say / show |
|---|---|---|
| Problem Relevance & Impact — 20% | Directly answers Track 2 with a field-level water action | “Action, not information”; litres for a real crop/plot |
| Technical Execution — 20% | Tested deterministic engine, real API, offline PWA, fallback chain | Show tests + explanation + airplane mode |
| Innovation & Creativity — 15% | Sensor-optional decision layer and automatic stage progression | Model-first → sensor-optional future path |
| Technology Integration — 15% | Cloud weather service + edge/offline device behavior | Explicitly name Cloud & Edge Computing as the qualifying emerging-tech story |
| Scalability & Feasibility — 15% | No hardware required; crop config extensible; stateless backend | Explain local-first pilot and future sync service |
| Presentation & Demo — 10% | One clean scenario, deterministic fallback, offline moment | Rehearse and keep the number/action central |
| Team Collaboration — 5% | Five owned workstreams integrated through frozen contracts | Show task board/commit history/ownership |

### Bonus alignment

- Offline/low-bandwidth is directly demonstrable.
- Credible pilot path: local horticulture farmers/extension officers in Lake Victoria basin.
- AI can be a bonus only if it does not threaten the demo.

## 6. Weak spots to acknowledge

### No backend database

Say:

> “For the hackathon, farmer data is device-local by design. That gives us a reliable offline product with almost no cloud data risk. The production architecture adds authenticated sync behind the same repository interface once multi-device use becomes necessary.”

Do not apologize for it.

### Agronomy is standard, not novel

Say the innovation is the delivery of an explainable actionable recommendation in a low-connectivity, sensor-optional workflow.

### Farmer validation may be weak

If possible, before judging show the app to one farmer, agronomist, extension officer or agriculture student and capture one concrete piece of feedback. This is likely higher value than an extra feature.

## 7. Top risks

| Risk | Current mitigation/state |
|---|---|
| Wrong litres due to units/equation | Unit-suffixed variables and engine tests are implemented; independent agronomic review remains outstanding. |
| Kijani schema is untyped | Sanitized live fixture, alias mapping, rolling-window tests, and scalar fallback are implemented. |
| Kijani/auth unavailable | Generic environment authentication, memory cache, fixture mode, and climatology fallback are implemented. |
| Venue internet poor | Complete recommendations persist locally and fixture mode remains available. |
| PWA fails on a device | Browser and physical offline cycles remain required before release. |
| Integration drift | CI and `mise run check` cover Go and frontend builds; contract representations must change together. |
| Over-scoping | AI, sensor adjustment, automatic hardware ingestion, and sync remain explicitly gated. |
| Crop stage naming confuses crops | Four neutral canonical stages and broad farmer labels are implemented. |

## 8. Deferred-feature gate

Do not enable AI or a calibrated sensor adjuster unless all are true:

1. P0 checklist is green on deployed phone.
2. Airplane-mode reopen has worked twice.
3. `mise run check` passes on `main`.
4. Offline irrigation recording and seven-day history are working.
5. Real Kijani and fallback modes both work.
6. At least two P1 items are working.

Best stretch order:

1. Yesterday-vs-today deterministic explanation.
2. Hardware adapter demo for flow meter or calibrated soil-humidity input.
3. AI Kiswahili/plain-language explanation and seven-day history insight.

AI is disabled by default and never calculates litres. Sensor adjustment remains inactive until locally calibrated and agronomically validated.
