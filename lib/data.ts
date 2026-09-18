import { z } from "zod";
const id = z.string().min(1).max(100),
  label = z.string().trim().min(1).max(100);
export const courseSchema = z.object({
  id,
  name: label,
  icon: z.string().max(12),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export const sessionSchema = z.object({
  id,
  courseId: id,
  type: label,
  duration: z.number().int().min(1).max(1440),
  rating: z.number().int().min(1).max(5),
  date: z.iso.datetime(),
  offset: z.number().int().min(-840).max(840),
});
export const examSchema = z
  .object({
    id,
    courseId: id,
    name: label,
    type: label,
    grade: z.number().min(0),
    maxGrade: z.number().positive(),
    weight: z.number().min(0).max(100),
    date: z.iso.date(),
  })
  .refine((e) => e.grade <= e.maxGrade, "Grade cannot exceed maximum");
export const dataSchema = z
  .object({
    version: z.literal(1),
    courses: z.array(courseSchema).max(100),
    sessions: z.array(sessionSchema).max(20000),
    exams: z.array(examSchema).max(5000),
    goal: z.number().min(1).max(100),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.courses.map((c) => c.id));
    for (const list of [d.courses, d.sessions, d.exams])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        ctx.addIssue({ code: "custom", message: "Duplicate IDs" });
    if ([...d.sessions, ...d.exams].some((x) => !ids.has(x.courseId)))
      ctx.addIssue({ code: "custom", message: "Unknown course" });
  });
export type StudyData = z.infer<typeof dataSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Exam = z.infer<typeof examSchema>;
export const emptyData: StudyData = {
  version: 1,
  courses: [],
  sessions: [],
  exams: [],
  goal: 10,
};
export const KEY = "study-analyzer.v1";
export const types = [
  "Active recall",
  "Practice problems",
  "Spaced repetition",
  "Reading",
  "Lecture review",
];
export function localDay(s: Session) {
  return new Date(new Date(s.date).getTime() - s.offset * 60000)
    .toISOString()
    .slice(0, 10);
}
export function demoData(): StudyData {
  const courses = [
    { id: "c1", name: "Computer Science", icon: "⌘", color: "#6261d9" },
    { id: "c2", name: "Calculus II", icon: "∑", color: "#e2a25b" },
    { id: "c3", name: "Cognitive Psychology", icon: "✳", color: "#4e9f88" },
  ];
  const sessions: Session[] = Array.from({ length: 72 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(i / 2));
    d.setHours(9 + (i % 3) * 4, 0, 0, 0);
    return {
      id: `s${i}`,
      courseId: courses[i % 3].id,
      type: types[i % 5],
      duration: [45, 60, 30, 75, 50, 90, 40][i % 7],
      rating: [4, 5, 3, 4, 5, 4, 4][i % 7],
      date: d.toISOString(),
      offset: d.getTimezoneOffset(),
    };
  });
  return {
    version: 1,
    courses,
    sessions,
    exams: courses.flatMap((c, i) =>
      [14, 2].map((days, j) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return {
          id: `e${i}${j}`,
          courseId: c.id,
          name: j ? "Chapter quiz" : "Midterm",
          type: j ? "Quiz" : "Midterm",
          grade: 80 + i * 4 + j * 3,
          maxGrade: 100,
          weight: j ? 5 : 25,
          date: d.toLocaleDateString("en-CA"),
        };
      }),
    ),
    goal: 10,
  };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
