// Automatic watering control logic (pure functions, no React, no I/O).
//
// There is intentionally NO function here that starts or stops the pump on request.
// The only way the pump state changes is stepController(), which decides from the
// latest sensor reading and the clock. In a real build this same logic belongs in the
// ESP32 firmware; the dashboard would only display what the ESP32 reports.
//
// Units: the controller is unit-agnostic. Thresholds, the valid range and readings must
// all be in the same unit - either a normalized percentage (0-100) or calibrated raw
// sensor counts. Capacitive sensors usually read HIGHER when DRY, so set
// higherIsWetter = false for raw counts (see normalizeRaw for the percentage option).

// DEMO PLACEHOLDERS ONLY. None of these are research-validated. The selected plant's
// threshold, the pump flow rate and the safety limits must come from the calibration
// procedure in Chapter 3 (sensor calibration, threshold establishment, pump calibration).
export const DEMO_CONFIG = {
  unit: "%",
  higherIsWetter: true,
  startThreshold: 45, // start watering when a valid reading falls BELOW this (hysteresis low edge)
  stopTarget: 55,     // stop watering when a valid reading reaches this (hysteresis high edge)
  validMin: 0,        // readings outside [validMin, validMax] are treated as a sensor fault
  validMax: 100,
  staleAfterSec: 5,   // a reading older than this is not trusted
  maxRunSec: 20,      // hard cap on one pump cycle (empty tank, disconnected tube, stuck sensor)
  cooldownSec: 15,    // minimum rest after any cycle so water can spread to the sensor
  faultCooldownSec: 60, // longer rest after a max-runtime stop, since something is likely wrong
  flowMlPerSec: 9.1,  // calibrated pump flow rate (placeholder until measured)
};

export const initialControllerState = {
  pumpOn: false,
  startedAt: null,     // ms timestamp when the current cycle started
  cooldownUntil: 0,    // ms timestamp before which a new cycle may not start
  fault: null,         // "max-runtime" until a later cycle ends by reaching the target
};

// Convert a raw ADC count to a 0-100 wetness percentage using the two calibration points
// measured for THIS sensor in THIS growing medium (dryRaw in air/dry soil, wetRaw wet).
// The result is deliberately not clamped: an out-of-range value is a sensor fault.
export function normalizeRaw(raw, { dryRaw, wetRaw }) {
  return ((dryRaw - raw) / (dryRaw - wetRaw)) * 100;
}

// Returns a list of problems with the settings. Any problem keeps the pump off.
export function validateConfig(cfg) {
  const errors = [];
  const num = (key) => Number.isFinite(cfg[key]);
  ["startThreshold", "stopTarget", "validMin", "validMax", "staleAfterSec", "maxRunSec", "cooldownSec", "faultCooldownSec", "flowMlPerSec"]
    .forEach((key) => { if (!num(key)) errors.push(`${key} must be a number`); });
  if (errors.length) return errors;
  if (cfg.validMin >= cfg.validMax) errors.push("Valid range minimum must be below its maximum");
  if (cfg.startThreshold < cfg.validMin || cfg.startThreshold > cfg.validMax) errors.push("Start threshold must be inside the valid range");
  if (cfg.stopTarget < cfg.validMin || cfg.stopTarget > cfg.validMax) errors.push("Stop target must be inside the valid range");
  if (cfg.higherIsWetter ? cfg.stopTarget <= cfg.startThreshold : cfg.stopTarget >= cfg.startThreshold) {
    errors.push("Stop target must be on the wetter side of the start threshold");
  }
  if (cfg.maxRunSec <= 0) errors.push("Maximum runtime must be greater than 0");
  if (cfg.staleAfterSec <= 0) errors.push("Stale-reading limit must be greater than 0");
  if (cfg.cooldownSec < 0 || cfg.faultCooldownSec < 0) errors.push("Cooldowns cannot be negative");
  if (cfg.flowMlPerSec < 0) errors.push("Flow rate cannot be negative");
  return errors;
}

// A reading is { value, at } where `at` is the ms timestamp the sensor sampled it.
// Missing, non-numeric, out-of-range or old readings are invalid.
export function assessReading(reading, now, cfg) {
  if (!reading || reading.value == null || reading.at == null) return { valid: false, reason: "No sensor reading" };
  if (!Number.isFinite(reading.value)) return { valid: false, reason: "Sensor reading is not a number" };
  if (reading.value < cfg.validMin || reading.value > cfg.validMax) return { valid: false, reason: "Sensor reading is outside the valid range" };
  if (now - reading.at > cfg.staleAfterSec * 1000) return { valid: false, reason: "Sensor reading is stale" };
  return { valid: true, reason: null };
}

export const isDry = (value, cfg) => (cfg.higherIsWetter ? value < cfg.startThreshold : value > cfg.startThreshold);
export const reachedTarget = (value, cfg) => (cfg.higherIsWetter ? value >= cfg.stopTarget : value <= cfg.stopTarget);

// One control decision. Call it on every sample (and it is safe to call it often).
// Returns { state, event } where event is null, { type: "start" } or
// { type: "stop", reason, runtimeSec, estimatedMl, detail? }.
//
// Order of checks - safety first, but safeguards only act when something is wrong:
//   1. Bad settings or bad/stale/missing data -> pump OFF (fail safe), never start.
//   2. Running and target reached             -> stop (the normal stop condition).
//   3. Running and max runtime exceeded       -> stop + longer cooldown (safety stop).
//   4. Idle, not cooling down, valid reading below start threshold -> start (normal start).
// A start is impossible while pumpOn is true, so duplicate cycles cannot happen.
export function stepController(state, reading, now, cfg) {
  const configErrors = validateConfig(cfg);
  const check = configErrors.length ? { valid: false, reason: configErrors[0] } : assessReading(reading, now, cfg);

  if (state.pumpOn) {
    const runtimeSec = Math.max(0, (now - state.startedAt) / 1000);
    const stopWith = (reason, extra = {}) => {
      const cooldownMs = (reason === "max-runtime" ? Math.max(cfg.cooldownSec, cfg.faultCooldownSec) : cfg.cooldownSec) * 1000;
      return {
        state: { pumpOn: false, startedAt: null, cooldownUntil: now + cooldownMs, fault: reason === "max-runtime" ? "max-runtime" : reason === "target-reached" ? null : state.fault },
        event: { type: "stop", reason, runtimeSec, estimatedMl: runtimeSec * cfg.flowMlPerSec, ...extra },
      };
    };
    if (!check.valid) return stopWith("invalid-data", { detail: check.reason });
    if (reachedTarget(reading.value, cfg)) return stopWith("target-reached");
    if (runtimeSec >= cfg.maxRunSec) return stopWith("max-runtime");
    return { state, event: null };
  }

  if (check.valid && now >= state.cooldownUntil && isDry(reading.value, cfg)) {
    return { state: { ...state, pumpOn: true, startedAt: now }, event: { type: "start" } };
  }
  return { state, event: null };
}
