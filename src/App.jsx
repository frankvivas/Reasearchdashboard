import { useEffect, useState } from "react";
import {
  Activity, ChevronDown, CircleGauge, Clock3, Cloud, Droplets, FlaskConical,
  History, Leaf, Menu, MoreHorizontal, Monitor, Smartphone, SlidersHorizontal,
  Timer, TriangleAlert, Waves, X,
} from "lucide-react";
import { DEMO_CONFIG, isDry, validateConfig } from "./watering";
import { useSimulatedDevice } from "./useSimulatedDevice";

const CHART_WINDOW_MS = 120000;

// Moisture readings received during this browser session (simulated). Not stored history.
function MoistureChart({ samples, config, width = 760 }) {
  const height = 235;
  const padX = 34;
  const padY = 22;
  const { validMin, validMax, startThreshold, stopTarget, unit } = config;
  const span = validMax - validMin || 1;
  const end = samples.length ? samples[samples.length - 1].t : Date.now();
  const x = (t) => padX + ((t - (end - CHART_WINDOW_MS)) / CHART_WINDOW_MS) * (width - padX * 2);
  const y = (value) => padY + ((validMax - value) / span) * (height - padY * 2);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(validMin + f * span));

  // Break the line wherever the sensor delivered no reading.
  const segments = [];
  samples.forEach((sample) => {
    if (sample.v == null) { segments.push(null); return; }
    const last = segments[segments.length - 1];
    if (last) last.push(sample); else segments.push([sample]);
  });
  const lines = segments.filter((seg) => seg && seg.length > 1)
    .map((seg) => seg.map((s, i) => `${i ? "L" : "M"}${x(s.t)},${y(s.v)}`).join(" "));

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Simulated soil moisture readings from the last two minutes of this session">
        {ticks.map((tick) => <g key={tick}><line x1={padX} x2={width - padX} y1={y(tick)} y2={y(tick)} className="chart-grid" /><text x="0" y={y(tick) + 4} className="chart-label">{tick}{unit}</text></g>)}
        <line x1={padX} x2={width - padX} y1={y(startThreshold)} y2={y(startThreshold)} className="threshold-line" />
        <text x={width - padX} y={y(startThreshold) + 13} textAnchor="end" className="threshold-label">start threshold</text>
        <line x1={padX} x2={width - padX} y1={y(stopTarget)} y2={y(stopTarget)} className="threshold-line target" />
        <text x={width - padX} y={y(stopTarget) - 6} textAnchor="end" className="threshold-label">stop target</text>
        {lines.map((d, i) => <path key={i} d={d} className="moisture-line" />)}
        {samples.filter((s) => s.pump && s.v != null).map((s) => <circle key={s.t} cx={x(s.t)} cy={y(s.v)} r="3.2" className="water-point" />)}
      </svg>
      <div className="chart-times"><span>−2 min</span><span>−1 min</span><span>Now</span></div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, helper, tone = "green" }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-copy"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{helper}</p></div></article>;
}

function NumberField({ label, unit, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div><input type="number" inputMode="decimal" value={Number.isNaN(value) ? "" : value} onChange={(event) => onChange(event.target.valueAsNumber)} /><em>{unit}</em></div>
    </label>
  );
}

// ---------------------------------------------------------------------------------
// View mode: "mobile" (phone layout with bottom tabs) or "desktop" (sidebar layout).
// First visit picks by screen width; after that the user's choice is remembered.
// On a real phone, "desktop" asks the browser for a wide page (like "Request desktop
// site"); on a computer, "mobile" shows the phone layout in a centered phone-width column.
// ---------------------------------------------------------------------------------
const VIEW_KEY = "aquaroot-view-mode";

function initialViewMode() {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "mobile" || saved === "desktop") return saved;
  } catch { /* storage unavailable: fall through to auto-detect */ }
  return window.matchMedia("(max-width: 620px)").matches ? "mobile" : "desktop";
}

function useViewMode() {
  const [mode, setModeState] = useState(initialViewMode);
  const setMode = (next) => {
    setModeState(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* ignore */ }
  };
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const isPhone = Math.min(window.screen.width, window.screen.height) < 700;
    if (meta) meta.setAttribute("content", mode === "desktop" && isPhone ? "width=1280" : "width=device-width, initial-scale=1.0");
    document.documentElement.dataset.view = mode;
    window.scrollTo(0, 0);
  }, [mode]);
  return [mode, setMode];
}

function ViewSwitch({ mode, setMode }) {
  return (
    <div className="view-switch" role="group" aria-label="Switch between mobile and desktop view">
      <button type="button" aria-pressed={mode === "mobile"} onClick={() => setMode("mobile")}><Smartphone size={15} /><span>Mobile</span></button>
      <button type="button" aria-pressed={mode === "desktop"} onClick={() => setMode("desktop")}><Monitor size={15} /><span>Desktop</span></button>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Shared panels. Both layouts render these from the same model `m`, so the data and
// the automatic-only behavior are identical in mobile and desktop view.
// ---------------------------------------------------------------------------------
function SimBanner() {
  return <div className="sim-banner" role="note"><TriangleAlert size={16} /><p><strong>Simulation.</strong> Readings, pump state, history and water use on this page are generated in your browser for demonstration. No ESP32 is connected, no physical pump is controlled, and nothing here is a research result.</p></div>;
}

function MoisturePanel({ m }) {
  const { value, unit, config, plantStatus, statusTone, ringStyle, bandStyle, pct } = m;
  const { startThreshold, stopTarget } = config;
  return (
    <article className="panel moisture-panel">
      <div className="panel-heading"><div><p className="eyebrow">CURRENT READING</p><h2>Soil moisture</h2></div><button className="more-button" aria-label="More moisture options"><MoreHorizontal size={20} /></button></div>
      <div className="moisture-layout"><div className="moisture-ring" style={ringStyle}><div><Droplets size={24} /><strong>{value == null ? "—" : Math.round(value)}<small>{value == null ? "" : unit}</small></strong><span>Moisture</span></div></div><div className="moisture-detail"><span className={`status-pill ${statusTone}`}><i /> {plantStatus}</span><h3>{value == null ? "Waiting for a valid reading" : isDry(value, config) ? "Below the watering threshold" : "At or above the watering threshold"}</h3><p>A valid reading below <strong>{startThreshold}{unit}</strong> starts the pump automatically; it stops at <strong>{stopTarget}{unit}</strong>. These are demo settings for the selected plant, not universal values.</p><div className="range-labels"><span>Dry</span><span>Watering band {startThreshold}–{stopTarget}{unit}</span><span>Wet</span></div><div className="range-bar" style={bandStyle}>{value != null && <i style={{ left: `${pct(value)}%` }} />}</div></div></div>
    </article>
  );
}

function PumpPanel({ m }) {
  const { device, pumpOn, pumpTitle, pumpNote, dataIssue, fault, config } = m;
  return (
    <article className={`panel pump-panel ${pumpOn ? "running" : ""}`}>
      <div className="panel-heading"><div><p className="eyebrow">AUTOMATIC PUMP · SIMULATED</p><h2>{pumpTitle}</h2></div><span className={`pump-state ${pumpOn ? "on" : ""}`}>{pumpOn ? "ON" : "OFF"}</span></div>
      <div className="pump-visual"><span><Waves size={28} /></span><div className="pump-ripple one" /><div className="pump-ripple two" /></div>
      <div className="pump-meta"><div><span>Current cycle</span><strong>{device.cycleSeconds} sec</strong></div><div><span>Flow rate (demo value)</span><strong>{config.flowMlPerSec} mL/s</strong></div></div>
      <p className={`pump-note ${fault || dataIssue ? "alert" : ""}`}>{pumpNote}</p>
    </article>
  );
}

function StatsGrid({ m }) {
  const { device, estimatedMl, runtimeSec, plantStatus, gap, value, dataIssue, config } = m;
  return (
    <section className="stats-grid">
      <StatCard icon={Droplets} label="Est. water used (session)" value={estimatedMl} unit=" mL" helper={`Flow rate × runtime · ${device.cycles} cycle${device.cycles === 1 ? "" : "s"}`} tone="blue" />
      <StatCard icon={Timer} label="Pump runtime (session)" value={runtimeSec} unit=" sec" helper={device.lastCycleSec == null ? "No cycles yet" : `${device.lastCycleSec} seconds last cycle`} tone="amber" />
      <StatCard icon={Clock3} label="Last watered" value={device.lastWateredAt ? new Date(device.lastWateredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"} unit="" helper="Most recent automatic cycle" tone="green" />
      <StatCard icon={Leaf} label="Plant status" value={plantStatus} unit="" helper={gap == null ? (dataIssue || "") : `${gap}${config.unit} ${isDry(value, config) ? "below" : "above"} start threshold`} tone="violet" />
    </section>
  );
}

function TrendPanel({ m, width }) {
  return <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">THIS SESSION · SIMULATED</p><h2>Moisture trend</h2></div><div className="legend"><span><i className="moisture-key" /> Moisture</span><span><i className="water-key" /> Pump on</span></div></div><MoistureChart samples={m.device.samples} config={m.config} width={width} /></article>;
}

function CalibrationPanel({ m }) {
  const { config, setting, configErrors } = m;
  const { unit } = config;
  return (
    <article className="panel threshold-panel" id="threshold">
      <div className="panel-heading"><div><p className="eyebrow">SELECTED PLANT SETTINGS</p><h2>Calibration</h2></div><SlidersHorizontal size={20} /></div>
      <p>Defaults are demo placeholders. Replace them with the values from your sensor, pump and plant calibration. The threshold applies only to the selected plant and growing medium.</p>
      <div className="settings-grid">
        <NumberField label="Start below" unit={unit} value={config.startThreshold} onChange={setting("startThreshold")} />
        <NumberField label="Stop at" unit={unit} value={config.stopTarget} onChange={setting("stopTarget")} />
        <NumberField label="Max pump runtime" unit="s" value={config.maxRunSec} onChange={setting("maxRunSec")} />
        <NumberField label="Cooldown" unit="s" value={config.cooldownSec} onChange={setting("cooldownSec")} />
        <NumberField label="Flow rate" unit="mL/s" value={config.flowMlPerSec} onChange={setting("flowMlPerSec")} />
      </div>
      {configErrors.length > 0 && <p className="field-error" role="alert">{configErrors[0]}. The pump stays OFF until this is fixed.</p>}
      <p className="field-note">Safety: the pump is held OFF when a reading is missing, older than {config.staleAfterSec} s, or outside {config.validMin}–{config.validMax}{unit}.</p>
    </article>
  );
}

function SimulationPanel({ m }) {
  const { device, config, preset } = m;
  const { unit, startThreshold, stopTarget } = config;
  return (
    <section className="panel sim-panel" id="simulation">
      <div className="panel-heading"><div><p className="eyebrow">TEST / SIMULATION INPUTS</p><h2>Simulated sensor inputs</h2></div><FlaskConical size={20} /></div>
      <p>These change the <strong>simulated soil sensor only</strong>. They are not pump controls; the automatic rule alone decides when the simulated pump runs.</p>
      <div className="sim-grid">
        <div>
          <div className="control-label"><span>Simulated soil moisture</span><strong>{Math.round(device.soil)}{unit}</strong></div>
          <input type="range" min={config.validMin} max={config.validMax} value={device.soil} onChange={(event) => device.setSoil(Number(event.target.value))} aria-label="Simulated soil moisture sensor value" />
          <div className="preset-buttons"><button type="button" onClick={() => device.setSoil(preset(startThreshold - 10))}>Dry · {preset(startThreshold - 10)}{unit}</button><button type="button" onClick={() => device.setSoil(preset((startThreshold + stopTarget) / 2))}>Mid · {preset((startThreshold + stopTarget) / 2)}{unit}</button><button type="button" onClick={() => device.setSoil(preset(stopTarget + 10))}>Wet · {preset(stopTarget + 10)}{unit}</button></div>
        </div>
        <div className="toggle-list">
          <label className="toggle-row"><input type="checkbox" checked={device.sensorDropout} onChange={(event) => device.setSensorDropout(event.target.checked)} /><span><strong>Simulate sensor dropout</strong><small>No new readings arrive. The pump must turn off or stay off.</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={device.noResponse} onChange={(event) => device.setNoResponse(event.target.checked)} /><span><strong>Simulate pump not wetting the soil</strong><small>Tests the maximum-runtime safety stop (e.g. empty tank).</small></span></label>
        </div>
      </div>
    </section>
  );
}

function ActivityPanel({ m }) {
  const { historyLogs, showAll, setShowAll } = m;
  return (
    <section className="panel activity-panel" id="activity">
      <div className="panel-heading"><div><p className="eyebrow">THIS SESSION · AUTOMATIC EVENTS ONLY</p><h2>Recent activity</h2></div><button className="text-button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show less" : "View all activity"}</button></div>
      <div className="activity-table" role="table" aria-label="Recent automatic watering activity"><div className="activity-head" role="row"><span>Activity</span><span>Duration / result</span><span>Est. water used</span><span>Time</span></div>{historyLogs.length === 0 && <div className="activity-empty">No automatic watering events yet in this session. Lower the simulated moisture below the start threshold to see one.</div>}{historyLogs.map((log) => <div className="activity-row" role="row" key={log.id}><div className={`activity-icon ${log.type}`}><span>{log.type === "water" ? <Droplets size={18} /> : log.type === "alert" ? <TriangleAlert size={18} /> : <Activity size={18} />}</span><p><strong>{log.title}</strong><small>{log.date}</small></p></div><span>{log.detail}</span><strong>{log.water}</strong><time>{log.time}</time></div>)}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------------
// Desktop layout (sidebar + wide grid)
// ---------------------------------------------------------------------------------
function DesktopLayout({ m, mode, setMode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { device, dataIssue, readingAge } = m;
  return (
    <div className="dashboard-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={21} /></button>
        <nav aria-label="Main navigation">
          <a className="active" href="#overview"><CircleGauge size={18} /> Overview</a><a href="#monitor"><Activity size={18} /> Live monitor</a><a href="#activity"><History size={18} /> Watering log</a><a href="#threshold"><SlidersHorizontal size={18} /> Calibration</a>
        </nav>
        <div className="device-card"><div className="device-card-head"><span className="online-pulse offline" /><strong>Simulated device</strong></div><p>No ESP32 connected</p><div><span>Mode</span><strong>Simulation</strong></div><div><span>Last reading</span><strong>{readingAge == null ? "None" : `${readingAge} s ago`}</strong></div></div>
        <a className="settings-link" href="#simulation"><FlaskConical size={18} /> Simulation inputs</a>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <div className="plant-picker"><span className="plant-avatar"><Leaf size={18} /></span><div><small>Monitoring</small><strong>Selected potted plant</strong></div><ChevronDown size={17} /></div>
          <div className="top-actions"><span className="sync-status"><Cloud size={16} /> {dataIssue ? "No valid sensor data" : "Simulated sensor"}</span><ViewSwitch mode={mode} setMode={setMode} /></div>
        </header>

        <div className="page" id="overview">
          <SimBanner />
          <section className="welcome-row"><div><p className="eyebrow">AUTOMATIC WATERING</p><h1>Soil moisture and pump monitor</h1><p>The pump is controlled only by the automatic moisture rule. This dashboard monitors it.</p></div><div className="updated"><span className={`online-pulse ${dataIssue ? "offline" : ""}`} /> Simulated data <small>{readingAge == null ? "Waiting for reading" : dataIssue ? "Reading unavailable" : `Reading ${readingAge} s ago`}</small></div></section>
          <section className="overview-grid" id="monitor"><MoisturePanel m={m} /><PumpPanel m={m} /></section>
          <StatsGrid m={m} />
          <section className="content-grid"><TrendPanel m={m} /><CalibrationPanel m={m} /></section>
          <SimulationPanel m={m} />
          <ActivityPanel m={m} />
        </div>
      </main>
      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Mobile layout (single column, bottom tab bar, large touch targets)
// ---------------------------------------------------------------------------------
const MOBILE_TABS = [
  { id: "monitor", label: "Monitor", icon: CircleGauge },
  { id: "log", label: "Log", icon: History },
  { id: "calibration", label: "Calibrate", icon: SlidersHorizontal },
  { id: "simulate", label: "Simulate", icon: FlaskConical },
];

function MobileLayout({ m, mode, setMode }) {
  const [tab, setTab] = useState("monitor");
  const { dataIssue, readingAge, value, unit, pumpOn } = m;
  const openTab = (id) => { setTab(id); window.scrollTo(0, 0); };
  return (
    <div className="mobile-shell">
      <header className="m-header">
        <div className="plant-picker"><span className="plant-avatar"><Leaf size={18} /></span><div><small>{dataIssue ? "No valid sensor data" : readingAge == null ? "Waiting for reading" : `Simulated · ${readingAge} s ago`}</small><strong>Selected potted plant</strong></div></div>
        <ViewSwitch mode={mode} setMode={setMode} />
      </header>

      <main className="m-body" id="overview">
        {tab === "monitor" && <>
          <SimBanner />
          <MoisturePanel m={m} />
          <PumpPanel m={m} />
          <StatsGrid m={m} />
          <TrendPanel m={m} width={360} />
        </>}
        {tab === "log" && <ActivityPanel m={m} />}
        {tab === "calibration" && <CalibrationPanel m={m} />}
        {tab === "simulate" && <>
          <div className="m-mini" aria-live="polite"><div><span>Moisture</span><strong>{value == null ? "—" : `${Math.round(value)}${unit}`}</strong></div><div><span>Pump (automatic)</span><strong className={pumpOn ? "on" : ""}>{pumpOn ? "ON" : "OFF"}</strong></div></div>
          <SimulationPanel m={m} />
        </>}
      </main>

      <nav className="m-tabs" aria-label="Sections">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => openTab(id)}><Icon size={20} />{label}</button>)}
      </nav>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useViewMode();
  const [showAll, setShowAll] = useState(false);
  // Settings for the selected plant. The defaults are demo placeholders, not calibrated values.
  const [config, setConfig] = useState(DEMO_CONFIG);
  const device = useSimulatedDevice(config);
  const setting = (key) => (value) => setConfig((current) => ({ ...current, [key]: value }));
  const configErrors = validateConfig(config);

  const { reading, pumpOn, dataIssue, fault } = device;
  const value = dataIssue || !reading ? null : reading.value;
  const { unit, startThreshold, stopTarget, flowMlPerSec, maxRunSec } = config;
  const plantStatus = dataIssue ? "No valid reading" : pumpOn ? "Watering" : fault ? "Check system" : isDry(value, config) ? "Below threshold" : "At/above threshold";
  const statusTone = plantStatus === "At/above threshold" ? "healthy" : "warning";
  const gap = value == null ? null : Math.round(Math.abs(value - startThreshold) * 10) / 10;
  const readingAge = reading ? Math.max(0, Math.round((Date.now() - reading.at) / 1000)) : null;
  const span = config.validMax - config.validMin || 1;
  const pct = (v) => Math.min(100, Math.max(0, ((v - config.validMin) / span) * 100));
  const ringStyle = { "--moisture": `${(value == null ? 0 : pct(value)) * 3.6}deg` };
  const bandStyle = { background: `linear-gradient(90deg,#e8c585 0 ${pct(startThreshold)}%,#7bb79a ${pct(startThreshold)}% ${pct(stopTarget)}%,#85b5cf ${pct(stopTarget)}%)` };

  // Estimated volume = flow rate x pump runtime. No measured (dispensed) volume is recorded here.
  const estimatedMl = Math.round(device.totalEstimatedMl + (pumpOn ? device.cycleSeconds * flowMlPerSec : 0));
  const runtimeSec = Math.round(device.totalRuntimeSec + (pumpOn ? device.cycleSeconds : 0));
  const activeCycle = pumpOn ? [{
    id: "active-automatic-cycle", type: "water", title: "Automatic watering in progress",
    detail: `Pump running for ${device.cycleSeconds} s · max ${maxRunSec} s`,
    water: `${Math.round(device.cycleSeconds * flowMlPerSec)} mL (est.)`, time: "Now", date: "Simulation",
  }] : [];
  const historyLogs = [...activeCycle, ...(showAll ? device.logs : device.logs.slice(0, 4))];

  const pumpTitle = pumpOn ? "Automatic watering" : device.cooldownSec > 0 ? "Resting between cycles" : "Pump is idle";
  const pumpNote = pumpOn ? `Stops at ${stopTarget}${unit} or after ${maxRunSec} s, whichever comes first`
    : dataIssue ? `Pump held OFF: ${dataIssue}`
    : fault ? "Stopped at the maximum runtime. Check water tank, tubing and sensor."
    : device.cooldownSec > 0 ? `Next automatic cycle allowed in ${device.cooldownSec} s`
    : `Automatic only · starts when a valid reading falls below ${startThreshold}${unit}`;
  const preset = (v) => Math.round(Math.min(config.validMax, Math.max(config.validMin, v)));

  const m = {
    device, config, setting, configErrors, value, unit, pumpOn, dataIssue, fault, plantStatus, statusTone, gap,
    readingAge, pct, ringStyle, bandStyle, estimatedMl, runtimeSec, historyLogs, showAll, setShowAll,
    pumpTitle, pumpNote, preset,
  };
  return mode === "mobile" ? <MobileLayout m={m} mode={mode} setMode={setMode} /> : <DesktopLayout m={m} mode={mode} setMode={setMode} />;
}
