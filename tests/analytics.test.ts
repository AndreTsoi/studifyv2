import { test } from "node:test";
import assert from "node:assert/strict";
import { weightedGrade, insights } from "../lib/analytics.ts";
import {
  dataSchema,
  emptyData,
  localDay,
  type Session,
  type Exam,
} from "../lib/data.ts";
const exam = (grade: number, weight: number): Exam => ({
  id: crypto.randomUUID(),
  courseId: "c",
  name: "Exam",
  type: "Quiz",
  date: "2026-09-10",
  grade,
  maxGrade: 100,
  weight,
});
test("weighted grades normalize completed assessments and ignore zero weights", () => {
  assert.equal(weightedGrade([exam(80, 25), exam(100, 5)]), 2500 / 30);
  assert.equal(weightedGrade([exam(50, 0)]), null);
  assert.equal(weightedGrade([]), null);
});
test("historical day preserves recorded timezone, including crossing UTC midnight", () => {
  const s = { date: "2026-09-11T02:00:00Z", offset: 240 } as Session;
  assert.equal(localDay(s), "2026-09-10");
});
test("sparse data produces seven guarded insights without invented confidence", () => {
  const found = insights([], []);
  assert.equal(found.length, 7);
  assert.ok(found.every((i) => i.level === "Collecting data"));
  assert.ok(found.every((i) => i.n === 0));
});
test("import rejects orphan records and invalid ratings", () => {
  assert.throws(() =>
    dataSchema.parse({
      ...emptyData,
      sessions: [
        {
          id: "s",
          courseId: "missing",
          type: "Reading",
          date: "2026-09-10T10:00:00Z",
          offset: 0,
          duration: 20,
          rating: 6,
        },
      ],
    }),
  );
});
test("exam analysis excludes same-day and post-exam sessions", () => {
  const sessions: Session[] = Array.from({ length: 5 }, (_, i) => ({
    id: `s${i}`,
    courseId: "c",
    date: "2026-09-10T09:00:00Z",
    offset: 0,
    duration: 60,
    rating: 4,
    type: "Reading",
  }));
  const found = insights(sessions, [exam(90, 25)]);
  assert.equal(found.find((i) => i.title === "Distributed preparation")?.n, 0);
});
test("successive exams do not reuse earlier preparation", () => {
  const sessions: Session[] = [
    {
      id: "s",
      courseId: "c",
      date: "2026-09-08T09:00:00Z",
      offset: 0,
      duration: 60,
      rating: 4,
      type: "Reading",
    },
  ];
  const found = insights(sessions, [
    exam(90, 25),
    { ...exam(80, 25), date: "2026-09-12" },
  ]);
  assert.equal(found.find((i) => i.title === "Distributed preparation")?.n, 1);
});
test("schema rejects duplicate course IDs and grades above maximum", () => {
  const c = { id: "c", name: "Math", icon: "M", color: "#777777" };
  assert.throws(() => dataSchema.parse({ ...emptyData, courses: [c, c] }));
  assert.throws(() =>
    dataSchema.parse({ ...emptyData, courses: [c], exams: [exam(120, 25)] }),
  );
});
