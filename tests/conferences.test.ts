import test from "node:test";
import assert from "node:assert/strict";
import { blankCard } from "../src/model.ts";
import {
  conferenceGroups,
  sanitizeConference,
  blankConference,
} from "../src/conference-model.ts";
test("legacy event contacts and empty conferences group without changing contact data", () => {
  const a = { ...blankCard(), name: "A", event: "  Arctic Circle 2026  " },
    b = { ...blankCard(), name: "B", event: "Arctic Circle 2026" },
    c = { ...blankCard(), name: "C" };
  const groups = conferenceGroups(
    [a, b, c],
    [
      { ...blankConference("Arctic Circle 2026"), notes: "Summary" },
      blankConference("Future event"),
    ],
  );
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].contacts, [a, b]);
  assert.equal(groups[0].conference.notes, "Summary");
  assert.equal(groups[1].contacts.length, 0);
  assert.equal(a.event, "  Arctic Circle 2026  ");
});
test("conference validation drops arbitrary fields and impossible dates", () => {
  const c = sanitizeConference({
    name: " Conference ",
    notes: "private",
    completed: "true",
    date: "2026-02-30",
    follow_up: "2026-11-01",
    id: "override",
    extra: "value",
  });
  assert.equal(c.name, "Conference");
  assert.equal(c.completed, false);
  assert.equal(c.date, "");
  assert.equal(c.follow_up, "2026-11-01");
  assert.ok(!("id" in c));
  assert.ok(!("extra" in c));
});
