import { type Session, type Exam, localDay } from "./data.ts";
export const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
export function weightedGrade(exams: Exam[]) {
  const weight = exams.reduce((a, e) => a + e.weight, 0);
  return weight
    ? exams.reduce((a, e) => a + (e.grade / e.maxGrade) * 100 * e.weight, 0) /
        weight
    : null;
}
export type Insight = {
  title: string;
  finding: string;
  evidence: string;
  level: "Collecting data" | "Exploratory" | "Moderate";
  n: number;
};
const variance = (v: number[]) =>
  v.length < 2
    ? 0
    : v.reduce((a, x) => a + (x - mean(v)) ** 2, 0) / (v.length - 1);
function compare(
  title: string,
  a: number[],
  b: number[],
  aName: string,
  bName: string,
  unit: string,
): Insight {
  const n = a.length + b.length;
  if (Math.min(a.length, b.length) < 5)
    return {
      title,
      finding: "A little more data will help.",
      evidence: `Need at least 5 observations in each group. ${aName}: ${a.length}; ${bName}: ${b.length}.`,
      level: "Collecting data",
      n,
    };
  const diff = mean(a) - mean(b);
  const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  const margin = 2.58 * se;
  return {
    title,
    finding: `${aName} average ${mean(a).toFixed(1)}${unit}; ${bName} average ${mean(b).toFixed(1)}${unit}.`,
    evidence: `Difference ${diff.toFixed(1)}${unit}; approximate 99% interval ${(diff - margin).toFixed(1)} to ${(diff + margin).toFixed(1)}. Observational association, not a causal effect.`,
    level:
      Math.min(a.length, b.length) >= 20 && se > 0 && Math.abs(diff) > margin
        ? "Moderate"
        : "Exploratory",
    n,
  };
}
export function insights(sessions: Session[], exams: Exam[]): Insight[] {
  const ratings = (s: Session[]) => s.map((x) => x.rating);
  const result = [
    compare(
      "Session length & diminishing returns",
      ratings(sessions.filter((s) => s.duration >= 30 && s.duration <= 90)),
      ratings(sessions.filter((s) => s.duration > 90)),
      "30–90 min",
      "90+ min",
      " / 5",
    ),
  ];
  const buckets = new Map<string, Session[]>();
  for (const s of sessions) {
    const start = Math.floor(s.duration / 15) * 15;
    const key = `${start}–${start + 14} min`;
    buckets.set(key, [...(buckets.get(key) || []), s]);
  }
  const eligible = [...buckets]
    .filter(([, s]) => s.length >= 5)
    .map(([label, s]) => ({
      label,
      n: s.length,
      score:
        (s.reduce((a, x) => a + x.rating, 0) + 5 * mean(ratings(sessions))) /
        (s.length + 5),
    }))
    .sort((a, b) => b.score - a.score);
  result.push({
    title: "Your session sweet spot",
    finding:
      eligible.length >= 2
        ? `${eligible[0].label} has the highest adjusted rating.`
        : "Keep exploring different session lengths.",
    evidence:
      eligible.length >= 2
        ? `Adjusted rating ${eligible[0].score.toFixed(2)}/5, from ${eligible[0].n} sessions. Small groups are pulled toward your overall average; this is not a proven optimum.`
        : "Need 5 sessions in at least two 15-minute buckets.",
    level: eligible.length >= 2 ? "Exploratory" : "Collecting data",
    n: sessions.length,
  });
  const prep = exams
    .map((e) => {
      const earlier = exams
        .filter((x) => x.courseId === e.courseId && x.date < e.date)
        .map((x) => x.date)
        .sort()
        .at(-1);
      const end = Date.parse(e.date + "T00:00:00Z");
      const s = sessions.filter(
        (s) =>
          s.courseId === e.courseId &&
          localDay(s) < e.date &&
          (!earlier || localDay(s) > earlier) &&
          end - Date.parse(localDay(s) + "T00:00:00Z") <= 14 * 86400000,
      );
      const total = s.reduce((a, x) => a + x.duration, 0);
      return {
        score: (e.grade / e.maxGrade) * 100,
        s,
        total,
        days: new Set(s.map(localDay)).size,
        recent: s
          .filter(
            (x) => end - Date.parse(localDay(x) + "T00:00:00Z") <= 3 * 86400000,
          )
          .reduce((a, x) => a + x.duration, 0),
        mix: new Set(s.map((x) => x.type)).size,
      };
    })
    .filter((x) => x.total > 0);
  result.push(
    compare(
      "Distributed preparation",
      prep.filter((x) => x.days >= 4).map((x) => x.score),
      prep.filter((x) => x.days <= 2).map((x) => x.score),
      "4+ study days",
      "1–2 study days",
      "%",
    ),
  );
  result.push(
    compare(
      "Last-minute concentration",
      prep.filter((x) => x.recent / x.total >= 0.7).map((x) => x.score),
      prep.filter((x) => x.recent / x.total < 0.7).map((x) => x.score),
      "70%+ in final 3 days",
      "More distributed",
      "%",
    ),
  );
  result.push(
    compare(
      "Study method variety",
      prep.filter((x) => x.mix >= 3).map((x) => x.score),
      prep.filter((x) => x.mix === 1).map((x) => x.score),
      "3+ methods",
      "One method",
      "%",
    ),
  );
  result.push(
    compare(
      "Preparation recency",
      prep.filter((x) => x.recent / x.total < 0.5).map((x) => x.score),
      prep.filter((x) => x.recent / x.total >= 0.5).map((x) => x.score),
      "Mostly 4–14 days before",
      "Mostly 1–3 days before",
      "%",
    ),
  );
  const combos = new Map<string, Session[]>();
  sessions.forEach((s) => {
    const hour = new Date(
      new Date(s.date).getTime() - s.offset * 60000,
    ).getUTCHours();
    const key = `${hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"} · ${s.type} · ${s.duration <= 60 ? "≤60" : "60+"} min`;
    combos.set(key, [...(combos.get(key) || []), s]);
  });
  const ranked = [...combos]
    .filter(([, s]) => s.length >= 8)
    .map(([label, s]) => ({
      label,
      n: s.length,
      score:
        (s.reduce((a, x) => a + x.rating, 0) + 8 * mean(ratings(sessions))) /
        (s.length + 8),
    }))
    .sort((a, b) => b.score - a.score);
  result.push({
    title: "Your focus recipe",
    finding:
      ranked.length >= 2
        ? ranked[0].label
        : "Your routine is still taking shape.",
    evidence:
      ranked.length >= 2
        ? `Highest adjusted rating: ${ranked[0].score.toFixed(2)}/5 across ${ranked[0].n} sessions. All ratings included, not just 5-star sessions. Explore and validate with future sessions.`
        : "Need at least two time / method / duration combinations with 8 sessions each.",
    level: ranked.length >= 2 ? "Exploratory" : "Collecting data",
    n: sessions.length,
  });
  return result;
}
