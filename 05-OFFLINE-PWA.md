# Offline / PWA Strategy

Owner: **Member 4**.

Offline is a judged product feature, not a late browser optimization.

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

### `sensorReadings`

Optional timestamped soil-humidity observations and calibration metadata. The latest reading may be sent with a recommendation, but the sensor-free path remains authoritative whenever it is absent, stale, invalid or not yet backed by a validated adjustment model.

### `insights`

Optional cached AI explanations. They are derived from deterministic recommendation/history data, explicitly labeled, and never replace the native explanation.

### `catalog`

Mirror `GET /catalog` so a previously opened app can edit/create a plot offline.

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
| Fresh online | “Updated just now” |
| Saved today | “Saved earlier today — reconnect for the latest weather” |
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

On:

- app launch,
- browser `online` event,
- user pull-to-refresh / explicit refresh,
- optionally once every 30–60 min while foregrounded,

attempt a new recommendation for the selected plot.

If the request fails:

- keep local recommendation untouched,
- display a non-blocking offline/stale message,
- never blank the Today screen.

## 7. Why no sync queue in P0

The earlier architecture needed an outbox because plots and events were duplicated in SQLite and IndexedDB. In revised AXIS, the browser is the sole persistence layer for farmer data. Therefore there is nothing to reconcile with the server.

This is a deliberate 24-hour scope trade-off.

Future production version can add an authenticated sync service behind the existing local repositories without changing the screen model. The repository layer is the seam.

## 8. Real-device test checklist

Do this by H5, H10, H15 and H21.

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
