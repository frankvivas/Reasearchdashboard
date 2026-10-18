// Run with: npm test   (uses Node's built-in test runner; no extra dependency)
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_CONFIG, initialControllerState, normalizeRaw, stepController, validateConfig } from "./watering.js";

const cfg = { ...DEMO_CONFIG };
const read = (value, at) => ({ value, at });
const S = 1000;

test("valid reading below threshold starts the pump; at/above does not", () => {
  assert.equal(stepController(initialControllerState, read(44, 0), 0, cfg).event?.type, "start");
  assert.equal(stepController(initialControllerState, read(45, 0), 0, cfg).event, null);
  assert.equal(stepController(initialControllerState, read(70, 0), 0, cfg).event, null);
});

test("no duplicate start while a cycle is running", () => {
  const { state } = stepController(initialControllerState, read(30, 0), 0, cfg);
  const again = stepController(state, read(30, 1 * S), 1 * S, cfg);
  assert.equal(again.event, null);
  assert.equal(again.state.startedAt, 0);
});

test("stops at the target and reports estimated volume = flow x runtime", () => {
  const { state } = stepController(initialControllerState, read(30, 0), 0, cfg);
  const { event, state: after } = stepController(state, read(55, 4 * S), 4 * S, cfg);
  assert.equal(event.reason, "target-reached");
  assert.equal(event.runtimeSec, 4);
  assert.ok(Math.abs(event.estimatedMl - 4 * cfg.flowMlPerSec) < 1e-9);
  assert.equal(after.pumpOn, false);
});

test("hysteresis: keeps running between start threshold and stop target", () => {
  const { state } = stepController(initialControllerState, read(40, 0), 0, cfg);
  assert.equal(stepController(state, read(50, 2 * S), 2 * S, cfg).state.pumpOn, true);
});

test("cooldown blocks an immediate restart, then allows it", () => {
  let r = stepController(initialControllerState, read(30, 0), 0, cfg);
  r = stepController(r.state, read(56, 3 * S), 3 * S, cfg);
  assert.equal(stepController(r.state, read(20, 4 * S), 4 * S, cfg).event, null);
  const later = (3 + cfg.cooldownSec) * S;
  assert.equal(stepController(r.state, read(20, later), later, cfg).event?.type, "start");
});

test("max runtime stops the pump and applies the longer fault cooldown", () => {
  let r = stepController(initialControllerState, read(30, 0), 0, cfg);
  const t = cfg.maxRunSec * S;
  r = stepController(r.state, read(30, t), t, cfg);
  assert.equal(r.event.reason, "max-runtime");
  assert.equal(r.state.fault, "max-runtime");
  const soon = t + cfg.cooldownSec * S + S;
  assert.equal(stepController(r.state, read(30, soon), soon, cfg).event, null);
  const later = t + cfg.faultCooldownSec * S;
  assert.equal(stepController(r.state, read(30, later), later, cfg).event?.type, "start");
});

test("missing, NaN, out-of-range and stale readings never start the pump", () => {
  for (const reading of [null, read(null, 0), read(NaN, 0), read(-5, 0), read(101, 0), read(10, -(cfg.staleAfterSec + 1) * S)]) {
    assert.equal(stepController(initialControllerState, reading, 0, cfg).event, null);
  }
});

test("invalid or stale data stops a running pump (fail safe)", () => {
  const { state } = stepController(initialControllerState, read(30, 0), 0, cfg);
  const stale = stepController(state, read(30, 0), (cfg.staleAfterSec + 1) * S, cfg);
  assert.equal(stale.event.reason, "invalid-data");
  assert.equal(stale.state.pumpOn, false);
  assert.equal(stepController(state, null, S, cfg).event.reason, "invalid-data");
});

test("invalid settings keep the pump off", () => {
  const bad = { ...cfg, stopTarget: 40 };
  assert.ok(validateConfig(bad).length > 0);
  assert.equal(stepController(initialControllerState, read(10, 0), 0, bad).event, null);
  assert.equal(stepController(initialControllerState, read(10, 0), 0, { ...cfg, maxRunSec: NaN }).event, null);
});

test("raw-count sensors (higher = drier) work and normalizeRaw maps calibration points", () => {
  const raw = { ...cfg, unit: "raw", higherIsWetter: false, startThreshold: 2400, stopTarget: 2000, validMin: 500, validMax: 4000 };
  assert.deepEqual(validateConfig(raw), []);
  assert.equal(stepController(initialControllerState, read(2500, 0), 0, raw).event?.type, "start");
  assert.equal(stepController(initialControllerState, read(2300, 0), 0, raw).event, null);
  const { state } = stepController(initialControllerState, read(2500, 0), 0, raw);
  assert.equal(stepController(state, read(1990, S), S, raw).event.reason, "target-reached");
  assert.equal(normalizeRaw(3000, { dryRaw: 3000, wetRaw: 1500 }), 0);
  assert.equal(normalizeRaw(1500, { dryRaw: 3000, wetRaw: 1500 }), 100);
});
