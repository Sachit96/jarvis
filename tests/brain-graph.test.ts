import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBrainGraph,
  categoryOf,
  colorForCategory,
  focusTargetFor,
  searchBrain,
  ROOT_ID,
  FALLBACK_COLOR,
  type BrainEntry,
} from "../lib/voice/brain-graph.ts";

const entry = (p: Partial<BrainEntry> & { id: string; title: string }): BrainEntry => ({
  body: "",
  type: "fact",
  tags: [],
  pinned: false,
  ...p,
});

test("which cluster an entry lands in", async (t) => {
  await t.test("a known tag beats the row's type", () => {
    // Almost everything is a "fact"; "business" is the useful grouping.
    assert.equal(categoryOf(entry({ id: "1", title: "x", type: "fact", tags: ["business"] })), "business");
  });

  await t.test("falls back to the type when no tag is a known category", () => {
    assert.equal(categoryOf(entry({ id: "1", title: "x", type: "protocol", tags: ["misc"] })), "protocol");
  });

  await t.test("matches a tag regardless of case", () => {
    assert.equal(categoryOf(entry({ id: "1", title: "x", tags: ["Outreach"] })), "outreach");
  });

  await t.test("an entry with no type at all still lands somewhere", () => {
    assert.equal(categoryOf(entry({ id: "1", title: "x", type: "" })), "fact");
  });
});

test("graph shape", async (t) => {
  const entries = [
    entry({ id: "a", title: "Zapier", tags: ["tech"] }),
    entry({ id: "b", title: "Email Funnel", tags: ["outreach"] }),
    entry({ id: "c", title: "Cold call script", tags: ["outreach"], pinned: true }),
  ];

  await t.test("one root, one node per category, one per entry", () => {
    const g = buildBrainGraph(entries);
    assert.equal(g.nodes.filter((n) => n.kind === "root").length, 1);
    assert.equal(g.nodes.filter((n) => n.kind === "category").length, 2);
    assert.equal(g.nodes.filter((n) => n.kind === "entry").length, 3);
  });

  await t.test("every node except the root has exactly one parent link", () => {
    const g = buildBrainGraph(entries);
    const targets = g.links.map((l) => l.target);
    assert.equal(new Set(targets).size, targets.length, "a node is linked twice");
    assert.equal(g.links.length, g.nodes.length - 1, "hub-and-spoke, not a mesh");
  });

  await t.test("the busiest category leads the legend", () => {
    const g = buildBrainGraph(entries);
    assert.deepEqual(
      g.categories.map((c) => c.id),
      ["outreach", "tech"],
    );
  });

  await t.test("a pinned entry renders larger", () => {
    const g = buildBrainGraph(entries);
    const pinned = g.nodes.find((n) => n.id === "c")!;
    const plain = g.nodes.find((n) => n.id === "a")!;
    assert.ok(pinned.size > plain.size);
  });

  await t.test("an empty brain is a lone root, not a crash", () => {
    const g = buildBrainGraph([]);
    assert.deepEqual(g.nodes.map((n) => n.id), [ROOT_ID]);
    assert.deepEqual(g.links, []);
    assert.deepEqual(g.categories, []);
  });
});

test("category colours", async (t) => {
  await t.test("a known category keeps its colour whatever else exists", () => {
    // Keyed by id, not by index — otherwise adding a category recolours
    // the whole graph and every cluster appears to change meaning.
    assert.equal(colorForCategory("outreach"), colorForCategory("Outreach"));
    assert.notEqual(colorForCategory("outreach"), colorForCategory("tech"));
  });

  await t.test("an unknown category still gets a colour", () => {
    assert.equal(colorForCategory("something-new"), FALLBACK_COLOR);
  });
});

test("search", async (t) => {
  const g = buildBrainGraph([
    entry({ id: "a", title: "Zapier", tags: ["tech"], body: "automation glue" }),
    entry({ id: "b", title: "Email Funnel", tags: ["outreach"] }),
  ]);

  await t.test("an empty term matches everything", () => {
    assert.equal(searchBrain(g, "   ").size, g.nodes.length);
  });

  await t.test("matches the body, not only the title", () => {
    const hits = searchBrain(g, "automation");
    assert.ok(hits.has("a"));
    assert.ok(!hits.has("b"));
  });

  await t.test("a matched entry keeps its category and the root visible", () => {
    const hits = searchBrain(g, "zapier");
    assert.ok(hits.has("cat:tech"), "an orphaned hit has no visible path back");
    assert.ok(hits.has(ROOT_ID));
  });

  await t.test("no match returns nothing rather than everything", () => {
    assert.equal(searchBrain(g, "nothing-like-this").size, 0);
  });
});

test("camera focus", async (t) => {
  const g = buildBrainGraph([
    entry({ id: "a", title: "Email Funnel", tags: ["outreach"] }),
    entry({ id: "b", title: "Email", tags: ["tech"] }),
    entry({ id: "c", title: "ON RADAR", tags: ["business"] }),
  ]);

  await t.test("flies to the concept a sentence names", () => {
    assert.equal(focusTargetFor(g, "Let's look at your ON RADAR pipeline.")?.id, "c");
  });

  await t.test("prefers the longest matching label", () => {
    // "Email" is contained in the same sentence, but "Email Funnel" is
    // what was actually meant.
    assert.equal(focusTargetFor(g, "Your Email Funnel needs work.")?.id, "a");
  });

  await t.test("matches whole words only", () => {
    // "emails" must not fire the "Email" node.
    assert.equal(focusTargetFor(g, "I sent three emails."), null);
  });

  await t.test("says nothing rather than guessing", () => {
    assert.equal(focusTargetFor(g, "How are you today?"), null);
  });

  await t.test("punctuation around a label does not hide it", () => {
    assert.equal(focusTargetFor(g, "Checking: Email Funnel, then tasks.")?.id, "a");
  });
});
