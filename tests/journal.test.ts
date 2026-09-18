import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankJournal,
  entrySchema,
  journalSchema,
  sampleJournal,
  contextGroups,
  entryDay,
} from "../lib/journal.ts";
import { aiRequestSchema, validateEvidence } from "../lib/ai-contract.ts";
test("journal needs context, location, method, and reflection but not course or duration", () => {
  const base = { ...sampleJournal().entries[0], course: "", duration: null };
  assert.ok(entrySchema.safeParse(base).success);
  for (const field of ["context", "location", "reflection"])
    assert.equal(
      entrySchema.safeParse({ ...base, [field]: "   " }).success,
      false,
    );
  assert.equal(entrySchema.safeParse({ ...base, methods: [] }).success, false);
});
test("journal backups round trip and reject duplicate IDs", () => {
  const data = sampleJournal();
  assert.deepEqual(journalSchema.parse(JSON.parse(JSON.stringify(data))), data);
  assert.equal(
    journalSchema.safeParse({
      ...data,
      entries: [data.entries[0], data.entries[0]],
    }).success,
    false,
  );
});
test("custom multi-select methods and location are retained", () => {
  const e = {
    ...sampleJournal().entries[0],
    location: "Quiet lab",
    methods: ["Whiteboard sketches", "Peer discussion"],
  };
  const parsed = journalSchema.parse({ ...blankJournal, entries: [e] });
  assert.deepEqual(parsed.entries[0].methods, e.methods);
  assert.equal(contextGroups(parsed.entries, "methods").length, 2);
});
test("context grouping counts entries without making productivity claims", () => {
  const data = sampleJournal();
  const group = contextGroups(data.entries, "location").find(
    ([name]) => name === "Library",
  );
  assert.equal(group?.[1].length, 2);
  assert.ok(group?.[1].every((e) => e.location === "Library"));
});
test("journal date uses recorded timezone", () => {
  const e = {
    ...sampleJournal().entries[0],
    date: "2026-09-15T01:00:00Z",
    offset: 240,
  };
  assert.equal(entryDay(e), "2026-09-14");
});
test("AI evidence rejects references to entries not sent", () => {
  const value = {
    summary: "You described difficulty choosing a method.",
    question: "What helped?",
    nextStep: "Try explaining your choice.",
    evidenceIds: ["a"],
  };
  assert.deepEqual(validateEvidence(value, ["a"]), value);
  assert.throws(() => validateEvidence(value, ["b"]));
  assert.throws(() => validateEvidence({ ...value, evidenceIds: [] }, ["a"]));
});
test("AI requests require enough entries for patterns and bound input", () => {
  const entries = sampleJournal().entries;
  assert.ok(aiRequestSchema.safeParse({ mode: "patterns", entries }).success);
  assert.equal(
    aiRequestSchema.safeParse({
      mode: "patterns",
      entries: entries.slice(0, 2),
    }).success,
    false,
  );
  assert.equal(
    aiRequestSchema.safeParse({ mode: "entry", entries }).success,
    false,
  );
  assert.equal(
    aiRequestSchema.safeParse({
      mode: "entry",
      entries: [{ ...entries[0], reflection: "x".repeat(3001) }],
    }).success,
    false,
  );
});
