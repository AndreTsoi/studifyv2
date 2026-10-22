"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Home,
  Plus,
  Flag,
  Settings,
  Clock3,
} from "lucide-react";
import { JOURNAL_KEY } from "@/lib/journal";

export default function Landing() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Returning visitors (anyone with saved entries) skip straight to their journal.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved?.entries) && saved.entries.length > 0) {
          router.replace("/journal");
          return;
        }
      }
    } catch {
      /* fall through to the landing page */
    }
    setReady(true);
  }, [router]);

  if (!ready) return <div className="landing-splash" aria-hidden />;

  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-brand">
          <span className="brand-mark">s.</span>
          Studify
        </span>
        <a className="landing-btn ghost" href="/journal">
          Open journal
          <ArrowRight size={15} />
        </a>
      </header>

      <main className="landing-hero">
        <div className="hero-copy">
          <span className="hero-badge">
            <span className="hero-dot" />
            Private · on your device
          </span>
          <h1 className="hero-title">
            Your personal
            <br />
            study journal.
            <span className="hero-caret" aria-hidden />
          </h1>
          <p className="hero-sub">
            Reflect on your sessions, see what&rsquo;s working, and choose a
            clearer next step.
          </p>
          <div className="hero-cta">
            <a className="landing-btn" href="/journal">
              <BookOpen size={17} />
              Start journaling
            </a>
            <span className="hero-note">No account needed</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden>
          <div className="hero-glow" />
          <div className="mock-app">
            <aside className="mock-side">
              <div className="mock-brand">
                <span className="mock-mark">s.</span>
                Studify
              </div>
              <nav className="mock-nav">
                <span className="on">
                  <Home size={15} />
                  Home
                </span>
                <span>
                  <BookOpen size={15} />
                  Journal
                </span>
                <span>
                  <Sparkles size={15} />
                  Insights
                </span>
              </nav>
              <div className="mock-nav-label">Shortcuts</div>
              <nav className="mock-nav">
                <span className="dark">
                  <Plus size={15} />
                  Log a session
                </span>
                <span>
                  <Flag size={15} />
                  Next steps
                </span>
                <span>
                  <Settings size={15} />
                  Settings
                </span>
              </nav>
            </aside>

            <div className="mock-body">
              <div className="mock-head">
                <span className="mock-avatar" />
                <strong>Welcome back</strong>
              </div>

              <div className="mock-actions">
                {(
                  [
                    ["a1", Plus, "Log a session"],
                    ["a2", BookOpen, "Your journal"],
                    ["a3", Sparkles, "Insights"],
                    ["a4", Flag, "Next steps"],
                  ] as const
                ).map(([tint, Icon, label]) => (
                  <div className="act" key={label}>
                    <span className={`act-top ${tint}`}>
                      <Icon size={22} />
                    </span>
                    <span className="act-label">
                      {label}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                ))}
              </div>

              <div className="mock-sec">This week</div>
              <div className="mock-week">
                <div className="mock-chart">
                  <span className="chart-pill">Last 7 days</span>
                  <strong className="chart-num">3.4h</strong>
                  <div className="bars">
                    {[42, 70, 30, 88, 54, 22, 60].map((h, i) => (
                      <span key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="bar-x">
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                    <span>Sun</span>
                  </div>
                  <div className="chart-foot">Total study time</div>
                </div>
                <div className="mock-summary">
                  <div className="sum-card">
                    <span className="sum-ico">
                      <BookOpen size={13} />
                    </span>
                    <small>THIS WEEK</small>
                    <strong>5 sessions</strong>
                    <span className="sum-meta">across 4 days</span>
                  </div>
                  <div className="sum-btn ghost">
                    <Clock3 size={12} />
                    Session history
                  </div>
                  <div className="sum-btn dark">
                    <Plus size={12} />
                    Log a session
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="landing-foot">
        <span>Studify</span>
        <span>Private, device-local study journal</span>
      </footer>
    </div>
  );
}
