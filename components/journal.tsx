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
} from "lucide-react";
import {
  blankJournal,
  JOURNAL_KEY,
  journalSchema,
  entrySchema,
  sampleJournal,
  contextGroups,
  entryDay,
  type Entry,
  type Journal as JournalData,
  type Reflection,
} from "@/lib/journal";
import { validateEvidence } from "@/lib/ai-contract";
import { KEY, dataSchema, download } from "@/lib/data";
const AI_PERMISSION_KEY = "study-journal-ai-permission-v1";
type View = "Home" | "Journal" | "Patterns" | "Next steps" | "Settings";
const headings = {
  Home: "Home",
  Journal: "Journal",
  Patterns: "Insights",
  "Next steps": "Next steps",
  Settings: "Settings",
};
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
      else {
        const old = localStorage.getItem(KEY);
        if (old)
          setData({
            ...blankJournal,
            courses: dataSchema
              .parse(JSON.parse(old))
              .courses.map((c) => c.name),
          });
      }
    } catch {
      setBlocked(true);
      setError(
        "Saved records could not be read. Import a valid journal backup in Settings before saving new entries.",
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
      setError("Could not remember AI permission. Check browser storage and try again.");
      return false;
    }
  }
  async function ask(entries: Entry[], mode: "entry" | "patterns") {
    if (busy) return;
    if (!available) {
      setError(
        "AI is not connected yet. Your entry is saved, and you can write your own takeaway.",
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
          setNotice("Reflection ready. Keep what fits; change what doesn’t.");
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
  if (!ready)
    return (
      <div className="loading">
        <span className="brand-mark">s.</span>
        <p>Opening your journal…</p>
      </div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className="journal-app">
        <header className="journal-nav">
          <a
            href="/"
            className="brand"
            onClick={(event) => {
              event.preventDefault();
              navigate("Home");
            }}
          >
            <BookOpen size={21} strokeWidth={1.5} />
            <span>
              Study journal
              <span className="brand-caption">A record of your learning</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {(["Home", "Journal", "Patterns"] as View[]).map(
              (v) => (
                <button
                  key={headings[v]}
                  className={view === v ? "selected" : ""}
                  aria-current={view === v ? "page" : undefined}
                  onClick={() => navigate(v)}
                >
                  {view === v && <motion.span className="nav-active-surface" layoutId="active-navigation" transition={{ type: "spring", stiffness: 460, damping: 36 }} />}
                  <span className="nav-tab-label">{headings[v]}</span>
                </button>
              ),
            )}
          </nav>
          <button
            className="icon-button"
            title="Settings"
            aria-label="Settings"
            onClick={() => navigate("Settings")}
          >
            <Settings size={19} />
          </button>
        </header>
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
              <h1>{headings[view]}</h1>
              <p className="subtitle">
                {view === "Home"
                  ? "Log a study session here. Your recent entries and saved next steps appear below."
                  : view === "Journal"
                    ? "Find past sessions. Open an entry to read, edit, or reflect on it."
                    : view === "Patterns"
                      ? "Compare your entries by location and study method, or ask AI to look for recurring themes."
                      : view === "Next steps"
                        ? "Keep track of what you want to try next."
                        : "Manage your data and AI connection."}
              </p>
            </div>
            {(view === "Home" || (view === "Journal" && !selectedEntry)) && <button
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
            <motion.section
              className="home-dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {entries.length > 0 && <div className="home-stats" aria-label="Last seven days">
                <article>
                  <span>Entries · last 7 days</span>
                  <strong>{recent.length}</strong>
                  <small>
                    {new Set(recent.map(entryDay)).size} days recorded
                  </small>
                </article>
                <article>
                  <span>Recorded study time</span>
                  <strong>
                    {timed.length
                      ? `${Math.round((timed.reduce((sum, e) => sum + (e.duration || 0), 0) / 60) * 10) / 10}h`
                      : "—"}
                  </strong>
                  <small>
                    {timed.length} of {recent.length} entries include duration
                  </small>
                </article>
                <article>
                  <span>Open next steps</span>
                  <strong>{pending.length}</strong>
                  <small>
                    {pending.filter((e) => e.due && e.due <= today).length}{" "}
                    planned for today or earlier
                  </small>
                </article>
              </div>
              }
              <section className="card home-recent">
                <div className="card-heading">
                  <h2>Recent sessions</h2>
                </div>
                {entries.slice(0, 3).map((e) => (
                  <button
                    className="home-session"
                    key={e.id}
                    onClick={() => showEntry(e.id)}
                  >
                    <span className="home-session-icon">
                      <BookOpen size={18} />
                    </span>
                    <div>
                      <h3>{e.context}</h3>
                      <small>
                        {entryDay(e)} · {e.location} · {e.methods.join(", ")}
                      </small>
                      <p>{e.reflection}</p>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
                {!entries.length && (
                  <div className="home-empty">
                    <p>Your latest entries will appear here.</p>
                    <p>Use Log a session above. Add a topic, where and how you studied, and a short reflection. That’s enough to get started.</p>
                  </div>
                )}
              </section>
            </motion.section>
          )}
          {view === "Journal" && !selectedEntry && (
            <>
              <div className="journal-list-heading">
                <h2>
                  Your entries <span className="count">{entries.length}</span>
                </h2>
                <span className="private-label">
                  {demo ? "Demo entries" : "Private on this device"}
                </span>
              </div>
              <div className="journal-search">
                <input
                  aria-label="Search journal"
                  placeholder="Search topics, reflections, or locations"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Filter by course"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All subjects</option>
                  {courses.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="entry-list">
                {visible.map((e, i) => (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.15) }}
                    className="entry-card"
                    key={e.id}
                    onClick={() => showEntry(e.id)}
                  >
                    <div className="entry-date">
                      <BookOpen size={17} />
                      <span>{entryDay(e)}</span>
                    </div>
                    <div className="entry-card-body">
                      <div className="entry-title">
                        <h3>{e.context}</h3>
                        <ChevronRight size={17} />
                      </div>
                      <div className="entry-tags">
                        {e.course && <span>{e.course}</span>}
                        <span>
                          <MapPin size={12} />
                          {e.location}
                        </span>
                        {e.methods.map((m) => (
                          <span key={m}>{m}</span>
                        ))}
                        {e.duration && <span>{e.duration} min</span>}
                      </div>
                      <p>{e.reflection}</p>
                      {e.takeaway && (
                        <div className="takeaway-preview">
                          Your takeaway · {e.takeaway}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
              {!visible.length && (
                <div className="journal-empty">
                  <BookOpen size={30} />
                  <h2>
                    {entries.length ? "No matching entries" : "No entries yet"}
                  </h2>
                  <p>
                    {entries.length
                      ? "Try a different search or subject."
                      : "Use Log a session above to log a study session."}
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
                      Explore a sample journal
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {view === "Journal" && selectedEntry && (
            <motion.article className="entry-reader" key={selectedEntry.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} aria-labelledby="saved-entry-title">
              <div className="entry-reader-nav">
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
              <span className="entry-reader-label">Journal / Entry</span>
              </div>
              <section className="card entry-detail">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">
                      {entryDay(selectedEntry)}
                      {selectedEntry.course ? " · " + selectedEntry.course : ""}
                    </p>
                    <h1 id="saved-entry-title" ref={entryHeading} tabIndex={-1}>{selectedEntry.context}</h1>
                  </div>
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => openEntry(selectedEntry)}
                  >
                    <PenLine size={14} />
                    Edit entry
                  </button>
                </div>
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
                <p className="eyebrow entry-body-label">Your session notes</p>
                <p className="reflection-text">{selectedEntry.reflection}</p>
              </section>
              <div className="reflection-grid">
                <section className="reflection-panel" aria-busy={reflectingId === selectedEntry.id} key={selectedEntry.id + "-ai"}>
                  <div className="insight-label">
                    <Sparkles size={16} /> AI REFLECTION
                  </div>
                  {selectedEntry.ai ? (
                    <>
                      <h2>A possible interpretation</h2>
                      <p className="reflection-text">
                        {selectedEntry.ai.summary}
                      </p>
                      <small>
                        Based on this entry · AI suggestion, not a measurement
                        of learning.
                      </small>
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
                          placeholder="Does this fit? Add context or correct it."
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
                        {reflectingId === selectedEntry.id ? "Looking at what helped, what got in the way, and what you could try next." : available ? "No AI reflection has been generated for this entry yet. You can generate it below." : "AI reflection couldn’t be generated because AI isn’t connected yet. Your notes are safely saved."}
                      </p>
                      {available && !autoReflect && reflectingId !== selectedEntry.id && <label className="consent">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        Allow this entry to be sent to OpenAI for reflection.
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
                <details className="card personal-takeaway optional-section" key={selectedEntry.id + "-takeaway"}>
                  <summary>{selectedEntry.takeaway || selectedEntry.nextStep ? "Your takeaway & next step" : "Add a takeaway or next step"}<span>Optional</span></summary>
                  <h2>Your conclusion</h2>
                  <p className="subtitle">
                    Write your own takeaway from this session. Add an optional
                    action to show on Home.
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
                      Your takeaway
                      <textarea
                        name="takeaway"
                        maxLength={1400}
                        defaultValue={selectedEntry.takeaway}
                        placeholder="What did you get out of this session?"
                      />
                    </label>
                    <label>
                      One next step <span className="optional">optional</span>
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
                    <button className="secondary" disabled={busy}>
                      <Check size={15} />
                      Save my takeaway
                    </button>
                  </form>
                </details>
              </div>
            </motion.article>
          )}
          {view === "Patterns" && (
            <>
              {entries.some((e) => e.takeaway) && <details className="card optional-section">
                <summary>Your saved takeaways</summary>
                {entries.filter((e) => e.takeaway).map((e) => <article key={e.id} className="home-suggestion"><small>{entryDay(e)} · {e.context}</small><p>{e.takeaway}</p><button className="text-button" onClick={() => showEntry(e.id)}>Open entry <ArrowRight size={14}/></button></article>)}
              </details>}
              <details className="card pattern-intro optional-section">
                <summary>Ask AI to find recurring themes<span>Optional</span></summary>
                <h2>AI feedback across entries</h2>
                <p>
                  Ask AI to look for recurring themes in your recent
                  reflections. Below, expand a location or method to see its
                  entries. Entry counts do not measure how productive those
                  sessions were.
                </p>
                <p className="ai-disclosure">
                  AI reflection considers your latest{" "}
                  {Math.min(entries.length, 12)} entries, including their text
                  and context. They are sent to OpenAI only when you choose the
                  button below.
                </p>
                <button
                  className="primary"
                  disabled={busy || !available || entries.length < 3}
                  onClick={() => void ask(entries.slice(0, 12), "patterns")}
                >
                  <Sparkles size={16} />
                  {busy
                    ? "Looking across entries…"
                    : "Reflect across my entries"}
                </button>
                <small>
                  {!available
                    ? "AI connection required. Your context overview works without it."
                    : entries.length < 3
                      ? "Add at least 3 entries first."
                      : "You can question or dismiss any interpretation."}
                </small>
              </details>
              {pattern && (
                <section className="reflection-panel pattern-result">
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
                  <small>
                    Save any next step from its supporting journal entry after
                    deciding it fits.
                  </small>
                </section>
              )}
              <div className="context-grid">
                {(["location", "methods"] as const).map((field) => (
                  <section className="card" key={field}>
                    <h2>
                      {field === "location"
                        ? "Where you studied"
                        : "How you studied"}
                    </h2>
                    <p className="subtitle">
                      Recorded context · no productivity ranking
                    </p>
                    {contextGroups(entries, field).map(([label, items]) => (
                      <details className="context-group" key={label}>
                        <summary>
                          {label}
                          <span>
                            {items.length}{" "}
                            {items.length === 1 ? "entry" : "entries"}
                          </span>
                        </summary>
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
                      </details>
                    ))}
                    {!entries.length && (
                      <p className="empty">
                        Context will appear as you add entries.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {view === "Home" && entries.some((e) => e.nextStep) && (
            <section className="card next-step-list">
              <h2>Your next steps</h2>
              <p className="subtitle">
                Actions you saved in your entries. Check one off when it’s done.
              </p>
              {entries
                .filter((e) => e.nextStep)
                .sort(
                  (a, b) =>
                    Number(a.done) - Number(b.done) ||
                    (a.due || "9999").localeCompare(b.due || "9999"),
                )
                .map((e) => (
                  <div
                    className={`next-step ${e.done ? "completed" : ""}`}
                    key={e.id}
                  >
                    <input
                      aria-label={`Complete: ${e.nextStep}`}
                      type="checkbox"
                      checked={e.done}
                      onChange={() => updateEntry({ ...e, done: !e.done })}
                    />
                    <div>
                      <strong>{e.nextStep}</strong>
                      <small>
                        {e.due ? `Planned for ${e.due}` : "Unscheduled"} ·{" "}
                        {e.context}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => {
                          showEntry(e.id);
                        }}
                      >
                        Open reflection <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              {!entries.some((e) => e.nextStep) && (
                <div className="journal-empty">
                  <Flag size={28} />
                  <h2>Leave yourself a useful next step.</h2>
                  <p>
                    Open an entry and write one small thing to try next time.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => navigate("Journal")}
                  >
                    Go to journal
                  </button>
                </div>
              )}
            </section>
          )}
          {view === "Settings" && (
            <div className="context-grid">
              <section className="card settings-journal">
                <h2>Your data stays with you</h2>
                <p>
                  Entries are stored in this browser on this device. Clearing
                  browser data removes them. Keep a backup when switching
                  devices or site addresses.
                </p>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        }),
                        "study-journal-backup.json",
                      )
                    }
                  >
                    <Download size={16} />
                    Export journal
                  </button>
                  <button
                    className="secondary"
                    onClick={() => file.current?.click()}
                  >
                    <Upload size={16} />
                    Import journal
                  </button>
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
                        "Choose a valid version 2 journal backup under 10 MB. Earlier tracker backups belong in the earlier tracker.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
                <h2 className="spaced">Earlier study records</h2>
                <p>
                  Your previous courses, sessions, grades, and exports remain in
                  the earlier tracker. They haven’t been converted into invented
                  journal reflections.
                </p>
                <a className="secondary" href="/history">
                  Open earlier tracker <ArrowRight size={14} />
                </a>
              </section>
              <section className="card settings-journal">
                <h2>AI reflection</h2>
                <label className="consent"><input type="checkbox" checked={autoReflect} onChange={(event) => rememberAiPermission(event.target.checked)}/>Automatically send saved entries and their study context to OpenAI for reflection.</label>
                <p className="ai-disclosure">Applies to entries you save or edit after enabling this. Turning it off stops automatic requests. Existing reflections stay in your journal.</p>
                <p>
                  {available
                    ? "AI reflection is connected."
                    : "AI reflection is not connected yet."}{" "}
                  Saving entries and your own takeaways always works without AI.
                </p>
                <p>
                  With automatic reflection enabled, each entry you save is sent to OpenAI with its study context. Existing entries are not sent in the background. No GPS is collected. API responses are requested with storage disabled; the provider’s data policies still apply.
                </p>
                <p>
                  AI suggestions are interpretations, not verified learning
                  outcomes. You can edit your conclusion, respond with
                  corrections, or ignore the suggestion.
                </p>
                <h2 className="spaced">Explore a sample</h2>
                <p>
                  Sample entries are separate from your journal. Their next
                  steps are examples written for the demo.
                </p>
                <button className="secondary" onClick={toggleDemo}>
                  {demo ? "Exit sample journal" : "Explore sample journal"}
                </button>
              </section>
            </div>
          )}
          <footer className="journal-footer">
            <span>
              Journal entries and takeaways are saved in this browser.
            </span>
            <span>Study Journal · {demo ? "Demo" : "Device-local"}</span>
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
              {["Add a topic. Course and duration are optional.", "Choose a location and the methods you used.", "Write a few thoughts about what helped or got in the way.", "Check your answers, then save."][step]}
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
              placeholder="e.g. Understanding when to use integration by parts"
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
                placeholder="Choose or type a new subject"
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
              placeholder="What felt useful? What was difficult or distracting? What feels clearer—or still unresolved?"
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
            Automatically send each entry’s notes, topic, course, location, study methods, and duration to OpenAI for reflection when I save. Remember on this device; change in Settings.
          </label>}
          <p className="connection-note">{!available ? "AI isn’t connected yet. Your entry will save without a reflection; nothing will be sent automatically later." : autoReflect || consent ? "Your entry saves first, then AI reflects on it. You can correct its interpretation afterward." : "Allow AI reflection above to get feedback automatically, or save your entry without it."}</p>
          {editing && (
            <p className="ai-disclosure">
              Editing clears the previous AI interpretation and reply; your own
              takeaway and next step are kept.
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
