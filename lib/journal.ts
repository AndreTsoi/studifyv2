import { z } from "zod";
const label = z.string().trim().min(1).max(100);
export const reflectionSchema = z.object({
  summary: z.string().min(1).max(1400),
  question: z.string().max(300),
  nextStep: z.string().max(400),
  evidenceIds: z.array(z.string().min(1).max(100)).min(1).max(12),
});
export const entrySchema = z.object({
  id: label,
  date: z.iso.datetime(),
  offset: z.number().int().min(-840).max(840),
  context: z.string().trim().min(1).max(200),
  course: z.string().trim().max(100),
  location: label,
  methods: z.array(label).min(1).max(10),
  duration: z.number().int().min(1).max(1440).nullable(),
  reflection: z.string().trim().min(1).max(3000),
  takeaway: z.string().max(1400),
  nextStep: z.string().max(400),
  due: z.union([z.iso.date(), z.literal("")]),
  done: z.boolean(),
  ai: reflectionSchema.nullable(),
  reply: z.string().max(1500),
});
export const journalSchema = z
  .object({
    version: z.literal(2),
    entries: z.array(entrySchema).max(5000),
    locations: z.array(label).max(100),
    methods: z.array(label).max(100),
    courses: z.array(label).max(100),
  })
  .superRefine((v, c) => {
    if (new Set(v.entries.map((e) => e.id)).size !== v.entries.length)
      c.addIssue({ code: "custom", message: "Duplicate entry IDs" });
  });
export type Entry = z.infer<typeof entrySchema>;
export type Journal = z.infer<typeof journalSchema>;
export type Reflection = z.infer<typeof reflectionSchema>;
export const JOURNAL_KEY = "study-journal.v2";
export const blankJournal: Journal = {
  version: 2,
  entries: [],
  locations: [
    "Library",
    "Home",
    "Café",
    "Campus",
    "Other",
    "Prefer not to say",
  ],
  methods: [
    "Reading",
    "Practice problems",
    "Flashcards",
    "Watching lectures",
    "Teaching / explaining",
    "Taking notes",
  ],
  courses: [],
};
export function entryDay(e: Entry) {
  return new Date(Date.parse(e.date) - e.offset * 60000)
    .toISOString()
    .slice(0, 10);
}
export function sampleJournal(): Journal {
  const samples = [
    [
      "Understanding integration by parts",
      "Calculus II",
      "Library",
      ["Practice problems"],
      "I worked through three examples. Choosing which term to differentiate was the hardest part. Talking through the steps helped.",
      "Try choosing u and dv before solving a full problem.",
    ],
    [
      "Connecting memory concepts",
      "Psychology",
      "Home",
      ["Reading", "Taking notes"],
      "I finished the chapter but kept switching tabs. Drawing a small concept map helped me connect the terms.",
      "Start with a concept map next time.",
    ],
    [
      "Tracing recursive functions",
      "Computer Science",
      "Library",
      ["Teaching / explaining"],
      "Explaining the call stack out loud helped me find where I was getting confused. I can trace a small example now.",
      "Trace a slightly larger example without notes.",
    ],
  ] as const;
  return {
    ...blankJournal,
    courses: ["Calculus II", "Psychology", "Computer Science"],
    entries: samples.map((s, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        id: `sample-${i}`,
        date: d.toISOString(),
        offset: d.getTimezoneOffset(),
        context: s[0],
        course: s[1],
        location: s[2],
        methods: [...s[3]],
        duration: [40, 60, 35][i],
        reflection: s[4],
        takeaway: "",
        nextStep: s[5],
        due: "",
        done: false,
        ai: null,
        reply: "",
      };
    }),
  };
}
export function contextGroups(entries: Entry[], field: "location" | "methods") {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    for (const key of field === "location" ? [e.location] : e.methods)
      groups.set(key, [...(groups.get(key) || []), e]);
  }
  return [...groups].sort((a, b) => b[1].length - a[1].length);
}
