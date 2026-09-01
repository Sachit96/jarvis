import "server-only";
import { callGemini, stripMarkdownFence, type GeminiPart } from "@/lib/ai/providers/gemini-client";
import {
  syllabusParseResultSchema,
  SYLLABUS_RESPONSE_SCHEMA,
  assignmentBreakdownResultSchema,
  ASSIGNMENT_BREAKDOWN_RESPONSE_SCHEMA,
  type SyllabusParseResult,
  type AssignmentBreakdownResult,
} from "@/lib/validations/uni-parse";

// Both functions here use the "structured" tier (gemini-3.5-flash-lite),
// not "high_volume" — same reasoning as the lead qualifier: these are
// nested, enum-bearing schemas (assessments[].type is an enum,
// scheduleBlocks[] nests multiple enum/nullable fields), the exact shape
// Gemma tested unreliable on. This is a low-frequency, user-initiated
// action (one syllabus per course, one assignment breakdown per
// assessment) — nowhere near enough volume to threaten the 500/day budget.

const SYLLABUS_SYSTEM_INSTRUCTION = `You extract structured data from a university course syllabus (PDF or pasted text). Be conservative — only extract what the syllabus actually states.

Hard rules:
- Never invent a due date, weight, or schedule time that isn't in the source. If a value isn't stated, use null for that field rather than guessing.
- If a chunk of the syllabus is clearly relevant (e.g. a grading policy, a late-penalty rule, an assessment you can't confidently parse into the structured fields) but you can't extract it cleanly, put a short plain-English description of it into "unparsed" instead of silently dropping it or forcing a bad guess into a structured field.
- due_date must be YYYY-MM-DD. If the syllabus gives a date without a year, infer the year from context (e.g. the term) if possible; otherwise put it in "unparsed" instead of guessing wrong.
- weight_pct is a plain number like 15 for "15%", not a string.
- day_of_week is 0=Sunday through 6=Saturday, matching the day names in the source.
- keyPolicies should be short, specific statements (e.g. "Late submissions lose 10% per day"), not the full policy paragraph verbatim.`;

const ASSIGNMENT_BREAKDOWN_SYSTEM_INSTRUCTION = `You break down a university assignment's instructions into a concrete checklist and a multi-day study plan.

Hard rules:
- requirements: a checklist of concrete, gradeable deliverables mentioned in the instructions (e.g. "Include a literature review of at least 5 sources", "Submit as a PDF"). Don't invent requirements the instructions don't state.
- estimatedHours: your best-effort total hours to complete this, based on its scope — null only if the instructions give you nothing to estimate from.
- studyPlan: a realistic multi-day plan using the "available hours" and "days until due" given in the prompt, spreading the estimated work across the available days rather than cramming it all into one session unless there's genuinely only one day available. dayOffset 0 means today.
- unparsed: anything in the instructions you couldn't confidently turn into a requirement or plan item (e.g. an ambiguous rubric note) — report it rather than guessing or dropping it.`;

export async function parseSyllabus(input: { text?: string; fileBase64?: string; fileMimeType?: string }): Promise<SyllabusParseResult> {
  const parts: GeminiPart[] = [];
  if (input.fileBase64 && input.fileMimeType) {
    parts.push({ inlineData: { mimeType: input.fileMimeType, data: input.fileBase64 } });
    parts.push({ text: "Extract this syllabus's structured data." });
  } else if (input.text) {
    parts.push({ text: `Extract this syllabus's structured data:\n\n${input.text}` });
  } else {
    throw new Error("parseSyllabus needs either text or a file");
  }

  const { text } = await callGemini({
    tier: "structured",
    systemInstruction: SYLLABUS_SYSTEM_INSTRUCTION,
    contents: [{ role: "user", parts }],
    responseSchema: SYLLABUS_RESPONSE_SCHEMA,
    temperature: 0.2,
  });
  if (!text) throw new Error("Gemini returned no content for the syllabus parse");

  const parsed = JSON.parse(stripMarkdownFence(text));
  const result = syllabusParseResultSchema.safeParse(parsed);
  if (!result.success) throw new Error(`Syllabus parse failed schema validation: ${result.error.message}`);
  return result.data;
}

export async function parseAssignmentInstructions(
  instructions: string,
  context: { assessmentTitle: string; availableHours: number; daysUntilDue: number | null },
): Promise<AssignmentBreakdownResult> {
  const prompt = [
    `Assignment: ${context.assessmentTitle}`,
    `Days until due: ${context.daysUntilDue ?? "unknown — no due date set"}`,
    `Hours the student has told you they have available in total for this: ${context.availableHours}`,
    "",
    "Instructions:",
    instructions,
  ].join("\n");

  const { text } = await callGemini({
    tier: "structured",
    systemInstruction: ASSIGNMENT_BREAKDOWN_SYSTEM_INSTRUCTION,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    responseSchema: ASSIGNMENT_BREAKDOWN_RESPONSE_SCHEMA,
    temperature: 0.3,
  });
  if (!text) throw new Error("Gemini returned no content for the assignment breakdown");

  const parsed = JSON.parse(stripMarkdownFence(text));
  const result = assignmentBreakdownResultSchema.safeParse(parsed);
  if (!result.success) throw new Error(`Assignment breakdown failed schema validation: ${result.error.message}`);
  return result.data;
}

// ==================================================== Flashcards

const FLASHCARD_SYSTEM_INSTRUCTION = `You write flashcards from course material. Output PLAIN TEXT ONLY, no markdown, no JSON — exactly this repeated format, one pair per flashcard, nothing else:
Q: <question>
A: <answer>

Rules:
- Base every card only on the material given — never invent facts not in it.
- Questions should test understanding (a definition, a relationship, a "why"), not just ask the reader to recite a random sentence.
- Answers should be concise — one to three sentences.`;

/** Gemma "high_volume" tier — plain text, no responseSchema, parsed by a simple Q:/A: line scan rather than forcing structured output the way syllabus parsing does; flashcards are low-stakes study aids, not something that needs the structured tier's reliability. */
export async function generateFlashcards(materialBody: string, count = 8): Promise<{ question: string; answer: string }[]> {
  const { text } = await callGemini({
    tier: "high_volume",
    systemInstruction: FLASHCARD_SYSTEM_INSTRUCTION,
    contents: [{ role: "user", parts: [{ text: `Write ${count} flashcards from this material:\n\n${materialBody.slice(0, 12_000)}` }] }],
    temperature: 0.4,
  });
  if (!text) return [];

  const cards: { question: string; answer: string }[] = [];
  const lines = text.split("\n");
  let pendingQ: string | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("Q:")) {
      pendingQ = line.slice(2).trim();
    } else if (line.startsWith("A:") && pendingQ) {
      cards.push({ question: pendingQ, answer: line.slice(2).trim() });
      pendingQ = null;
    }
  }
  return cards;
}
