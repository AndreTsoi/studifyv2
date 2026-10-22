"use client";
import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  MapPin,
  Clock3,
  Check,
  X,
  Settings,
  Download,
  Upload,
  Flag,
  PenLine,
  ChevronRight,
  Home,
  Search,
} from "lucide-react";
import {
  blankJournal,
  JOURNAL_KEY,
  journalSchema,
  entrySchema,
  sampleJournal,
  download,
  contextGroups,
  entryDay,
  type Entry,
  type Journal as JournalData,
  type Reflection,
} from "@/lib/journal";
import { validateEvidence } from "@/lib/ai-contract";
const AI_PERMISSION_KEY = "study-journal-ai-permission-v1";
type View = "Home" | "Journal" | "Patterns" | "Next steps" | "Settings";
const headings = {
  Home: "Home",
  Journal: "Journal",
  Patterns: "Insights",
  "Next steps": "Next steps",
  Settings: "Settings",
};
const QUOTES = [
  { text: "Practice isn’t the thing you do once you’re good. It’s the thing you do that makes you good.", by: "Malcolm Gladwell" },
  { text: "Do not let what you cannot do interfere with what you can do.", by: "John Wooden" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", by: "B.B. King" },
  { text: "The more that you read, the more things you will know. The more that you learn, the more places you’ll go.", by: "Dr. Seuss" },
  { text: "In learning you will teach, and in teaching you will learn.", by: "Phil Collins" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
  { text: "The mind is not a vessel that needs filling, but wood that needs igniting.", by: "Plutarch" },
];
// "2026-10-20" -> "Oct 20" (noon avoids timezone rollover)
function prettyDay(iso: string, weekday = false) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    ...(weekday ? { weekday: "long" as const } : {}),
    month: "short",
    day: "numeric",
  });
}
export default function Journal() {
  const [data, setData] = useState<JournalData>(blankJournal),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [view, setView] = useState<View>("Home"),
    [entryOrigin, setEntryOrigin] = useState<View>("Journal"),
    [demo, setDemo] = useState(false),
    [compose, setCompose] = useState(false),
    [draftKey, setDraftKey] = useState(0),
    [step, setStep] = useState(0),
    [review, setReview] = useState<Record<string, string>>({}),
    [editing, setEditing] = useState<Entry | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [location, setLocation] = useState(""),
    [methods, setMethods] = useState<string[]>([]),
    [customLocation, setCustomLocation] = useState(""),
    [customMethod, setCustomMethod] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [available, setAvailable] = useState(false),
    [consent, setConsent] = useState(false),
    [autoReflect, setAutoReflect] = useState(false),
    [reflectingId, setReflectingId] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [pattern, setPattern] = useState<Reflection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    form = useRef<HTMLFormElement>(null),
    file = useRef<HTMLInputElement>(null),
    latest = useRef(data),
    entryHeading = useRef<HTMLHeadingElement>(null);
  const drafts = useRef(
    new Map<
      string,
      { values: Record<string, string>; location: string; methods: string[]; step: number }
    >(),
  );
  useEffect(() => {
    try {
      setAutoReflect(localStorage.getItem(AI_PERMISSION_KEY) === "allowed");
      const raw = localStorage.getItem(JOURNAL_KEY);
      if (raw) setData(journalSchema.parse(JSON.parse(raw)));
    } catch {
      setBlocked(true);
      setError(
        "Saved records couldn’t be read. Import a backup in Settings before saving.",
      );
    }
    setReady(true);
    fetch("/api/reflect")
      .then((r) => r.json())
      .then((v) => setAvailable(v.available === true))
      .catch(() => setAvailable(false));
  }, []);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  useEffect(() => {
    if (compose) {
      dialog.current?.showModal();
      const draft = drafts.current.get(editing?.id || "new");
      if (draft && form.current) {
        for (const [name, value] of Object.entries(draft.values)) {
          const field = form.current.elements.namedItem(name);
          if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement
          )
            field.value = value;
        }
      }
    } else dialog.current?.close();
  }, [compose, draftKey, editing?.id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (demo) return;
    const sync = (e: StorageEvent) => {
      if (e.key === JOURNAL_KEY) {
        try {
          const next = e.newValue
            ? journalSchema.parse(JSON.parse(e.newValue))
            : blankJournal;
          setData(next);
          latest.current = next;
          setPattern(null);
        } catch {
          setBlocked(true);
          setError(
            "A change in another tab could not be read. Check your backup.",
          );
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [demo]);
  function persist(next: JournalData, recovery = false) {
    try {
      if (blocked && !recovery && !demo) throw Error();
      const valid = journalSchema.parse(next);
      if (!demo) localStorage.setItem(JOURNAL_KEY, JSON.stringify(valid));
      latest.current = valid;
      setData(valid);
      setError("");
      setPattern(null);
      if (recovery) setBlocked(false);
      return true;
    } catch {
      setError(
        "Could not save. Check browser storage or import a valid backup.",
      );
      return false;
    }
  }
  function updateEntry(entry: Entry) {
    return persist({
      ...latest.current,
      entries: latest.current.entries.map((e) =>
        e.id === entry.id ? entry : e,
      ),
    });
  }
  useEffect(() => {
    if (!compose) return;
    dialog.current?.scrollTo({ top: 0 });
    form.current?.querySelector<HTMLElement>(`[data-step="${step}"]`)?.querySelector<HTMLElement>("input, textarea, button")?.focus();
  }, [step, compose]);
  function nextStep() {
    const panel = form.current?.querySelector(`[data-step="${step}"]`);
    for (const field of panel?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea") || []) {
      if (field.required && !field.value.trim()) {
        setError("Please answer this question before continuing."); field.focus(); return;
      }
      if (!field.reportValidity()) return;
    }
    if (step === 1 && (!location || !methods.length)) {
      setError("Choose a location and at least one study method."); return;
    }
    if (form.current) setReview(Object.fromEntries(new FormData(form.current)) as Record<string, string>);
    setError(""); setStep(Math.min(step + 1, 3));
  }
  function openEntry(entry: Entry | null = null) {
    const draft = drafts.current.get(entry?.id || "new");
    setDraftKey((key) => key + 1);
    setEditing(entry);
    setStep(draft?.step ?? 0);
    setReview(draft?.values || {});
    setLocation(draft?.location || entry?.location || "");
    setMethods(draft?.methods || entry?.methods || []);
    setConsent(false);
    setCustomLocation("");
    setCustomMethod("");
    setError("");
    setCompose(true);
  }
  function closeComposer() {
    if (form.current) {
      const values = new FormData(form.current);
      drafts.current.set(editing?.id || "new", {
        values: Object.fromEntries(
          ["context", "course", "duration", "reflection"].map((name) => [
            name,
            String(values.get(name) || ""),
          ]),
        ),
        location,
        methods: [...methods],
        step,
      });
    }
    setCompose(false);
    setError("");
  }
  useEffect(() => {
    if (view === "Journal" && selected) entryHeading.current?.focus({ preventScroll: true });
  }, [view, selected]);
  function navigate(next: View) {
    setView(next);
    setSelected(null);
    setError("");
    window.scrollTo({ top: 0 });
  }
  function showEntry(id: string, origin: View = view) {
    setEntryOrigin(origin);
    setSelected(id);
    setView("Journal");
    setConsent(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function toggleDemo() {
    drafts.current.clear();
    if (demo) {
      try {
        const raw = localStorage.getItem(JOURNAL_KEY);
        const value = raw ? journalSchema.parse(JSON.parse(raw)) : blankJournal;
        setData(value);
        latest.current = value;
        setDemo(false);
      } catch {
        setError("Your saved journal could not be restored.");
        return;
      }
    } else {
      const value = sampleJournal();
      setData(value);
      latest.current = value;
      setDemo(true);
    }
    setSelected(null);
    setPattern(null);
    setFilter("all");
    setQuery("");
    setView("Home");
  }
  function rememberAiPermission(allowed: boolean) {
    try {
      localStorage.setItem(AI_PERMISSION_KEY, allowed ? "allowed" : "off");
      setAutoReflect(allowed);
      return true;
    } catch {
      setError("Couldn’t save that AI setting. Check browser storage.");
      return false;
    }
  }
  async function ask(entries: Entry[], mode: "entry" | "patterns") {
    if (busy) return;
    if (!available) {
      setError(
        "AI isn’t connected. Your entry is saved — write your own takeaway.",
      );
      return;
    }
    setBusy(true);
    setReflectingId(mode === "entry" ? entries[0].id : null);
    setError("");
    try {
      const response = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, entries }),
        signal: AbortSignal.timeout(40000),
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error || "Could not reflect right now.");
      const checked = validateEvidence(
        value,
        entries.map((e) => e.id),
      );
      if (mode === "patterns") setPattern(checked);
      else {
        const current = latest.current.entries.find(
          (e) => e.id === entries[0].id,
        );
        if (current && JSON.stringify(current) === JSON.stringify(entries[0])) {
          updateEntry({ ...current, ai: checked });
          setNotice("Reflection ready — keep what fits.");
        } else
          setError("This entry changed while reflecting. Please try again.");
      }
    } catch (e) {
      setError(`${mode === "entry" ? "Your entry is saved, but AI reflection couldn’t be generated. " : ""}${e instanceof Error ? e.message : "AI is unavailable. Please try again."}`);
    } finally {
      setBusy(false);
      setReflectingId(null);
    }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (k: string) => String(values.get(k) || "").trim();
    const reflect = available && (autoReflect || consent);
    if (!location || !methods.length) {
      setError("Choose a location and at least one study method.");
      return;
    }
    const entry = entrySchema.safeParse({
      id: editing?.id || crypto.randomUUID(),
      date: editing?.date || new Date().toISOString(),
      offset: editing?.offset ?? new Date().getTimezoneOffset(),
      context: text("context"),
      course: text("course"),
      location,
      methods,
      duration: text("duration") ? Number(text("duration")) : null,
      reflection: text("reflection"),
      takeaway: editing?.takeaway || "",
      nextStep: editing?.nextStep || "",
      due: editing?.due || "",
      done: editing?.done || false,
      ai: null,
      reply: "",
    });
    if (!entry.success) {
      setError("Please complete the required fields and check the duration.");
      return;
    }
    if (consent && !autoReflect && !rememberAiPermission(true)) return;
    const next = {
      ...latest.current,
      entries: editing
        ? latest.current.entries.map((e) =>
            e.id === editing.id ? entry.data : e,
          )
        : [entry.data, ...latest.current.entries],
      locations: [...new Set([...latest.current.locations, location])],
      methods: [...new Set([...latest.current.methods, ...methods])],
      courses: [
        ...new Set([
          ...latest.current.courses,
          ...(entry.data.course ? [entry.data.course] : []),
        ]),
      ],
    };
    if (persist(next)) {
      drafts.current.delete(editing?.id || "new");
      setCompose(false);
      setSelected(entry.data.id);
      setEntryOrigin(view);
      setView("Journal");
      setNotice(demo ? "Saved in this demo" : "Saved on this device");
      if (reflect) void ask([entry.data], "entry");
    }
  }
  const selectedEntry = data.entries.find((e) => e.id === selected);
  const entries = [...data.entries].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const today = new Date().toLocaleDateString("en-CA");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const recent = entries.filter(
    (e) =>
      entryDay(e) >= weekStart.toLocaleDateString("en-CA") &&
      entryDay(e) <= today,
  );
  const timed = recent.filter((e) => e.duration !== null);
  const pending = entries
    .filter((e) => e.nextStep && !e.done)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const suggestions = entries
    .filter((e) => e.ai?.nextStep && !e.nextStep)
    .slice(0, 2);
  const visible = entries.filter(
    (e) =>
      (filter === "all" || e.course === filter) &&
      `${e.context} ${e.reflection} ${e.location} ${e.methods.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const courses = [
    ...new Set([
      ...data.courses,
      ...entries.map((e) => e.course).filter(Boolean),
    ]),
  ];
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const day = d.toLocaleDateString("en-CA");
    const items = recent.filter((e) => entryDay(e) === day);
    return {
      day,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      minutes: items.reduce((sum, e) => sum + (e.duration || 0), 0),
      count: items.length,
    };
  });
  const weekMinutes = week.reduce((sum, d) => sum + d.minutes, 0);
  const byTime = weekMinutes > 0;
  const peak = Math.max(1, ...week.map((d) => (byTime ? d.minutes : d.count)));
  const [wholeHours, tenthHours] = (Math.round(weekMinutes / 6) / 10)
    .toFixed(1)
    .split(".");
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const lastDay = entries[0] ? entryDay(entries[0]) : "";
  const daysSince = lastDay
    ? Math.round((Date.parse(today) - Date.parse(lastDay)) / 86400000)
    : -1;
  const lastLabel =
    daysSince < 0
      ? "None yet"
      : daysSince === 0
        ? "Today"
        : daysSince === 1
          ? "Yesterday"
          : `${daysSince} days ago`;
  const quote = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length];
  const months = [...new Set(visible.map((e) => entryDay(e).slice(0, 7)))];
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const steps = entries.filter((e) => e.nextStep);
  const doneSteps = steps.filter((e) => e.done);
  if (!ready)
    return (
      <div className="loading">
        <span className="brand-mark">s.</span>
        <p>Opening your journal…</p>
      </div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className="journal-app app-shell">
        <aside className="app-side">
          <a
            href="/journal"
            className="app-brand"
            onClick={(event) => {
              event.preventDefault();
              navigate("Home");
            }}
          >
            <span className="brand-mark">s.</span>
            <span className="app-brand-name">Studify</span>
          </a>
          <button
            className="app-log"
            aria-label="Log a session"
            disabled={busy}
            onClick={() => openEntry()}
          >
            <Plus size={17} />
            <span>Log a session</span>
          </button>
          <nav className="app-nav" aria-label="Main navigation">
            {([["Home", Home], ["Journal", BookOpen], ["Patterns", Sparkles], ["Next steps", Flag]] as const).map(
              ([v, Icon]) => (
                <button
                  key={v}
                  className={`app-nav-item${view === v ? " selected" : ""}`}
                  aria-current={view === v ? "page" : undefined}
                  aria-label={headings[v]}
                  onClick={() => navigate(v)}
                >
                  {view === v && <motion.span className="app-nav-surface" layoutId="active-navigation" transition={{ type: "spring", stiffness: 460, damping: 36 }} />}
                  <Icon size={17} />
                  <span>{headings[v]}</span>
                  {v === "Next steps" && pending.length > 0 && <em className="app-nav-count">{pending.length}</em>}
                </button>
              ),
            )}
          </nav>
          <div className="app-side-foot">
            <button
              className={`app-nav-item${view === "Settings" ? " selected" : ""}`}
              aria-current={view === "Settings" ? "page" : undefined}
              aria-label="Settings"
              onClick={() => navigate("Settings")}
            >
              {/* Its own surface: fades in rather than sliding across the sidebar */}
              {view === "Settings" && <motion.span className="app-nav-surface" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} />}
              <Settings size={17} />
              <span>Settings</span>
            </button>
            <p className="app-side-note">
              <span />
              {demo ? "Sample journal" : "Saved on this device"}
            </p>
          </div>
        </aside>
        <main className="journal-main">
          {demo && (
            <div className="demo-banner">
              <span>
                Sample journal · Changes won’t affect your saved entries.
              </span>
              <button onClick={toggleDemo}>
                Exit demo <X size={14} />
              </button>
            </div>
          )}
          {!(view === "Journal" && selectedEntry) && <div className="journal-heading">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>{view === "Home" ? greeting : headings[view]}</h1>
              {view !== "Home" && <p className="subtitle">
                {view === "Journal"
                  ? "Open an entry to read, edit, or reflect on it."
                  : view === "Patterns"
                    ? "Your entries by location and method, plus optional AI themes."
                    : view === "Next steps"
                      ? "Saved from your entries. Check one off when it’s done."
                      : "Your data and AI connection."}
              </p>}
            </div>
            {view === "Journal" && !selectedEntry && <button
              className="primary"
              disabled={busy}
              onClick={() => openEntry()}
            >
              <Plus size={17} /> Log a session
            </button>}
          </div>}
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {view === "Home" && (
            <motion.div
              className="home-dash"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <section className="home-banner">
                <div className="home-banner-quote">
                  <span className="pill">Thought for today</span>
                  <blockquote>“{quote.text}”</blockquote>
                  <cite>{quote.by}</cite>
                </div>
                <dl className="home-banner-stats">
                  <div>
                    <dt>Last session</dt>
                    <dd>{lastLabel}</dd>
                  </div>
                  <div>
                    <dt>Entries</dt>
                    <dd>{entries.length}</dd>
                  </div>
                  <div>
                    <dt>Open next steps</dt>
                    <dd>{pending.length}</dd>
                  </div>
                </dl>
              </section>

              <h2 className="home-section-title">This week</h2>
              <div className="week-grid">
                <section className="week-card" aria-label="Study time this week">
                  <div className="week-face">
                    <span className="brand-mark">s.</span>
                    <span className="week-chip">
                      {recent.length} {recent.length === 1 ? "session" : "sessions"}
                    </span>
                    <small>Study time</small>
                    <strong className="week-big">
                      {wholeHours}
                      <span>.{tenthHours}h</span>
                    </strong>
                    <p>
                      {new Set(recent.map(entryDay)).size} of 7 days
                      {timed.length < recent.length && ` · ${recent.length - timed.length} without a duration`}
                    </p>
                  </div>
                  <button className="secondary" onClick={() => navigate("Journal")}>
                    <Clock3 size={15} />
                    Session history
                  </button>
                  <button className="primary" disabled={busy} onClick={() => openEntry()}>
                    <Plus size={15} />
                    Log a session
                  </button>
                </section>

                <section className="week-chart" aria-label="Last seven days">
                  <span className="pill">Last 7 days</span>
                  <strong className="week-chart-total">
                    {byTime
                      ? `${weekMinutes} min`
                      : `${recent.length} ${recent.length === 1 ? "session" : "sessions"}`}
                  </strong>
                  <div className="week-bars">
                    {week.map((d) => {
                      const value = byTime ? d.minutes : d.count;
                      return (
                        <div className={`week-bar${d.day === today ? " today" : ""}`} key={d.day}>
                          <div className="week-bar-track">
                            {value > 0 && <span className="week-bar-value">{byTime ? `${value}m` : value}</span>}
                            <span
                              className={`week-bar-fill${value ? "" : " is-empty"}`}
                              style={{ height: value ? Math.max(Math.round((value / peak) * 120), 8) : 4 }}
                            />
                          </div>
                          <span className="week-bar-day">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <small className="week-chart-foot">
                    {!recent.length ? "Log a session to start this week’s chart." : byTime ? "Minutes studied per day" : "Sessions logged per day"}
                  </small>
                </section>
              </div>

              <div className="home-lower">
                <section className="card home-panel">
                  <div className="card-heading">
                    <h2>Recent sessions</h2>
                    {entries.length > 3 && (
                      <button className="text-button" onClick={() => navigate("Journal")}>
                        View all <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                  {entries.slice(0, 3).map((e) => (
                    <button
                      className="home-session"
                      key={e.id}
                      onClick={() => showEntry(e.id)}
                    >
                      <div>
                        <h3>{e.context}</h3>
                        <small>
                          {prettyDay(entryDay(e))} · {e.location} · {e.methods.join(", ")}
                        </small>
                        <p>{e.reflection}</p>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                  {!entries.length && (
                    <div className="home-empty">
                      <p>Your entries will appear here.</p>
                      <small>Log a session: a topic, where and how you studied, and a short reflection.</small>
                      <button className="text-button" onClick={toggleDemo}>
                        Explore a sample journal <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </section>

                <section className="card home-panel">
                  <div className="card-heading">
                    <h2>Up next</h2>
                    {pending.length > 0 && (
                      <button className="text-button" onClick={() => navigate("Next steps")}>
                        View all <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                  {pending.slice(0, 4).map((e) => (
                    <label className="up-next" key={e.id}>
                      <input
                        type="checkbox"
                        checked={e.done}
                        onChange={() => updateEntry({ ...e, done: !e.done })}
                      />
                      <span>
                        <strong>{e.nextStep}</strong>
                        <small>{e.due ? `Planned for ${prettyDay(e.due)}` : "Unscheduled"} · {e.context}</small>
                      </span>
                    </label>
                  ))}
                  {!pending.length && (
                    <p className="up-next-empty">
                      Nothing open. Add a next step from any entry.
                    </p>
                  )}
                </section>
              </div>
            </motion.div>
          )}
          {view === "Journal" && !selectedEntry && (
            <>
              <div className="panel journal-toolbar">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search journal"
                    placeholder="Search topics or reflections"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <span className="toolbar-count">
                  {visible.length} of {entries.length}{" "}
                  {entries.length === 1 ? "entry" : "entries"}
                </span>
                {courses.length > 0 && (
                  <div className="filter-chips" role="group" aria-label="Filter by subject">
                    {["all", ...courses].map((c) => (
                      <button
                        key={c}
                        className={`chip${filter === c ? " on" : ""}`}
                        aria-pressed={filter === c}
                        onClick={() => setFilter(c)}
                      >
                        {c === "all" ? "All subjects" : c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {months.map((m) => (
                <section className="entry-month" key={m}>
                  <h2 className="entry-month-label">
                    {new Date(`${m}-15T12:00:00`).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <div className="panel entry-list">
                    {visible
                      .filter((e) => entryDay(e).startsWith(m))
                      .map((e, i) => (
                        <motion.button
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.025, 0.15) }}
                          className="entry-card"
                          key={e.id}
                          onClick={() => showEntry(e.id)}
                        >
                          <span className="entry-date">
                            <strong>{Number(entryDay(e).slice(8))}</strong>
                            <span>
                              {new Date(`${entryDay(e)}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                          </span>
                          <span className="entry-card-body">
                            <h3>{e.context}</h3>
                            <p>{e.reflection}</p>
                            <span className="entry-tags">
                              {e.course && <span className="strong">{e.course}</span>}
                              <span>
                                <MapPin size={12} />
                                {e.location}
                              </span>
                              {e.methods.map((m) => (
                                <span key={m}>{m}</span>
                              ))}
                              {e.duration && (
                                <span>
                                  <Clock3 size={12} />
                                  {e.duration} min
                                </span>
                              )}
                            </span>
                            {e.takeaway && (
                              <span className="takeaway-preview">
                                <strong>Takeaway</strong> {e.takeaway}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="entry-chev" size={18} />
                        </motion.button>
                      ))}
                  </div>
                </section>
              ))}
              {!visible.length && (
                <div className="panel journal-empty">
                  <span className="empty-art tint-2">
                    <BookOpen size={26} strokeWidth={1.6} />
                  </span>
                  <h2>
                    {entries.length ? "No matching entries" : "No entries yet"}
                  </h2>
                  <p>
                    {entries.length
                      ? "Try a different search or subject."
                      : "Use Log a session to add your first entry."}
                  </p>
                  {entries.length > 0 && (
                    <button
                      className="secondary"
                      onClick={() => (setQuery(""), setFilter("all"))}
                    >
                      Clear filters
                    </button>
                  )}
                  {!entries.length && (
                    <button className="text-button" onClick={toggleDemo}>
                      Explore a sample journal <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {view === "Journal" && selectedEntry && (
            <motion.article className="entry-reader" key={selectedEntry.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} aria-labelledby="saved-entry-title">
              <button
                className="text-button back-link"
                onClick={() => navigate(entryOrigin)}
              >
                <ArrowLeft size={16} />
                {entryOrigin === "Home"
                  ? "Back to Home"
                  : entryOrigin === "Journal"
                    ? "All entries"
                    : `Back to ${headings[entryOrigin]}`}
              </button>
              <section className="panel entry-hero">
                <div className="entry-hero-top">
                  <p className="eyebrow">
                    {prettyDay(entryDay(selectedEntry), true)}
                    {selectedEntry.course ? " · " + selectedEntry.course : ""}
                  </p>
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => openEntry(selectedEntry)}
                  >
                    <PenLine size={14} />
                    Edit entry
                  </button>
                </div>
                <h1 id="saved-entry-title" ref={entryHeading} tabIndex={-1}>{selectedEntry.context}</h1>
                <div className="entry-tags">
                  <span>
                    <MapPin size={13} />
                    {selectedEntry.location}
                  </span>
                  {selectedEntry.methods.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                  {selectedEntry.duration && (
                    <span>
                      <Clock3 size={13} />
                      {selectedEntry.duration} min
                    </span>
                  )}
                </div>
              </section>
              <div className="entry-layout">
                <div className="entry-main">
                  <section className="panel">
                    <h2 className="panel-title">Session notes</h2>
                    <p className="reflection-text">{selectedEntry.reflection}</p>
                  </section>
                  <section className="panel reflection-panel" aria-busy={reflectingId === selectedEntry.id} key={selectedEntry.id + "-ai"}>
                    <div className="insight-label">
                      <Sparkles size={15} /> AI reflection
                    </div>
                    {selectedEntry.ai ? (
                      <>
                        <h2>A possible interpretation</h2>
                        <p className="reflection-text">
                          {selectedEntry.ai.summary}
                        </p>
                        <small>AI suggestion · not a measure of learning.</small>
                        {selectedEntry.ai.question && (
                          <div className="follow-up">
                            {selectedEntry.ai.question}
                          </div>
                        )}
                        <label>
                          Your response or correction{" "}
                          <textarea
                            key={selectedEntry.id + selectedEntry.reply}
                            maxLength={1500}
                            defaultValue={selectedEntry.reply}
                            placeholder="Does this fit? Add or correct it."
                            onBlur={(e) => {
                              if (e.target.value !== selectedEntry.reply)
                                updateEntry({
                                  ...selectedEntry,
                                  reply: e.target.value,
                                });
                            }}
                          />
                        </label>
                        <button
                          disabled={busy}
                          className="secondary"
                          onClick={() =>
                            void ask(
                              [
                                latest.current.entries.find(
                                  (e) => e.id === selectedEntry.id,
                                )!,
                              ],
                              "entry",
                            )
                          }
                        >
                          {busy ? "Reflecting…" : "Send response to AI"}
                        </button>
                        <p className="ai-disclosure">
                          Sends this entry and your response to OpenAI.
                        </p>
                        {selectedEntry.ai.nextStep && (
                          <div className="suggestion">
                            <strong>One thing you could try</strong>
                            <p>{selectedEntry.ai.nextStep}</p>
                            <button
                              disabled={busy}
                              className="text-button"
                              onClick={() => {
                                if (
                                  selectedEntry.nextStep &&
                                  !confirm(
                                    "Replace the current next step with this suggestion?",
                                  )
                                )
                                  return;
                                updateEntry({
                                  ...selectedEntry,
                                  nextStep: selectedEntry.ai!.nextStep,
                                  done: false,
                                });
                                setNotice("Next step saved on Home");
                              }}
                            >
                              Use this next step <ArrowRight size={14} />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <h2>
                          {reflectingId === selectedEntry.id ? "Reflecting on your session…" : "Your entry is saved"}
                        </h2>
                        <p>
                          {reflectingId === selectedEntry.id ? "Looking at what helped and what to try next." : available ? "No reflection yet — generate one below." : "AI isn’t connected, so there’s no reflection. Your notes are saved."}
                        </p>
                        {available && !autoReflect && reflectingId !== selectedEntry.id && <label className="consent">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          Send this entry to OpenAI for reflection.
                        </label>}
                        {available && <button
                          disabled={!available || busy || !(autoReflect || consent)}
                          className="primary"
                          onClick={() => void ask([selectedEntry], "entry")}
                        >
                          <Sparkles size={16} />
                          {reflectingId === selectedEntry.id ? "Reflecting…" : "Generate reflection"}
                        </button>}
                      </>
                    )}
                  </section>
                </div>
                <aside className="entry-aside">
                  <section className="panel personal-takeaway" key={selectedEntry.id + "-takeaway"}>
                    <h2 className="panel-title">Your takeaway</h2>
                    <p className="panel-sub">
                      Your own conclusion, plus an optional next step for Home.
                    </p>
                    <form
                      key={
                        selectedEntry.id + "-" + (selectedEntry.nextStep || "")
                      }
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        if (
                          updateEntry({
                            ...selectedEntry,
                            takeaway: String(f.get("takeaway") || ""),
                            nextStep: String(f.get("nextStep") || ""),
                            due: String(f.get("due") || ""),
                          })
                        )
                          setNotice("Your takeaway is saved");
                      }}
                    >
                      <label>
                        Takeaway
                        <textarea
                          name="takeaway"
                          maxLength={1400}
                          defaultValue={selectedEntry.takeaway}
                          placeholder="What did you get out of this session?"
                        />
                      </label>
                      <label>
                        Next step <span className="optional">optional</span>
                        <textarea
                          name="nextStep"
                          maxLength={400}
                          defaultValue={selectedEntry.nextStep}
                          placeholder="Something small to try next time"
                        />
                      </label>
                      <label>
                        When? <span className="optional">optional</span>
                        <input
                          type="date"
                          name="due"
                          defaultValue={selectedEntry.due}
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        <Check size={15} />
                        Save takeaway
                      </button>
                    </form>
                  </section>
                </aside>
              </div>
            </motion.article>
          )}
          {view === "Patterns" && (
            <div className="insights">
              <div className="stat-strip">
                {(
                  [
                    ["Entries", entries.length],
                    ["Places", new Set(entries.map((e) => e.location)).size],
                    ["Methods", new Set(entries.flatMap((e) => e.methods)).size],
                    ["Time logged", totalMinutes ? `${Math.round(totalMinutes / 6) / 10}h` : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <div className="panel stat-tile" key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              <section className="panel ai-panel">
                <span className="ai-panel-art tint-3">
                  <Sparkles size={24} strokeWidth={1.6} />
                </span>
                <div className="ai-panel-body">
                  <h2>Find recurring themes</h2>
                  <p>
                    AI reads your latest {Math.min(entries.length, 12)} entries
                    and suggests one pattern. They’re sent to OpenAI only when
                    you press the button.
                  </p>
                  <small>
                    {!available
                      ? "Needs an AI connection. The overview below works without one."
                      : entries.length < 3
                        ? "Add at least 3 entries first."
                        : "You can question or dismiss any interpretation."}
                  </small>
                </div>
                <button
                  className="primary"
                  disabled={busy || !available || entries.length < 3}
                  onClick={() => void ask(entries.slice(0, 12), "patterns")}
                >
                  <Sparkles size={16} />
                  {busy ? "Looking across entries…" : "Find themes"}
                </button>
              </section>

              {pattern && (
                <section className="panel reflection-panel pattern-result">
                  <div className="card-heading">
                    <h2>A pattern to consider</h2>
                    <button
                      className="text-button"
                      onClick={() => setPattern(null)}
                    >
                      Doesn’t fit · Dismiss
                    </button>
                  </div>
                  <p>{pattern.summary}</p>
                  {pattern.question && (
                    <p className="follow-up">{pattern.question}</p>
                  )}
                  <div className="evidence-links">
                    <strong>Supporting entries</strong>
                    {pattern.evidenceIds.map((id) => (
                      <button
                        className="text-button"
                        key={id}
                        onClick={() => {
                          showEntry(id);
                        }}
                      >
                        {entries.find((e) => e.id === id)?.context}{" "}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                  <p>Possible next step: {pattern.nextStep}</p>
                  <small>Save a next step from its entry if it fits.</small>
                </section>
              )}

              <div className="context-grid">
                {(["location", "methods"] as const).map((field) => {
                  const groups = contextGroups(entries, field);
                  const most = Math.max(1, ...groups.map(([, items]) => items.length));
                  return (
                    <section className="panel context-panel" key={field}>
                      <div className="panel-head">
                        <h2 className="panel-title">
                          {field === "location" ? "Where you studied" : "How you studied"}
                        </h2>
                        <span className="pill">{groups.length}</span>
                      </div>
                      {groups.map(([label, items]) => (
                        <details className="context-row" key={label}>
                          <summary>
                            <span className="context-name">{label}</span>
                            <span className="context-bar">
                              <span style={{ width: `${(items.length / most) * 100}%` }} />
                            </span>
                            <span className="context-count">{items.length}</span>
                          </summary>
                          <div className="context-entries">
                            {items.map((e) => (
                              <button
                                className="text-button evidence-entry"
                                key={e.id}
                                onClick={() => {
                                  showEntry(e.id);
                                }}
                              >
                                {e.context}
                                <ArrowRight size={12} />
                              </button>
                            ))}
                          </div>
                        </details>
                      ))}
                      {!entries.length && (
                        <p className="panel-sub">
                          Context will appear as you add entries.
                        </p>
                      )}
                      <p className="panel-note">
                        Counts show what you recorded, not how productive it was.
                      </p>
                    </section>
                  );
                })}
              </div>

              {entries.some((e) => e.takeaway) && (
                <section className="panel">
                  <h2 className="panel-title">Your takeaways</h2>
                  {entries
                    .filter((e) => e.takeaway)
                    .map((e) => (
                      <button className="takeaway-row" key={e.id} onClick={() => showEntry(e.id)}>
                        <span className="pill">{prettyDay(entryDay(e))}</span>
                        <span>
                          <strong>{e.takeaway}</strong>
                          <small>{e.context}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                </section>
              )}
            </div>
          )}
          {view === "Next steps" && (
            <div className="steps">
              {([["Open", pending], ["Done", doneSteps]] as const).map(([label, list]) =>
                list.length > 0 && (
                  <section className="panel" key={label}>
                    <div className="panel-head">
                      <h2 className="panel-title">{label}</h2>
                      <span className="pill">{list.length}</span>
                    </div>
                    {list.map((e) => (
                      <div className={`step-row${e.done ? " done" : ""}`} key={e.id}>
                        <input
                          aria-label={`Complete: ${e.nextStep}`}
                          type="checkbox"
                          checked={e.done}
                          onChange={() => updateEntry({ ...e, done: !e.done })}
                        />
                        <div className="step-body">
                          <strong>{e.nextStep}</strong>
                          <span className="step-meta">
                            <span className={`pill${!e.done && e.due && e.due < today ? " late" : ""}`}>
                              {e.due ? `${!e.done && e.due < today ? "Overdue · " : ""}${prettyDay(e.due)}` : "Anytime"}
                            </span>
                            <span>{e.context}</span>
                          </span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            showEntry(e.id);
                          }}
                        >
                          Open entry <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </section>
                ),
              )}
              {!steps.length && (
                <div className="panel journal-empty">
                  <span className="empty-art tint-4">
                    <Flag size={26} strokeWidth={1.6} />
                  </span>
                  <h2>No next steps yet</h2>
                  <p>Open an entry and add one small thing to try.</p>
                  <button
                    className="secondary"
                    onClick={() => navigate("Journal")}
                  >
                    Go to journal
                  </button>
                </div>
              )}
            </div>
          )}
          {view === "Settings" && (
            <div className="settings">
              <section className="panel settings-group">
                <h2 className="panel-title">Your data</h2>
                <div className="setting-row">
                  <div>
                    <strong>Backup</strong>
                    <p>
                      Entries stay in this browser. Clearing browser data
                      removes them, so keep a backup.
                    </p>
                  </div>
                  <div className="setting-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(data, null, 2)], {
                            type: "application/json",
                          }),
                          `studify-backup-${today}.json`,
                        )
                      }
                    >
                      <Download size={15} />
                      Export
                    </button>
                    <button
                      className="secondary"
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={15} />
                      Import
                    </button>
                  </div>
                </div>
                <input
                  hidden
                  ref={file}
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      if (f.size > 10000000) throw Error();
                      const v = journalSchema.parse(JSON.parse(await f.text()));
                      if (
                        confirm(
                          `Replace the current journal with ${v.entries.length} entries from this backup?`,
                        ) &&
                        persist(v, true)
                      ) {
                        setSelected(null);
                        setNotice("Journal imported");
                      }
                    } catch {
                      setError(
                        "Choose a valid Studify backup under 10 MB.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </section>
              <section className="panel settings-group">
                <h2 className="panel-title">AI reflection</h2>
                <label className="setting-row">
                  <div>
                    <strong>Reflect automatically</strong>
                    <p>
                      Send saved entries to OpenAI for reflection. Applies to
                      entries you save after turning it on; existing
                      reflections stay.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="switch"
                    checked={autoReflect}
                    onChange={(event) => rememberAiPermission(event.target.checked)}
                  />
                </label>
                <div className="setting-row">
                  <div>
                    <strong>Connection</strong>
                    <p>Saving entries and takeaways always works without AI.</p>
                  </div>
                  <span className={`status-pill${available ? " on" : ""}`}>
                    {available ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="setting-note">
                  Each entry sent includes its notes, topic, course, location,
                  methods, and duration — never GPS. Requests are made with
                  storage disabled; OpenAI’s own policies still apply.
                  Suggestions are interpretations, not verified outcomes. Edit,
                  correct, or ignore them.
                </p>
              </section>
              <section className="panel settings-group">
                <h2 className="panel-title">Sample journal</h2>
                <div className="setting-row">
                  <div>
                    <strong>Explore a sample</strong>
                    <p>Sample entries are separate from your journal.</p>
                  </div>
                  <button className="secondary" onClick={toggleDemo}>
                    {demo ? "Exit sample" : "Open sample"}
                  </button>
                </div>
              </section>
            </div>
          )}
          <footer className="journal-footer">
            <span>Saved in this browser.</span>
            <span>Studify · {demo ? "Demo" : "Device-local"}</span>
          </footer>
        </main>
      </div>
      <dialog
        className="journal-dialog"
        aria-labelledby="entry-heading"
        ref={dialog}
        onPointerDown={(event) => {
          if (event.target !== dialog.current) return;
          const rect = dialog.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            closeComposer();
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeComposer();
        }}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{editing ? "EDIT ENTRY" : "LOG A SESSION"} · STEP {step + 1} OF 4</p>
            <h2 id="entry-heading">{["What did you work on?", "Where and how?", "How did it go?", "Review your entry"][step]}</h2>
            <p className="subtitle">
              {["Course and duration are optional.", "Where and how you studied.", "What helped, what got in the way.", "Check your answers, then save."][step]}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close entry"
            onClick={closeComposer}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <ol className="entry-progress" aria-label="Entry progress">
          {["Session", "Location & method", "Reflection", "Review"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={index <= step ? "reached" : ""}>{label}</li>)}
        </ol>
        <form ref={form} key={draftKey} noValidate onSubmit={(event) => {
          if (step < 3) { event.preventDefault(); nextStep(); }
          else void submit(event);
        }}>
          <section data-step="0" hidden={step !== 0}>
          <label>
            What were you working on? *
            <input
              name="context"
              required
              maxLength={200}
              defaultValue={editing?.context || ""}
              placeholder="e.g. When to use integration by parts"
            />
          </label>
          <div className="form-grid">
            <label>
              Course / subject <span className="optional">optional</span>
              <input
                name="course"
                maxLength={100}
                list="journal-courses"
                defaultValue={editing?.course || ""}
                placeholder="Choose or type one"
              />
              <datalist id="journal-courses">
                <option>Independent study</option>
                {courses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
            <label>
              Duration <span className="optional">optional</span>
              <input
                name="duration"
                type="number"
                min={1}
                max={1440}
                defaultValue={editing?.duration || ""}
                placeholder="Minutes"
              />
            </label>
          </div>
          </section>
          <section data-step="1" hidden={step !== 1}>
          <fieldset>
            <legend>Where did you study? *</legend>
            <div className="choice-chips">
              {[
                ...new Set([
                  ...data.locations,
                  ...(location ? [location] : []),
                ]),
              ].map((l) => (
                <button
                  type="button"
                  key={l}
                  aria-pressed={location === l}
                  className={location === l ? "chosen" : ""}
                  onClick={() => setLocation(l)}
                >
                  {location === l && <Check size={12} />} {l}
                </button>
              ))}
            </div>
            <div className="custom-choice">
              <input
                aria-label="Custom location"
                maxLength={100}
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Add a location label"
              />
              <button
                type="button"
                className="text-button"
                disabled={!customLocation.trim()}
                onClick={() => {
                  setLocation(customLocation.trim());
                  setCustomLocation("");
                }}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>
              How did you study? *{" "}
              <span className="optional">choose all that apply</span>
            </legend>
            <div className="choice-chips">
              {[...new Set([...data.methods, ...methods])].map((m) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={methods.includes(m)}
                  className={methods.includes(m) ? "chosen" : ""}
                  onClick={() =>
                    setMethods(
                      methods.includes(m)
                        ? methods.filter((x) => x !== m)
                        : [...methods, m],
                    )
                  }
                >
                  {methods.includes(m) && <Check size={12} />} {m}
                </button>
              ))}
            </div>
            <div className="custom-choice">
              <input
                aria-label="Custom study method"
                maxLength={100}
                value={customMethod}
                onChange={(e) => setCustomMethod(e.target.value)}
                placeholder="Add a study method"
              />
              <button
                type="button"
                className="text-button"
                disabled={!customMethod.trim()}
                onClick={() => {
                  setMethods([...new Set([...methods, customMethod.trim()])]);
                  setCustomMethod("");
                }}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </fieldset>
          </section>
          <section data-step="2" hidden={step !== 2}>
          <label>
            Your reflection *
            <textarea
              name="reflection"
              required
              maxLength={3000}
              defaultValue={editing?.reflection || ""}
              placeholder="What felt useful? What was hard? What’s still unclear?"
              rows={4}
            />
          </label>
          </section>
          <section data-step="3" hidden={step !== 3}>
          <dl className="entry-review">
            <div><dt>Session</dt><dd>{review.context}</dd><dd className="optional">{[review.course, review.duration ? `${review.duration} minutes` : ""].filter(Boolean).join(" · ")}</dd></div>
            <div><dt>Location & method</dt><dd>{location}</dd><dd>{methods.join(", ")}</dd></div>
            <div><dt>Reflection</dt><dd>{review.reflection}</dd></div>
          </dl>
          {!autoReflect && available && <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>
            Send each entry and its context to OpenAI for reflection when I save. Change this anytime in Settings.
          </label>}
          <p className="connection-note">{!available ? "AI isn’t connected. Your entry saves without a reflection." : autoReflect || consent ? "Your entry saves first, then AI reflects on it — correct it afterward." : "Allow AI above for feedback, or save without it."}</p>
          {editing && (
            <p className="ai-disclosure">
              Editing clears the AI reflection and reply; your takeaway and next
              step stay.
            </p>
          )}
          </section>
          <div className="entry-wizard-footer">
            <button type="button" className="text-button" onClick={() => { if (step === 0) closeComposer(); else { setError(""); setStep(step - 1); } }}>{step === 0 ? "Cancel" : "Back"}</button>
            {step < 3 ? <button type="submit" className="primary">{step === 2 ? "Review entry" : "Next"}<ArrowRight size={15}/></button> : (
          <div className="journal-save">
            <button
              className="primary"
              type="submit"
              name="action"
              value="save"
              disabled={busy}
            >
              {available && (autoReflect || consent) ? "Save & reflect" : "Save entry"}
            </button>

          </div>

            )}
          </div>
        </form>
      </dialog>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </MotionConfig>
  );
}
