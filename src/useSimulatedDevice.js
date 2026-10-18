import { useCallback, useEffect, useRef, useState } from "react";
import { assessReading, initialControllerState, stepController, validateConfig } from "./watering";

// =====================================================================================
// SIMULATION ONLY - this hook stands in for the ESP32. It is the integration boundary.
//
// The dashboard (App.jsx) only reads the telemetry object this hook returns:
//   reading, pumpOn, cycleSeconds, cooldownSec, fault, dataIssue, samples, logs, totals...
// To connect real hardware, replace this hook with one that gets the SAME shape from the
// device (for example polling or subscribing to an ESP32 HTTP/MQTT/WebSocket endpoint).
// In that setup the ESP32 firmware runs stepController() from watering.js, owns the pump
// GPIO, and is the source of truth; the browser must never send pump on/off commands.
// Settings (thresholds, limits, flow rate) would be written to the device, not applied here.
//
// Everything below - the soil response, the starting moisture, the sampling - is made up
// so the control behaviour can be demonstrated. None of it is measured or validated data.
// =====================================================================================

const TICK_MS = 1000;
const SIM_SOIL_RISE_PER_SEC = 3.2; // simulated wetting speed while the simulated pump runs
const MAX_SAMPLES = 120;
const MAX_LOGS = 50;

const round1 = (value) => Math.round(value * 10) / 10;
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const initialView = {
  reading: null, // last sample the sensor delivered: { value, at }
  pumpOn: false,
  cycleSeconds: 0,
  cooldownSec: 0,
  fault: null,
  dataIssue: "Waiting for first sensor reading",
  samples: [],
  logs: [],
  cycles: 0,
  totalRuntimeSec: 0,
  totalEstimatedMl: 0,
  lastCycleSec: null,
  lastWateredAt: null,
};

export function useSimulatedDevice(config) {
  const [soil, setSoilState] = useState(64);
  const [sensorDropout, setSensorDropoutState] = useState(false);
  const [noResponse, setNoResponseState] = useState(false);
  const [view, setView] = useState(initialView);

  const cfgRef = useRef(config);
  cfgRef.current = config;

  const sim = useRef({
    soil: 64,
    dropout: false,
    noResponse: false,
    reading: null,
    ctrl: initialControllerState,
    prevIssue: null,
    nextId: 1,
    samples: [],
    logs: [],
    cycles: 0,
    totalRuntimeSec: 0,
    totalEstimatedMl: 0,
    lastCycleSec: null,
    lastWateredAt: null,
  });

  // Simulation inputs. These change the SIMULATED SOIL / SENSOR only, never the pump.
  const setSoil = useCallback((value) => { sim.current.soil = value; setSoilState(value); }, []);
  const setSensorDropout = useCallback((value) => { sim.current.dropout = value; setSensorDropoutState(value); }, []);
  const setNoResponse = useCallback((value) => { sim.current.noResponse = value; setNoResponseState(value); }, []);

  useEffect(() => {
    function tick() {
      const s = sim.current;
      const cfg = cfgRef.current;
      const now = Date.now();
      const addLog = (entry) => { s.logs = [{ id: s.nextId++, time: clock(now), date: "This session", ...entry }, ...s.logs].slice(0, MAX_LOGS); };

      // Simulated soil: wets only while the (simulated) pump is running.
      if (s.ctrl.pumpOn && !s.noResponse) {
        s.soil = Math.min(100, round1(s.soil + SIM_SOIL_RISE_PER_SEC));
        setSoilState(s.soil);
      }
      // Simulated sensor: when "dropout" is on, no new sample arrives.
      if (!s.dropout) s.reading = { value: s.soil, at: now };

      const { state, event } = stepController(s.ctrl, s.reading, now, cfg);
      s.ctrl = state;

      const configErrors = validateConfig(cfg);
      const issue = configErrors.length ? configErrors[0] : assessReading(s.reading, now, cfg).reason;

      if (event && event.type === "stop") {
        const runtime = Math.round(event.runtimeSec);
        const ml = Math.round(event.estimatedMl);
        s.cycles += 1;
        s.totalRuntimeSec += event.runtimeSec;
        s.totalEstimatedMl += event.estimatedMl;
        s.lastCycleSec = runtime;
        s.lastWateredAt = now;
        const water = `${ml} mL (est.)`;
        if (event.reason === "target-reached") {
          addLog({ type: "water", title: "Automatic watering completed", detail: `Pump ran ${runtime} s · stopped at target ${cfg.stopTarget}${cfg.unit}`, water });
        } else if (event.reason === "max-runtime") {
          addLog({ type: "alert", title: "Safety stop: maximum runtime reached", detail: `Pump stopped after ${runtime} s before the target was reached. Check tank, tubing and sensor`, water });
        } else {
          addLog({ type: "alert", title: "Safety stop: no valid sensor data", detail: `Pump turned off after ${runtime} s · ${event.detail}`, water });
        }
      } else if (issue && !s.prevIssue && s.samples.length > 0) {
        addLog({ type: "alert", title: "No valid sensor data", detail: `${issue}. Pump held OFF`, water: "—" });
      } else if (!issue && s.prevIssue && s.samples.length > 0) {
        addLog({ type: "check", title: "Sensor data restored", detail: "Valid readings are being received again", water: "—" });
      }
      s.prevIssue = issue;

      s.samples = [...s.samples, { t: now, v: s.dropout ? null : s.reading.value, pump: s.ctrl.pumpOn }].slice(-MAX_SAMPLES);

      setView({
        reading: s.reading,
        pumpOn: s.ctrl.pumpOn,
        cycleSeconds: s.ctrl.pumpOn ? Math.floor((now - s.ctrl.startedAt) / 1000) : 0,
        cooldownSec: s.ctrl.pumpOn ? 0 : Math.max(0, Math.ceil((s.ctrl.cooldownUntil - now) / 1000)),
        fault: s.ctrl.fault,
        dataIssue: issue,
        samples: s.samples,
        logs: s.logs,
        cycles: s.cycles,
        totalRuntimeSec: s.totalRuntimeSec,
        totalEstimatedMl: s.totalEstimatedMl,
        lastCycleSec: s.lastCycleSec,
        lastWateredAt: s.lastWateredAt,
      });
    }

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return { ...view, soil, setSoil, sensorDropout, setSensorDropout, noResponse, setNoResponse };
}
