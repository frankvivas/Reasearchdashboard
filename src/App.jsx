import { useEffect, useMemo, useState } from "react";
import {
  Activity, ChevronDown, CircleGauge, Clock3, Cloud, Droplets,
  History, Leaf, Menu, MoreHorizontal, Power, Settings,
  SlidersHorizontal, Timer, Waves, X,
} from "lucide-react";

const startingLogs = [
  { id: 1, type: "water", title: "Automatic watering completed", detail: "Pump ran for 18 seconds", water: "164 mL", time: "2:14 PM", date: "Today" },
  { id: 2, type: "check", title: "Moisture level restored", detail: "Moisture increased from 39% to 63%", water: "—", time: "2:15 PM", date: "Today" },
  { id: 3, type: "water", title: "Automatic watering completed", detail: "Pump ran for 17 seconds", water: "155 mL", time: "7:42 AM", date: "Today" },
  { id: 4, type: "check", title: "Routine sensor reading", detail: "Moisture remained within healthy range", water: "—", time: "9:30 PM", date: "Yesterday" },
];

const moisturePoints = [68, 66, 63, 59, 54, 48, 42, 39, 61, 64, 61, 57, 52, 46, 39, 62, 65, 64];

function MoistureChart({ threshold }) {
  const width = 760;
  const height = 235;
  const padX = 34;
  const padY = 22;
  const x = (index) => padX + (index / (moisturePoints.length - 1)) * (width - padX * 2);
  const y = (value) => padY + ((80 - value) / 60) * (height - padY * 2);
  const line = moisturePoints.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ");
  const area = `${line} L${x(moisturePoints.length - 1)},${height - padY} L${padX},${height - padY} Z`;
  const thresholdY = y(threshold);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Soil moisture trend for the last 24 hours">
        <defs><linearGradient id="moisture-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--teal)" stopOpacity=".22" /><stop offset="1" stopColor="var(--teal)" stopOpacity="0" /></linearGradient></defs>
        {[20, 40, 60, 80].map((tick) => <g key={tick}><line x1={padX} x2={width - padX} y1={y(tick)} y2={y(tick)} className="chart-grid" /><text x="0" y={y(tick) + 4} className="chart-label">{tick}%</text></g>)}
        <line x1={padX} x2={width - padX} y1={thresholdY} y2={thresholdY} className="threshold-line" />
        <text x={width - padX} y={thresholdY - 7} textAnchor="end" className="threshold-label">watering threshold</text>
        <path d={area} fill="url(#moisture-area)" /><path d={line} className="moisture-line" />
        {[8, 15].map((index) => <g key={index}><circle cx={x(index)} cy={y(moisturePoints[index])} r="6" className="water-point" /><circle cx={x(index)} cy={y(moisturePoints[index])} r="2" className="water-point-core" /></g>)}
      </svg>
      <div className="chart-times"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>Now</span></div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, helper, tone = "green" }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-copy"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{helper}</p></div></article>;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moisture, setMoisture] = useState(64);
  const [threshold, setThreshold] = useState(45);
  const [pumpOn, setPumpOn] = useState(false);
  const [pumpMode, setPumpMode] = useState(null);
  const [pumpSeconds, setPumpSeconds] = useState(0);
  const [waterToday, setWaterToday] = useState(319);
  const [lastWatered, setLastWatered] = useState("2:14 PM");
  const [logs, setLogs] = useState(startingLogs);
  const [showAll, setShowAll] = useState(false);
  const plantStatus = moisture < threshold ? "Needs water" : moisture > 78 ? "Too wet" : "Healthy";
  const visibleLogs = showAll ? logs : logs.slice(0, 4);
  const historyLogs = pumpOn && pumpMode === "automatic"
    ? [{
        id: "active-automatic-cycle",
        type: "water",
        title: "Automatic watering in progress",
        detail: `Pump running for ${pumpSeconds} second${pumpSeconds === 1 ? "" : "s"}`,
        water: `${Math.round(pumpSeconds * 9.1)} mL used`,
        time: "Now",
        date: "Simulation",
      }, ...visibleLogs]
    : visibleLogs;
  const thresholdGap = Math.round(Math.abs(moisture - threshold));

  function finishWatering(duration, mode) {
    setPumpOn(false);
    setPumpMode(null);
    const now = new Date();
    const completedAt = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const estimatedWater = Math.round(duration * 9.1);
    setLastWatered(completedAt);
    setLogs((current) => [{
      id: Date.now(),
      type: "water",
      title: `${mode === "automatic" ? "Automatic" : "Manual"} watering completed`,
      detail: `Pump ran for ${duration} second${duration === 1 ? "" : "s"}`,
      water: `${estimatedWater} mL`,
      time: completedAt,
      date: "Today",
    }, ...current]);
  }

  useEffect(() => {
    if (moisture < threshold && !pumpOn) {
      setPumpSeconds(0);
      setPumpMode("automatic");
      setPumpOn(true);
    }
  }, [moisture, threshold, pumpOn]);

  useEffect(() => {
    if (!pumpOn) return undefined;
    const timer = window.setInterval(() => {
      setPumpSeconds((current) => current + 1);
      setWaterToday((current) => Math.round((current + 9.1) * 10) / 10);
      setMoisture((current) => Math.min(90, Math.round((current + 3.2) * 10) / 10));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pumpOn]);

  useEffect(() => {
    if (!pumpOn || pumpSeconds < 1) return;
    const automaticTargetReached = pumpMode === "automatic" && moisture >= threshold + 10;
    const manualCycleComplete = pumpMode === "manual" && pumpSeconds >= 12;
    if (automaticTargetReached || manualCycleComplete) finishWatering(pumpSeconds, pumpMode);
  }, [moisture, pumpMode, pumpOn, pumpSeconds, threshold]);

  function togglePump() {
    if (pumpOn && pumpMode === "manual") return finishWatering(pumpSeconds, "manual");
    if (pumpOn) return;
    setPumpSeconds(0);
    setPumpMode("manual");
    setPumpOn(true);
  }

  const ringStyle = useMemo(() => ({ "--moisture": `${Math.min(100, moisture) * 3.6}deg` }), [moisture]);

  return (
    <div className="dashboard-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={21} /></button>
        <nav aria-label="Main navigation">
          <a className="active" href="#overview"><CircleGauge size={18} /> Overview</a><a href="#monitor"><Activity size={18} /> Live monitor</a><a href="#activity"><History size={18} /> Watering log</a><a href="#threshold"><SlidersHorizontal size={18} /> Thresholds</a>
        </nav>
        <div className="device-card"><div className="device-card-head"><span className="online-pulse" /><strong>ESP32 connected</strong></div><p>Plant Sensor 01</p><div><span>Signal</span><strong>Excellent</strong></div><div><span>Last update</span><strong>Just now</strong></div></div>
        <a className="settings-link" href="#settings"><Settings size={18} /> System settings</a>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <div className="plant-picker"><span className="plant-avatar"><Leaf size={18} /></span><div><small>Monitoring</small><strong>Living Room Monstera</strong></div><ChevronDown size={17} /></div>
          <div className="top-actions"><span className="sync-status"><Cloud size={16} /> Sensor online</span></div>
        </header>

        <div className="page" id="overview">
          <section className="welcome-row"><div><p className="eyebrow">PLANT OVERVIEW</p><h1>Your plant is doing well.</h1><p>Live readings and watering activity from your automatic care system.</p></div><div className="updated"><span className="online-pulse" /> Live data <small>Updated just now</small></div></section>

          <section className="overview-grid" id="monitor">
            <article className="panel moisture-panel">
              <div className="panel-heading"><div><p className="eyebrow">CURRENT READING</p><h2>Soil moisture</h2></div><button className="more-button" aria-label="More moisture options"><MoreHorizontal size={20} /></button></div>
              <div className="moisture-layout"><div className="moisture-ring" style={ringStyle}><div><Droplets size={24} /><strong>{Math.round(moisture)}<small>%</small></strong><span>Moisture</span></div></div><div className="moisture-detail"><span className={`status-pill ${plantStatus === "Healthy" ? "healthy" : "warning"}`}><i /> {plantStatus}</span><h3>{plantStatus === "Healthy" ? "Moisture is in the ideal range" : "The plant needs attention"}</h3><p>The pump will start automatically when moisture drops below <strong>{threshold}%</strong>.</p><div className="range-labels"><span>Dry</span><span>Ideal range</span><span>Wet</span></div><div className="range-bar"><i style={{ left: `${moisture}%` }} /></div></div></div>
            </article>

            <article className={`panel pump-panel ${pumpOn ? "running" : ""}`}>
              <div className="panel-heading"><div><p className="eyebrow">PUMP CONTROL</p><h2>{pumpOn ? `${pumpMode === "automatic" ? "Automatic" : "Manual"} watering` : "Pump is idle"}</h2></div><span className={`pump-state ${pumpOn ? "on" : ""}`}>{pumpOn ? "ON" : "OFF"}</span></div>
              <div className="pump-visual"><span><Waves size={28} /></span><div className="pump-ripple one" /><div className="pump-ripple two" /></div>
              <div className="pump-meta"><div><span>Current cycle</span><strong>{pumpSeconds} sec</strong></div><div><span>Flow rate</span><strong>9.1 mL/s</strong></div></div>
              <button className="water-button" onClick={togglePump} disabled={pumpMode === "automatic"}><Power size={18} /> {pumpMode === "automatic" ? "Automatic cycle running" : pumpOn ? "Stop watering" : "Water plant now"}</button><p className="button-note">{pumpMode === "automatic" ? `Stops at ${threshold + 10}% moisture` : "Manual control · automatically stops after 12 seconds"}</p>
            </article>
          </section>

          <section className="stats-grid">
            <StatCard icon={Droplets} label="Water used today" value={Math.round(waterToday)} unit=" mL" helper={`Across ${logs.filter((log) => log.type === "water" && log.date === "Today").length} watering cycles`} tone="blue" /><StatCard icon={Timer} label="Total pump runtime" value={35 + pumpSeconds} unit=" sec" helper="18 seconds last cycle" tone="amber" /><StatCard icon={Clock3} label="Last watered" value={lastWatered} unit="" helper="Most recent completed cycle" tone="green" /><StatCard icon={Leaf} label="Plant status" value={plantStatus} unit="" helper={`${thresholdGap}% ${moisture >= threshold ? "above" : "below"} threshold`} tone="violet" />
          </section>

          <section className="content-grid">
            <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">LAST 24 HOURS</p><h2>Moisture trend</h2></div><div className="legend"><span><i className="moisture-key" /> Moisture</span><span><i className="water-key" /> Watered</span></div></div><MoistureChart threshold={threshold} /></article>
            <article className="panel threshold-panel" id="threshold">
              <div className="panel-heading"><div><p className="eyebrow">TEST MODE</p><h2>Simulation controls</h2></div><SlidersHorizontal size={20} /></div>
              <p>Change the sensor reading to test the automatic watering response.</p>
              <div className="control-label"><span>Simulated soil moisture</span><strong>{Math.round(moisture)}%</strong></div>
              <input type="range" min="10" max="90" value={moisture} onChange={(event) => setMoisture(Number(event.target.value))} aria-label="Simulated soil moisture level" />
              <div className="preset-buttons"><button type="button" onClick={() => setMoisture(30)}>Dry · 30%</button><button type="button" onClick={() => setMoisture(60)}>Normal · 60%</button><button type="button" onClick={() => setMoisture(85)}>Wet · 85%</button></div>
              <div className="control-divider" />
              <div className="control-label"><span>Automatic watering threshold</span><strong>{threshold}%</strong></div>
              <input type="range" min="25" max="65" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} aria-label="Automatic watering moisture threshold" />
              <div className="slider-labels"><span>25% drier</span><span>65% wetter</span></div>
            </article>
          </section>

          <section className="panel activity-panel" id="activity">
            <div className="panel-heading"><div><p className="eyebrow">SYSTEM HISTORY</p><h2>Recent activity</h2></div><button className="text-button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show less" : "View all activity"}</button></div>
            <div className="activity-table" role="table" aria-label="Recent plant activity"><div className="activity-head" role="row"><span>Activity</span><span>Duration / result</span><span>Est. water used</span><span>Time</span></div>{historyLogs.map((log) => <div className="activity-row" role="row" key={log.id}><div className={`activity-icon ${log.type}`}><span>{log.type === "water" ? <Droplets size={18} /> : <Activity size={18} />}</span><p><strong>{log.title}</strong><small>{log.date}</small></p></div><span>{log.detail}</span><strong>{log.water}</strong><time>{log.time}</time></div>)}</div>
          </section>
        </div>
      </main>
      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    </div>
  );
}
