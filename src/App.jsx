import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  Lightbulb,
  Menu,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

const projects = [
  {
    id: 1,
    title: "The future of focused work",
    description: "How environments, tools, and rituals shape deep concentration.",
    status: "In progress",
    progress: 72,
    sources: 18,
    updated: "2h ago",
    color: "coral",
  },
  {
    id: 2,
    title: "Designing for trust",
    description: "Patterns that help people understand and control AI systems.",
    status: "Synthesis",
    progress: 48,
    sources: 31,
    updated: "Yesterday",
    color: "blue",
  },
  {
    id: 3,
    title: "Small teams, big leverage",
    description: "A study of high-output teams and their operating principles.",
    status: "Collecting",
    progress: 25,
    sources: 12,
    updated: "Oct 14",
    color: "gold",
  },
];

const notes = [
  { title: "Attention is an environment", project: "Focused work", time: "Today, 10:24" },
  { title: "Trust grows from legibility", project: "Designing for trust", time: "Yesterday" },
  { title: "Coordination cost compounds", project: "Small teams", time: "Oct 13" },
];

function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <div className={`project-icon ${project.color}`}>
        <FlaskConical size={19} strokeWidth={1.8} />
      </div>
      <div className="project-meta">
        <span>{project.status}</span>
        <span>Updated {project.updated}</span>
      </div>
      <h3>{project.title}</h3>
      <p>{project.description}</p>
      <div className="progress-row">
        <div className="progress-track" aria-label={`${project.progress}% complete`}>
          <span style={{ width: `${project.progress}%` }} />
        </div>
        <strong>{project.progress}%</strong>
      </div>
      <div className="card-footer">
        <span><FileText size={15} /> {project.sources} sources</span>
        <button aria-label={`Open ${project.title}`}><ArrowUpRight size={17} /></button>
      </div>
    </article>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [created, setCreated] = useState(false);

  const visibleProjects = useMemo(
    () => projects.filter((project) =>
      `${project.title} ${project.description}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [query],
  );

  function createProject() {
    setCreated(true);
    window.setTimeout(() => setCreated(false), 2200);
  }

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><span>F</span> Fieldnote</div>
        <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
        <nav>
          <a className="active" href="#overview"><Sparkles size={18} /> Overview</a>
          <a href="#projects"><FlaskConical size={18} /> Projects <span>3</span></a>
          <a href="#library"><BookOpen size={18} /> Library <span>61</span></a>
          <a href="#notes"><Lightbulb size={18} /> Notes <span>24</span></a>
        </nav>
        <div className="sidebar-note">
          <div><Sparkles size={17} /></div>
          <strong>Weekly synthesis</strong>
          <p>Three new themes are ready to review.</p>
          <button>Review insights <ChevronRight size={15} /></button>
        </div>
        <div className="profile">
          <div className="avatar">FE</div>
          <div><strong>Frank Ely</strong><span>Researcher</span></div>
        </div>
      </aside>

      <main>
        <header>
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <label className="search-box">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search your research..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <button className="new-project" onClick={createProject}>
            {created ? <Check size={17} /> : <Plus size={17} />}
            {created ? "Project ready" : "New project"}
          </button>
        </header>

        <section className="hero" id="overview">
          <div>
            <p className="eyebrow">SATURDAY · OCTOBER 17</p>
            <h1>Good morning, Frank.</h1>
            <p>Here’s what’s moving across your research.</p>
          </div>
          <div className="focus-card">
            <div className="focus-icon"><Clock3 size={20} /></div>
            <div><span>Focus time this week</span><strong>12h 40m</strong></div>
            <div className="mini-chart" aria-hidden="true">
              {[38, 62, 49, 78, 67, 91, 54].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </section>

        <section id="projects">
          <div className="section-heading">
            <div><span className="section-number">01</span><h2>Active projects</h2></div>
            <a href="#all-projects">View all <ArrowUpRight size={15} /></a>
          </div>
          <div className="project-grid">
            {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
            {!visibleProjects.length && (
              <div className="empty-state">No projects match “{query}”.</div>
            )}
          </div>
        </section>

        <section className="lower-grid">
          <div id="notes">
            <div className="section-heading compact">
              <div><span className="section-number">02</span><h2>Recent notes</h2></div>
              <button aria-label="Add note"><Plus size={17} /></button>
            </div>
            <div className="notes-list">
              {notes.map((note) => (
                <button className="note-row" key={note.title}>
                  <span className="note-symbol">↳</span>
                  <span><strong>{note.title}</strong><small>{note.project} · {note.time}</small></span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </div>
          <div className="brief-card">
            <span className="eyebrow">RESEARCH BRIEF</span>
            <h2>Ideas become useful when they connect.</h2>
            <p>Your latest sources share four recurring themes. Turn them into a clear synthesis while they’re fresh.</p>
            <button>Open synthesis <ArrowUpRight size={16} /></button>
            <div className="orb" />
          </div>
        </section>
      </main>
      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    </div>
  );
}
