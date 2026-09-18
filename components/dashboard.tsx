"use client";
import { useState, useEffect, useRef } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  ChartNoAxesCombined,
  Clock3,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Download,
  Upload,
  ShieldCheck,
  Sparkles,
  X,
  Trash2,
  Check,
  Target,
  GraduationCap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  type StudyData,
  emptyData,
  demoData,
  dataSchema,
  KEY,
  types,
  localDay,
  download,
} from "@/lib/data";
import { insights, weightedGrade, mean } from "@/lib/analytics";
const views = [
  "Overview",
  "Courses",
  "Sessions",
  "Insights",
  "Settings",
  "Reports",
] as const;
type View = (typeof views)[number];
const icons = [
  LayoutDashboard,
  BookOpen,
  Clock3,
  ChartNoAxesCombined,
  Settings,
];
const hours = (n: number) => `${(n / 60).toFixed(1)}h`;
const today = () => new Date().toLocaleDateString("en-CA");
export default function Dashboard() {
  const [data, setData] = useState<StudyData>(emptyData),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(false),
    [view, setView] = useState<View>("Overview"),
    [course, setCourse] = useState("all"),
    [period, setPeriod] = useState(30),
    [modal, setModal] = useState<"course" | "session" | "exam" | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("date"),
    [method, setMethod] = useState("all"),
    [minRating, setMinRating] = useState(1);
  const selectedCourse = data.courses.find((c) => c.id === course);
  const inCourse =
    course !== "all" && ["Courses", "Sessions", "Insights"].includes(view);
  const pageName = inCourse
    ? selectedCourse?.name || "Course"
    : {
        Overview: "Home",
        Courses: "Courses",
        Sessions: "Study log",
        Insights: "Insights",
        Reports: "Reports",
        Settings: "Data & settings",
      }[view];
  function navigate(next: View) {
    setView(next);
    setCourse("all");
    setQuery("");
    setMethod("all");
    setMinRating(1);
    window.scrollTo({ top: 0 });
  }
  function openCourse(id: string, next: View = "Sessions") {
    setCourse(id);
    setView(next);
    setQuery("");
    setMethod("all");
    setMinRating(1);
    window.scrollTo({ top: 0 });
  }
  const dialog = useRef<HTMLDialogElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(dataSchema.parse(JSON.parse(raw)));
    } catch {
      setError(
        "Saved data could not be read. Export a backup or import a valid file before making changes.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((x) => x.startsWith("study-period="))
      ?.split("=")[1];
    if (saved && [7, 30, 365].includes(Number(saved))) setPeriod(Number(saved));
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.cookie =
      "study-period=" +
      period +
      "; Max-Age=31536000; Path=/; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
  }, [period, ready]);
  useEffect(() => {
    if (demo) return;
    const sync = (event: StorageEvent) => {
      if (event.key === KEY) {
        try {
          setData(
            event.newValue
              ? dataSchema.parse(JSON.parse(event.newValue))
              : emptyData,
          );
          setCourse("all");
        } catch {
          setError(
            "Another tab saved unreadable data. Import a backup to recover.",
          );
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [demo]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(t);
  }, [message]);
  function save(next: StudyData) {
    try {
      const valid = dataSchema.parse(next);
      if (!demo) localStorage.setItem(KEY, JSON.stringify(valid));
      setData(valid);
      return true;
    } catch {
      setError(
        "Could not save. Check your entries and available browser storage.",
      );
      return false;
    }
  }
  function toggleDemo() {
    if (demo) {
      try {
        const raw = localStorage.getItem(KEY);
        setData(raw ? dataSchema.parse(JSON.parse(raw)) : emptyData);
        setDemo(false);
      } catch {
        setError("Unable to restore your saved data.");
      }
    } else {
      setData(demoData());
      setDemo(true);
    }
    setCourse("all");
  }
  const all = data.sessions.filter(
    (s) => course === "all" || s.courseId === course,
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);
  const sessions = all.filter(
    (s) => new Date(s.date) >= cutoff && new Date(s.date) <= new Date(),
  );
  const exams = data.exams.filter(
    (e) => (course === "all" || e.courseId === course) && e.date <= today(),
  );
  const analysis = insights(
    all,
    course === "all" && data.courses.length > 1 ? [] : exams,
  );
  const total = sessions.reduce((a, s) => a + s.duration, 0);
  const week = all
    .filter(
      (s) =>
        Date.now() - Date.parse(s.date) < 7 * 86400000 &&
        Date.parse(s.date) <= Date.now(),
    )
    .reduce((a, s) => a + s.duration, 0);
  const chart = Array.from({ length: period }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - period + 1 + i);
    const key = d.toLocaleDateString("en-CA");
    return {
      day: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      hours: Number(
        (
          all
            .filter((s) => localDay(s) === key)
            .reduce((a, s) => a + s.duration, 0) / 60
        ).toFixed(2),
      ),
    };
  });
  const filtered = sessions
    .filter(
      (s) =>
        (method === "all" || s.type === method) &&
        s.rating >= minRating &&
        `${s.type} ${data.courses.find((c) => c.id === s.courseId)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "duration"
        ? b.duration - a.duration
        : sort === "rating"
          ? b.rating - a.rating
          : b.date.localeCompare(a.date),
    );
  function submit(form: FormData) {
    const val = (k: string) => String(form.get(k) || "");
    const num = (k: string) => Number(val(k));
    const id = crypto.randomUUID();
    let next = data;
    if (modal === "course")
      next = {
        ...data,
        courses: [
          ...data.courses,
          {
            id,
            name: val("name"),
            icon: val("icon") || "◈",
            color: val("color"),
          },
        ],
      };
    if (modal === "session") {
      const d = new Date(val("date"));
      if (d > new Date()) {
        setError("Study sessions must be in the past.");
        return;
      }
      next = {
        ...data,
        sessions: [
          ...data.sessions,
          {
            id,
            courseId: val("courseId"),
            type: val("type"),
            duration: num("duration"),
            rating: num("rating"),
            date: d.toISOString(),
            offset: d.getTimezoneOffset(),
          },
        ],
      };
    }
    if (modal === "exam")
      next = {
        ...data,
        exams: [
          ...data.exams,
          {
            id,
            courseId: val("courseId"),
            name: val("name"),
            type: val("type"),
            grade: num("grade"),
            maxGrade: num("maxGrade"),
            weight: num("weight"),
            date: val("date"),
          },
        ],
      };
    if (save(next)) {
      if (modal === "course") openCourse(id);
      setModal(null);
      setMessage(demo ? "Updated demo data" : "Saved on this device");
    }
  }
  async function report(format: "pdf" | "docx") {
    try {
      const { exportReport } = await import("@/lib/reports");
      await exportReport(data, course, period, format);
      setMessage("Report downloaded");
    } catch {
      setError("Report export failed. Please try again.");
    }
  }
  function remove(kind: "sessions" | "exams" | "courses", id: string) {
    if (
      !confirm(
        kind === "courses"
          ? "Delete this course and all its sessions and exams?"
          : "Delete this record?",
      )
    )
      return;
    save(
      kind === "courses"
        ? {
            ...data,
            courses: data.courses.filter((x) => x.id !== id),
            sessions: data.sessions.filter((x) => x.courseId !== id),
            exams: data.exams.filter((x) => x.courseId !== id),
          }
        : { ...data, [kind]: data[kind].filter((x) => x.id !== id) },
    );
    if (kind === "courses") setCourse("all");
  }
  if (!ready)
    return (
      <div className="loading">
        <span className="brand-mark">s.</span>
        <p>Opening your workspace…</p>
      </div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <aside className="sidebar">
          <a className="brand" href="#" onClick={() => navigate("Overview")}>
            <span className="brand-mark">s.</span>
            <span>
              study<span className="muted">analyzer</span>
            </span>
          </a>
          <div className="workspace">
            <span className="avatar">Y</span>
            <div>
              Your workspace<small>Private · No login</small>
            </div>
          </div>
          <p className="nav-label">WORKSPACE</p>
          <nav>
            {(["Overview", "Courses", "Reports"] as View[]).map((v) => {
              const Icon =
                v === "Overview"
                  ? LayoutDashboard
                  : v === "Courses"
                    ? BookOpen
                    : Download;
              return (
                <button
                  key={v}
                  className={
                    view === v || (v === "Courses" && inCourse)
                      ? "nav active"
                      : "nav"
                  }
                  aria-label={v === "Overview" ? "Home" : v}
                  title={v === "Overview" ? "Home" : v}
                  onClick={() => navigate(v)}
                >
                  <Icon size={19} />
                  {v === "Overview" ? "Home" : v}
                  {v === "Insights" && <span className="nav-dot" />}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <button
              className={view === "Settings" ? "nav active" : "nav"}
              aria-label="Data & settings"
              title="Data & settings"
              onClick={() => navigate("Settings")}
            >
              <Settings size={19} />
              <span>Data & settings</span>
            </button>
            <div className="privacy">
              <ShieldCheck size={19} />
              <strong>Just you and your progress.</strong>
              <p>Your study data stays in this browser. No account needed.</p>
            </div>
            <div className="profile">
              <span className="avatar">Y</span>
              <div>
                Your space<small>Make a little progress today.</small>
              </div>
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <span>
              My workspace <span className="slash">/</span>{" "}
              <strong>{inCourse ? `Courses / ${pageName}` : pageName}</strong>
            </span>
            <span className="local">
              <span />{" "}
              {demo
                ? "Demo workspace"
                : error
                  ? "Check storage status"
                  : "Saved on this device"}
            </span>
          </header>
          <div className="content">
            {demo && (
              <div className="demo-banner">
                <span>
                  <Sparkles size={15} /> You’re exploring sample data. Your
                  personal records are separate.
                </span>
                <button onClick={toggleDemo}>
                  Exit demo <X size={14} />
                </button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {inCourse ? "YOUR COURSE WORKSPACE" : "STUDY ANALYZER"}
                </p>
                <h1>{pageName}</h1>
                <p className="subtitle">
                  {inCourse
                    ? "Everything for this course, together in one place."
                    : view === "Overview"
                      ? "Your progress at a glance. Choose a course to keep going."
                      : view === "Courses"
                        ? "Choose a course to log study time, record grades, or explore insights."
                        : view === "Reports"
                          ? "Choose what to include, then download your report."
                          : view === "Sessions"
                            ? "All your recorded study sessions. Search or filter to find one."
                            : "Manage your weekly goal and keep a backup of your data."}
                </p>
              </div>
              {!["Settings", "Reports"].includes(view) && (
                <button
                  className="primary"
                  onClick={() =>
                    setModal(
                      view === "Courses" && inCourse
                        ? "exam"
                        : view === "Courses" && !inCourse
                          ? "course"
                          : data.courses.length
                            ? "session"
                            : "course",
                    )
                  }
                >
                  <Plus size={18} />
                  {view === "Courses" && inCourse
                    ? "Record exam"
                    : view === "Courses" && !inCourse
                      ? "Add course"
                      : data.courses.length
                        ? "Log study session"
                        : "Add your first course"}
                </button>
              )}
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
            {inCourse && (
              <>
                <button
                  className="text-button back-link"
                  onClick={() => navigate("Courses")}
                >
                  ← All courses
                </button>
                <nav className="course-tabs" aria-label="Course sections">
                  {(
                    [
                      { view: "Sessions", label: "Sessions" },
                      { view: "Courses", label: "Grades" },
                      { view: "Insights", label: "Insights" },
                    ] as { view: View; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.view}
                      aria-current={view === t.view ? "page" : undefined}
                      className={view === t.view ? "selected" : ""}
                      onClick={() => setView(t.view)}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              </>
            )}
            {view === "Sessions" && !inCourse && (
              <button
                className="text-button back-link"
                onClick={() => navigate("Overview")}
              >
                ← Back to Home
              </button>
            )}
            {["Overview", "Sessions", "Reports"].includes(view) && (
              <div className="filters">
                <span className="filter-label">
                  {view === "Reports" ? "Report period" : "Show"}
                </span>
                <div className="segmented">
                  {[7, 30, 365].map((n) => (
                    <button
                      key={n}
                      aria-pressed={period === n}
                      className={period === n ? "selected" : ""}
                      onClick={() => setPeriod(n)}
                    >
                      {n === 7 ? "7 days" : n === 30 ? "30 days" : "Year"}
                    </button>
                  ))}
                </div>
                {view !== "Overview" && !inCourse && (
                  <label className="inline-filter">
                    Course
                    <select
                      aria-label="Filter by course"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                    >
                      <option value="all">All courses</option>
                      {data.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            {view === "Reports" && (
              <section className="card report-panel">
                <h2>Study summary</h2>
                <p>
                  {course === "all" ? "All courses" : selectedCourse?.name} ·
                  Last {period} days
                </p>
                <div className="report-stats">
                  <strong>
                    {sessions.length}
                    <small>sessions</small>
                  </strong>
                  <strong>
                    {hours(total)}
                    <small>study time</small>
                  </strong>
                </div>
                <p>
                  Includes study time by course and method, your session log,
                  and cumulative recorded grades.
                </p>
                <div className="button-row">
                  <button className="primary" onClick={() => report("pdf")}>
                    <Download size={16} />
                    Download PDF
                  </button>
                  <button className="secondary" onClick={() => report("docx")}>
                    <Download size={16} />
                    Download Word
                  </button>
                </div>
              </section>
            )}
            {view === "Overview" && (
              <>
                <section className="stats">
                  {[
                    {
                      label: "Total study time",
                      value: hours(total),
                      sub: `Across ${sessions.length} focused sessions`,
                      icon: Clock3,
                    },
                    {
                      label: "Study consistency",
                      value: `${new Set(sessions.map(localDay)).size}`,
                      suffix: "days",
                      sub: `Active days in the last ${period} days`,
                      icon: ChartNoAxesCombined,
                    },
                    {
                      label: "Session effectiveness",
                      value: sessions.length
                        ? mean(sessions.map((s) => s.rating)).toFixed(1)
                        : "—",
                      suffix: "/ 5",
                      sub: "Your self-reported focus rating",
                      icon: Sparkles,
                    },
                    {
                      label: "Active courses",
                      value: String(data.courses.length),
                      sub: "One step closer to your goals",
                      icon: BookOpen,
                    },
                  ].map((x) => (
                    <article className="stat" key={x.label}>
                      <div className="stat-label">
                        {x.label}
                        <x.icon size={17} />
                      </div>
                      <div className="stat-value">
                        {x.value} <small>{x.suffix}</small>
                      </div>
                      <p>{x.sub}</p>
                    </article>
                  ))}
                </section>
                <div className="overview-grid">
                  <section className="card chart-card">
                    <div className="card-heading">
                      <div>
                        <h2>Your study rhythm</h2>
                        <p>Study hours per day in the selected period.</p>
                      </div>
                      <span className="legend">
                        <i /> Study hours
                      </span>
                    </div>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chart}
                          margin={{ top: 15, right: 15, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="area"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#7470dd"
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="100%"
                                stopColor="#7470dd"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 5"
                            vertical={false}
                            stroke="#ececf1"
                          />
                          <XAxis
                            dataKey="label"
                            minTickGap={45}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#8b8c9c", fontSize: 11 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#8b8c9c", fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid #ececf1",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="hours"
                            stroke="#7771d7"
                            strokeWidth={2.5}
                            fill="url(#area)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    {!sessions.length && (
                      <div className="chart-empty">
                        Your next chapter starts with a single session.
                      </div>
                    )}
                  </section>
                  <section className="goal-card">
                    <div className="goal-top">
                      <span className="goal-icon">
                        <Target size={21} />
                      </span>
                      <span>YOUR WEEKLY GOAL</span>
                    </div>
                    <h2>
                      Weekly study
                      <br />
                      goal
                    </h2>
                    <p>
                      Protect some time for the things
                      <br />
                      you want to learn.
                    </p>
                    <div className="goal-number">
                      {hours(week)} <span>/ {data.goal}h</span>
                    </div>
                    <div className="progress-track">
                      <div
                        style={{
                          width: `${Math.min(100, (week / (data.goal * 60)) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>
                      {Math.round((week / (data.goal * 60)) * 100)}% of your
                      goal · rolling 7 days
                    </small>
                    <button onClick={() => navigate("Settings")}>
                      Adjust your goal <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
                <div className="section-title">
                  <h2>
                    Your courses <span>{data.courses.length}</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setModal("course")}
                  >
                    <Plus size={15} /> Add course
                  </button>
                </div>
                {courseCards()}
                <div className="bottom-grid">
                  <section className="card">
                    <div className="card-heading">
                      <h2>Recent sessions</h2>
                      <button
                        className="text-button"
                        onClick={() => navigate("Sessions")}
                      >
                        View all sessions <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {sessionList(filtered.slice(0, 4))}
                  </section>
                </div>
              </>
            )}
            {view === "Courses" && (
              <>
                {!inCourse && courseCards()}
                {inCourse && (
                  <section className="card exam-card">
                    <div className="card-heading">
                      <div>
                        <h2>Exams & grades</h2>
                        <p className="grade-summary">
                          {weightedGrade(exams) === null
                            ? "No recorded grade yet"
                            : weightedGrade(exams)?.toFixed(1) +
                              "% recorded grade"}
                        </p>
                        <p>
                          Grades are normalized by their recorded weights within
                          each course.
                        </p>
                      </div>
                    </div>
                    {data.exams
                      .filter((e) => course === "all" || e.courseId === course)
                      .map((e) => (
                        <div className="session-row" key={e.id}>
                          <GraduationCap size={21} />
                          <div className="grow">
                            <strong>{e.name}</strong>
                            <small>
                              {
                                data.courses.find((c) => c.id === e.courseId)
                                  ?.name
                              }{" "}
                              · {e.date} · {e.weight}% weight
                            </small>
                          </div>
                          <strong>
                            {((e.grade / e.maxGrade) * 100).toFixed(1)}%
                          </strong>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${e.name}`}
                            onClick={() => remove("exams", e.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    {!exams.length && (
                      <p className="empty">
                        Record an exam to connect your study habits with your
                        results.
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
            {view === "Sessions" && (
              <section className="card">
                <div className="session-filters">
                  <input
                    aria-label="Search sessions"
                    placeholder="Search sessions or courses…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Study method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="all">All methods</option>
                    {[...new Set([...types, ...all.map((s) => s.type)])].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Minimum rating"
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}+ stars
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Sort sessions"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="date">Newest first</option>
                    <option value="duration">Longest first</option>
                    <option value="rating">Highest rated</option>
                  </select>
                </div>
                {sessionList(filtered)}
              </section>
            )}
            {view === "Insights" && (
              <>
                <div className="method-note">
                  <ShieldCheck size={22} />
                  <div>
                    <strong>Evidence before advice.</strong>
                    <p>
                      Ratings describe how studying felt. Exam comparisons show
                      associations, not causes.{" "}
                      {course === "all"
                        ? "Select a course to unlock exam insights; different subjects are never pooled."
                        : "Differences in exam difficulty and study effort can still affect results."}
                    </p>
                  </div>
                </div>
                <div className="insights-grid">
                  {analysis
                    .filter((i) => i.level !== "Collecting data")
                    .map((i, index) => (
                      <motion.article
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="card insight-card"
                        key={i.title}
                      >
                        <div className="card-heading">
                          <span className="insight-number">0{index + 1}</span>
                          <span
                            className={`badge ${i.level === "Collecting data" ? "muted-badge" : ""}`}
                          >
                            {i.level}
                          </span>
                        </div>
                        <h2>{i.title}</h2>
                        <h3>{i.finding}</h3>
                        <details className="evidence">
                          <summary>Why this insight?</summary>
                          <p>{i.evidence}</p>
                        </details>
                        <footer>
                          {i.n} observations ·{" "}
                          {course === "all"
                            ? "Across selected courses"
                            : "Within this course"}
                        </footer>
                      </motion.article>
                    ))}
                </div>
                {!analysis.some((i) => i.level !== "Collecting data") && (
                  <div className="card">
                    <h2>Your insights are taking shape</h2>
                    <p className="subtitle">
                      Keep logging study sessions and exam results. Patterns
                      will appear here when there is enough data to compare.
                    </p>
                  </div>
                )}
                {analysis.some((i) => i.level === "Collecting data") && (
                  <details className="pending-insights">
                    <summary>
                      Still gathering evidence ·{" "}
                      {
                        analysis.filter((i) => i.level === "Collecting data")
                          .length
                      }{" "}
                      analyses
                    </summary>
                    <p className="subtitle">
                      See what each analysis needs before it can show a useful
                      comparison.
                    </p>
                    <div className="insights-grid">
                      {analysis
                        .filter((i) => i.level === "Collecting data")
                        .map((i) => (
                          <article className="card insight-card" key={i.title}>
                            <h2>{i.title}</h2>
                            <p>{i.evidence}</p>
                            <footer>{i.n} observations recorded</footer>
                          </article>
                        ))}
                    </div>
                  </details>
                )}
              </>
            )}
            {view === "Settings" && (
              <div className="settings-grid">
                <section className="card">
                  <h2>Your weekly target</h2>
                  <p>
                    Choose a realistic number of hours to make space for
                    learning.
                  </p>
                  <label>
                    Hours per week
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={data.goal}
                      onChange={(e) => {
                        const goal = Number(e.target.value);
                        if (goal >= 1 && goal <= 100) save({ ...data, goal });
                      }}
                    />
                  </label>
                  <h2 className="spaced">Explore the workspace</h2>
                  <p>
                    Try sample courses and sessions without changing your
                    personal records.
                  </p>
                  <button className="secondary" onClick={toggleDemo}>
                    <Sparkles size={16} />
                    {demo ? "Exit sample workspace" : "Explore demo data"}
                  </button>
                </section>
                <section className="card">
                  <h2>Your data belongs to you</h2>
                  <p>
                    Records are stored in this browser, on this device. Clearing
                    browser data removes them. Back up your workspace regularly.
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(data, null, 2)], {
                            type: "application/json",
                          }),
                          "study-analyzer-backup.json",
                        )
                      }
                    >
                      <Download size={16} /> Back up JSON
                    </button>
                    <button
                      className="secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={16} /> Import backup
                    </button>
                  </div>
                  <input
                    hidden
                    ref={importRef}
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        if (f.size > 10000000) throw Error();
                        const parsed = dataSchema.parse(
                          JSON.parse(await f.text()),
                        );
                        if (
                          confirm(
                            `Replace this workspace with ${parsed.courses.length} courses and ${parsed.sessions.length} sessions?`,
                          )
                        ) {
                          if (save(parsed)) {
                            setCourse("all");
                            setMessage("Backup imported");
                          }
                        }
                      } catch {
                        setError(
                          "Invalid backup. Choose a Study Analyzer v1 JSON file under 10 MB.",
                        );
                      }
                      e.target.value = "";
                    }}
                  />
                </section>
              </div>
            )}
            <footer className="page-footer">
              <span>Built for your next breakthrough.</span>
              <button className="text-button" onClick={toggleDemo}>
                {demo ? "Exit demo" : "Explore with demo data"}{" "}
                <ArrowUpRight size={13} />
              </button>
            </footer>
          </div>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">MAKE A LITTLE PROGRESS</p>
            <h2>
              {modal === "course"
                ? "Add a course"
                : modal === "session"
                  ? "Log a study session"
                  : "Record an exam grade"}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form action={submit}>
          {modal === "course" ? (
            <>
              <label>
                Course name
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={100}
                  placeholder="e.g. Computer Science"
                />
              </label>
              <div className="form-grid">
                <label>
                  Icon
                  <input name="icon" defaultValue="◈" maxLength={12} />
                </label>
                <label>
                  Course color
                  <input type="color" name="color" defaultValue="#7771d7" />
                </label>
              </div>
            </>
          ) : (
            <>
              <label>
                Course
                <select
                  name="courseId"
                  defaultValue={course === "all" ? data.courses[0]?.id : course}
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {modal === "session" ? (
                <>
                  <label>
                    Study method
                    <input
                      name="type"
                      list="methods"
                      defaultValue="Active recall"
                      required
                      maxLength={100}
                    />
                    <datalist id="methods">
                      {types.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </datalist>
                  </label>
                  <div className="form-grid">
                    <label>
                      Duration (minutes)
                      <input
                        name="duration"
                        type="number"
                        min="1"
                        max="1440"
                        defaultValue="45"
                        required
                      />
                    </label>
                    <label>
                      Effectiveness
                      <select name="rating" defaultValue="4">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {"★".repeat(n)} · {n}/5
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    When did you study?
                    <input
                      type="datetime-local"
                      name="date"
                      required
                      defaultValue={new Date(
                        Date.now() - new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Exam name
                    <input
                      name="name"
                      required
                      maxLength={100}
                      placeholder="e.g. Midterm 1"
                    />
                  </label>
                  <label>
                    Exam type
                    <select name="type">
                      {[
                        "Quiz",
                        "Test",
                        "Midterm",
                        "Final",
                        "Project",
                        "Assignment",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Grade received
                      <input
                        name="grade"
                        type="number"
                        min="0"
                        step="any"
                        required
                      />
                    </label>
                    <label>
                      Maximum grade
                      <input
                        name="maxGrade"
                        type="number"
                        min="0.01"
                        step="any"
                        defaultValue="100"
                        required
                      />
                    </label>
                    <label>
                      Weight (%)
                      <input
                        name="weight"
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        defaultValue="5"
                        required
                      />
                    </label>
                    <label>
                      Exam date
                      <input
                        name="date"
                        type="date"
                        defaultValue={today()}
                        required
                      />
                    </label>
                  </div>
                </>
              )}
            </>
          )}
          <p className="form-note">
            <ShieldCheck size={14} />
            {demo
              ? "Changes stay in this demo only."
              : "Saved privately in your browser."}
          </p>
          <button className="primary wide" type="submit">
            <Check size={17} /> Save {modal}
          </button>
        </form>
      </dialog>
      {message && (
        <div role="status" className="toast">
          <Check size={17} />
          {message}
        </div>
      )}
    </MotionConfig>
  );
  function courseCards() {
    return (
      <div className="courses-grid">
        {data.courses
          .filter((c) => course === "all" || c.id === course)
          .map((c) => {
            const s = data.sessions.filter(
              (s) => s.courseId === c.id && new Date(s.date) <= new Date(),
            );
            const grade = weightedGrade(
              exams.filter((e) => e.courseId === c.id),
            );
            return (
              <article className="card course-card" key={c.id}>
                <div className="course-top">
                  <span
                    className="course-icon"
                    style={{ color: c.color, background: c.color + "16" }}
                  >
                    {c.icon}
                  </span>
                  <button
                    aria-label={`Open ${c.name}`}
                    className="icon-button"
                    onClick={() => {
                      openCourse(c.id);
                    }}
                  >
                    <ArrowUpRight size={19} />
                  </button>
                </div>
                <h3>
                  <button
                    className="course-name"
                    onClick={() => openCourse(c.id)}
                  >
                    {c.name}
                  </button>
                </h3>
                <p>
                  {s.length} sessions <span>·</span>{" "}
                  {hours(s.reduce((a, x) => a + x.duration, 0))} studied
                </p>
                <div className="course-bottom">
                  <span>
                    <i style={{ background: c.color }} />{" "}
                    {grade === null
                      ? "No grades yet"
                      : `${grade.toFixed(1)}% recorded grade`}
                  </span>
                  {view === "Courses" ? (
                    <button
                      aria-label={`Delete ${c.name}`}
                      className="icon-button"
                      onClick={() => remove("courses", c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span
                      className="tiny-chart"
                      aria-label="Study activity over the last 8 days"
                    >
                      {chart.slice(-8).map((d) => {
                        const minutes = s
                          .filter((x) => localDay(x) === d.day)
                          .reduce((a, x) => a + x.duration, 0);
                        return (
                          <i
                            key={d.day}
                            title={`${d.label}: ${minutes} minutes`}
                            style={{
                              height: Math.max(2, Math.min(24, minutes / 6)),
                              background: c.color,
                              opacity: minutes ? 0.8 : 0.15,
                            }}
                          />
                        );
                      })}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        {!data.courses.length && (
          <button className="empty-course" onClick={() => setModal("course")}>
            <Plus size={25} />
            <strong>Add your first course</strong>
            <span>A fresh start for your next big idea.</span>
          </button>
        )}
      </div>
    );
  }
  function sessionList(list: typeof sessions) {
    return (
      <div>
        {list.map((s) => {
          const c = data.courses.find((c) => c.id === s.courseId);
          return (
            <div className="session-row" key={s.id}>
              <span
                className="session-icon"
                style={{ color: c?.color, background: c?.color + "14" }}
              >
                {c?.icon}
              </span>
              <div className="grow">
                <strong>{s.type}</strong>
                <small>
                  {c?.name} · {localDay(s)}
                </small>
              </div>
              <span className="stars" aria-label={`${s.rating} out of 5 stars`}>
                {"★".repeat(s.rating)}
                <span>{"★".repeat(5 - s.rating)}</span>
              </span>
              <span className="duration">{s.duration}m</span>
              {view === "Sessions" && (
                <button
                  className="icon-button"
                  aria-label={`Delete session ${s.type} ${localDay(s)}`}
                  onClick={() => remove("sessions", s.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
        {!list.length && (
          <p className="empty">
            No sessions here yet. Log a session to start seeing your progress.
          </p>
        )}
      </div>
    );
  }
}
