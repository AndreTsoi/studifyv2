import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { reflectionSchema } from "@/lib/journal";
import {
  aiRequestSchema,
  systemPrompt,
  validateEvidence,
} from "@/lib/ai-contract";
export const runtime = "nodejs";
export const maxDuration = 45;
const configured = () =>
  Boolean(
    process.env.OPENAI_API_KEY &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN,
  );
export async function GET() {
  return NextResponse.json(
    { available: configured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function reserve(request: Request) {
  const day = new Date().toISOString().slice(0, 10);
  const ip = createHash("sha256")
    .update(
      (
        request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-forwarded-for") ||
        "local"
      ).split(",")[0] + day,
    )
    .digest("hex");
  const cap = Math.max(
    1,
    Math.min(10000, Number(process.env.AI_DAILY_LIMIT) || 100),
  );
  const script = `local total=tonumber(redis.call('GET',KEYS[1]) or '0'); local user=tonumber(redis.call('GET',KEYS[2]) or '0'); if total>=tonumber(ARGV[1]) or user>=10 then return 0 end; redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],172800); redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],172800); return 1`;
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      script,
      "2",
      `journal:budget:${day}`,
      `journal:visitor:${day}:${ip}`,
      String(cap),
    ]),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error("Budget unavailable");
  const value = await response.json();
  if (value.error) throw Error("Budget unavailable");
  return value.result === 1;
}
export async function POST(request: Request) {
  if (!configured())
    return NextResponse.json(
      {
        error:
          "AI reflection is not connected yet. Your entry is saved; you can write your own takeaway below.",
      },
      { status: 503 },
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 48000) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Choose fewer or shorter entries." },
          { status: 413 },
        );
      }
      parts.push(part.value);
    }
    const parsed = aiRequestSchema.safeParse(
      JSON.parse(Buffer.concat(parts).toString("utf8")),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the entries and try again." },
        { status: 400 },
      );
    if (!(await reserve(request)))
      return NextResponse.json(
        {
          error:
            "Today’s AI allowance has been reached. You can still save and reflect on your own.",
        },
        { status: 429 },
      );
    const payload = parsed.data;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        store: false,
        max_output_tokens: 1200,
        instructions: systemPrompt,
        input: JSON.stringify({
          mode: payload.mode,
          entries: payload.entries.map(
            ({
              id,
              context,
              course,
              location,
              methods,
              duration,
              reflection,
              reply,
              date,
              takeaway,
            }) => ({
              id,
              context,
              course,
              location,
              methods,
              duration,
              reflection,
              reply,
              date,
              takeaway,
            }),
          ),
        }),
        text: {
          format: {
            type: "json_schema",
            name: "study_reflection",
            strict: true,
            schema: z.toJSONSchema(reflectionSchema, { target: "draft-7" }),
          },
        },
      }),
    });
    if (!response.ok) throw Error();
    const result = await response.json();
    if (result.status !== "completed") throw Error();
    const text = result.output
      ?.flatMap(
        (o: { content?: { type: string; text?: string }[] }) => o.content || [],
      )
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text: string }) => c.text)
      .join("");
    const checked = validateEvidence(
      JSON.parse(text),
      payload.entries.map((e) => e.id),
    );
    return NextResponse.json(checked, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "AI reflection is unavailable right now. Your saved journal is safe; please try later.",
      },
      { status: 502 },
    );
  }
}
