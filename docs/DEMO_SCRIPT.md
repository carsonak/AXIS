# AXIS Four-Minute Demo

**Progress — 20 August 2026:** 🟡 the screens and deterministic fixture path are implemented; ⬜ the complete script, airplane-mode sequence, second-device fallback, and recording have not been rehearsed on deployed phones.

1. **Problem:** a farmer needs an action, not another weather dashboard.
2. **Setup:** create the Kisumu quarter-acre tomato plot, ten weeks old, drip, 45 L/min.
3. **Today:** show litres, runtime, stage, weather, confidence and rain-adjusted water avoided.
4. **Why:** open the deterministic ETo → Kc → rain → efficiency → area explanation.
5. **Action + history:** record irrigation; optionally use cumulative flow-meter readings; show the history update.
6. **Offline:** enable airplane mode, force-close and reopen; show saved advice/explanation/history and record another event.
7. **Bonus:** if enabled, generate an explicitly labeled AI explanation of supplied data. State that AI never calculates litres.
8. **Hardware path:** show soil readings as preview-only context and the manual cumulative flow-meter entry path. State that automatic device adapters are future work and never present simulated readings as real.

Fixture inputs are pinned by `go run ./backend/cmd/golden` and `fixtures/recommendations/tomato.json`.
