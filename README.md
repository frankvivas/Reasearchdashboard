# Fieldnote Research Dashboard

A Vite + React starter designed for straightforward deployment to Vercel.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deploy to Vercel

Import this repository in Vercel. Vercel will detect Vite automatically; the build command is `npm run build` and the output directory is `dist`.

## Automatic watering (simulation)

Watering is **automatic only**. There is no manual start/stop control anywhere in the app.

- `src/watering.js` – pure control logic: start below a threshold, stop at a target (hysteresis), maximum runtime per cycle, cooldown, and fail-safe OFF on missing/stale/invalid readings or invalid settings. Works with a normalized percentage or calibrated raw sensor counts.
- `src/useSimulatedDevice.js` – **simulation stand-in for the ESP32 and the integration boundary.** Replace it with a hook that returns the same telemetry from the real device. The ESP32 firmware should run the same logic and remain the source of truth for pump state.
- `src/App.jsx` – dashboard: monitoring, calibration settings, and clearly labeled simulation inputs (these change the simulated sensor only, never the pump).

All default values (45% / 55%, 9.1 mL/s flow, 20 s max runtime, cooldowns) are **demo placeholders**, not calibrated or research-validated. Water use is *estimated* as flow rate × pump runtime; measured volume is not recorded.

```bash
npm test        # control-logic unit tests (Node built-in test runner)
npm run build
```

## Mobile and desktop views

The dashboard has two layouts that show the same data. A **Mobile | Desktop** switch is in the header of both.

- **Mobile**: single column with a bottom tab bar (Monitor, Log, Calibrate, Simulate). On a computer it appears as a phone-width column.
- **Desktop**: sidebar and wide grid. On a phone, choosing Desktop requests a 1280 px wide page (like "Request desktop site").
- The first visit picks by screen width; afterwards the last choice is remembered on that device.
