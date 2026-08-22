# Offline / PWA Strategy

Offline is a judged product feature, not a late browser optimization.

## Current implementation

- ✅ Dexie repositories, local plot/recommendation/event/insight/sensor/decision-snapshot/timeline-weather tables, seven-day queries, freshness helpers, and PWA production generation are implemented and pass typecheck/build.
- ✅ Today, Weather, and Recommendations share an IndexedDB-first refresh coordinator. Existing advice refreshes hourly while `/app` is active and supports manual refresh.
- ✅ An isolated deployed browser smoke flow verified responsive timeline interaction and an active-page offline transition. 🟡 Reconnect/resume timing and force-close/reopen behavior have not been verified on a physical phone.
- 🟡 Offline irrigation recording, history, chart, and manual flow-meter delta paths are implemented but still require the two prescribed device cycles.
- ⬜ Home-screen installation, storage behavior on a second device, and physical-device HTTPS service-worker behavior remain pending.
- ⛔ There is no backend synchronization queue because farmer data intentionally remains device-local.

## 1. Device data model

Dexie tables:

```text
plots
recommendations
irrigationEvents
catalog
settings
insights
sensorReadings
decisionSnapshots
timelineWeather
```

No outbox is needed in the hackathon MVP because the backend stores no user data. Local writes are final local writes.

### `plots`

Persist indefinitely. Contains the planting-date anchor derived from crop age.

### `recommendations`

Key by `plotId + date`. Keep at least the last 7 days.

Store:

- full recommendation response,
- `savedAt`,
- weather source,
- confidence,
- baseline requirement if needed for P1 water-saved analytics.

### `irrigationEvents`

P0 local action history:

```ts
type IrrigationEvent = {
  id: string;
  plotId: string;
  date: string;
  litres: number;
  recommendedLitres?: number;
  source: 'FOLLOWED_RECOMMENDATION' | 'MANUAL' | 'FLOW_METER';
  createdAt: string;
  meterId?: string;
  meterStartLitres?: number;
  meterEndLitres?: number;
};
```

For `FLOW_METER`, `litres = meterEndLitres - meterStartLitres`. Invalid or decreasing cumulative readings are rejected.

### `decisionSnapshots`

Immutable local audit records preserve the recommendation, issuance-time forecast, same-day water-balance outputs, and optional latest soil observation that supported an irrigation decision. An irrigation event and its snapshot are written in one IndexedDB transaction, after the event has been added and the existing same-day balance has been reconciled. Later weather refreshes may replace the current recommendation record but cannot update an earlier snapshot.

Each plot/date may retain multiple `IRRIGATION_EVENT` snapshots. A deterministic final ID permits only one `END_OF_DAY` or `END_OF_DAY_CATCHUP` snapshot. Snapshot rows are added rather than updated.

### `sensorReadings`

Optional timestamped soil-humidity observations and calibration metadata. The latest reading may be sent with a recommendation, but the sensor-free path remains authoritative whenever it is absent, stale, invalid or not yet backed by a validated adjustment model.

### `insights`

Optional cached AI explanations. They are derived from deterministic recommendation/history data, explicitly labeled, and never replace the native explanation.

### `catalog`

Mirror `GET /catalog` so a previously opened app can edit/create a plot offline.

### `timelineWeather`

Cache weather days by plot, coordinates, date, kind, and source. Historical reanalysis is fresh for 30 days and retained for 180 days; current/forecast entries are fresh for 60 minutes and retained for 14 days. Coordinate filtering prevents a moved plot from displaying weather cached for its previous location. Local recommendations, irrigation events, and decision snapshots are merged at render time rather than copied into provider weather rows.

## 2. UI data rule

The UI should **render from IndexedDB, not directly from fetch responses**.

Online refresh path:

```text
read local plot → POST /recommendations → write response to Dexie → UI reacts to Dexie
```

This keeps online and offline rendering identical.

## 3. Service-worker behavior

Precache:

- `index.html`
- JS/CSS bundles
- icons/fonts
- manifest
- other static assets required for core screens

Do not rely on HTTP cache for user data; IndexedDB owns user data.

## 4. Freshness states

Every recommendation shows one status.

| State | Suggested copy |
|---|---|
| Fresh online | “Refreshed just now” |
| Saved today | Relative age such as “Refreshed 24 min ago” |
| Older than today | “Saved from <date>. New rainfall is not included.” |
| Climatology fallback | “Weather service unavailable. Using seasonal estimates — treat this as a rough guide.” |
| Demo fixture | “Demo weather data” — only visible in developer/demo mode if desired |

Never show a stale recommendation as if it is current.

## 5. Offline user journey

### App already used before

1. Farmer opens AXIS with no network.
2. Service worker serves app shell.
3. Dexie loads plots and latest recommendation.
4. Today screen appears immediately with stale/saved badge.
5. “Why?” still works because the full explanation was stored.
6. Farmer can record an irrigation event locally.
7. History updates locally.
8. When network returns, user may tap/auto-trigger “Refresh recommendation.”

### First-ever launch with no network

P0 may show a friendly “Connect once to finish setup” message if the app/catalog has never been cached. Do not attempt to solve zero-install offline distribution during the hackathon.

## 6. Refresh behavior

The application renders the last complete recommendation from IndexedDB before any network work. It does not automatically create the first recommendation.

After a recommendation exists, the shared `/app` coordinator:

- schedules refresh for one hour after `savedAt` while the app is active;
- refreshes previous-day or hour-old advice when online;
- rechecks stale advice after connectivity returns or the browser becomes visible/focused;
- exposes manual refresh on Today and Weather;
- prevents concurrent refresh requests and resets scheduling when the selected plot changes; and
- stores weather and its deterministic recommendation together only after a successful response.

Browser PWAs cannot guarantee hourly execution while fully closed, so AXIS makes no background-refresh claim.

Daily snapshot finalization follows the same browser constraint. While AXIS is visible it checks during 23:00–23:59 Africa/Nairobi and finalizes every plot with a saved recommendation for that date. On launch, resume, focus, or reconnect it creates clearly labeled catch-up snapshots for unfinished past dates using only the latest recommendation, irrigation events, and sensor context already preserved locally. `capturedAt` is always the real creation time; catch-up records never claim they were captured at midnight. Dates without a saved deterministic recommendation are skipped rather than reconstructed from newer weather.

If the request fails:

- keep local recommendation untouched,
- display a non-blocking offline/stale message,
- never blank the Today screen.

After an automatic failure, retry on the next hourly check, reconnect/resume event, or manual request rather than looping immediately.

## 7. Why no sync queue in P0

The earlier architecture needed an outbox because plots and events were duplicated in SQLite and IndexedDB. In revised AXIS, the browser is the sole persistence layer for farmer data. Therefore there is nothing to reconcile with the server.

This is a deliberate 24-hour scope trade-off.

Future production version can add an authenticated sync service behind the existing local repositories without changing the screen model. The repository layer is the seam.

## 8. Real-device test checklist

Record these checks explicitly; automated compilation does not prove them.

- Load deployed AXIS once online.
- Create/select plot and obtain recommendation.
- Enable airplane mode.
- Force-close browser/PWA.
- Reopen from home screen or browser.
- Plot still exists.
- Recommendation still exists.
- Explanation still opens.
- Status clearly says saved/stale.
- Record an irrigation event, including a flow-meter measurement where available.
- History reflects event.
- Re-enable connection.
- Refresh obtains a new recommendation without damaging local data.
