/**
 * Tests for the v2 ISO-week helpers.
 * Run: node --import tsx test/v2-week.test.mts
 */
const week = await import("../src/lib/v2/week.ts");

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `(got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

const WED = new Date("2026-11-25T15:30:00Z");

console.log("[1] Week ids");
{
  eq("a Wednesday in late November is week 48", week.weekIdOf(WED), "2026-W48");
  eq("Monday 00:00 belongs to its own week", week.weekIdOf(new Date("2026-11-23T00:00:00Z")), "2026-W48");
  eq("Sunday 23:59 still belongs to the week", week.weekIdOf(new Date("2026-11-29T23:59:59Z")), "2026-W48");
  eq("1 Jan 2026 (a Thursday) is week 1 of 2026", week.weekIdOf("2026-01-01"), "2026-W01");
  eq("1 Jan 2027 (a Friday) is week 53 of 2026", week.weekIdOf("2027-01-01"), "2026-W53");
  eq("3 Jan 2021 (a Sunday) is week 53 of 2020", week.weekIdOf("2021-01-03"), "2020-W53");
  eq("29 Dec 2025 (a Monday) is week 1 of 2026", week.weekIdOf("2025-12-29"), "2026-W01");
  eq("2026 has 53 ISO weeks", week.weeksInYear(2026), 53);
  eq("2025 has 52 ISO weeks", week.weeksInYear(2025), 52);
}

console.log("[2] Parsing and validation");
{
  eq("parses a valid id", week.parseWeekId("2026-W48"), { year: 2026, week: 48 });
  ok("rejects week 0", !week.isWeekId("2026-W00"));
  ok("rejects week 53 in a 52-week year", !week.isWeekId("2025-W53"));
  ok("accepts week 53 in a 53-week year", week.isWeekId("2026-W53"));
  ok("rejects a lowercase w", !week.isWeekId("2026-w48"));
  ok("rejects a single-digit week", !week.isWeekId("2026-W8"));
  ok("rejects garbage", !week.isWeekId("next week"));
  let threw = false;
  try {
    week.weekStart("2026-W99");
  } catch {
    threw = true;
  }
  ok("weekStart throws on an invalid id", threw);
}

console.log("[3] Bounds, close and freeze");
{
  eq("week 48 starts Monday 23 Nov", week.weekStart("2026-W48"), "2026-11-23");
  eq("week 48 ends Sunday 29 Nov", week.weekEnd("2026-W48"), "2026-11-29");
  eq("week 1 of 2026 starts in 2025", week.weekStart("2026-W01"), "2025-12-29");
  eq("seven dates, Monday first", week.weekDates("2026-W48"), [
    "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29",
  ]);
  eq("closes the next Monday at 00:00 UTC", week.closesAt("2026-W48"), "2026-11-30T00:00:00.000Z");
  eq("freezes 12 hours after closing", week.freezesAt("2026-W48"), "2026-11-30T12:00:00.000Z");
  ok("open on Sunday night", !week.isClosed("2026-W48", new Date("2026-11-29T23:59:59Z")));
  ok("closed at Monday 00:00", week.isClosed("2026-W48", new Date("2026-11-30T00:00:00Z")));
  ok("not frozen inside the grace period", !week.isFrozen("2026-W48", new Date("2026-11-30T11:59:59Z")));
  ok("frozen once the grace period ends", week.isFrozen("2026-W48", new Date("2026-11-30T12:00:00Z")));
  ok("next week is in the future", week.isFutureWeek("2026-W49", WED));
  ok("this week is not in the future", !week.isFutureWeek("2026-W48", WED));
  eq("previous week across a year boundary", week.previousWeekId("2026-W01"), "2025-W52");
  eq("previous week of 2027-W01 is 2026-W53", week.previousWeekId("2027-W01"), "2026-W53");
}

console.log("[4] WeekRef and day index");
{
  eq("current week ref", week.currentWeek(WED), {
    id: "2026-W48",
    start: "2026-11-23",
    end: "2026-11-29",
    day: 3,
    closesAt: "2026-11-30T00:00:00.000Z",
    closed: false,
  });
  const closed = week.weekRef("2026-W47", WED);
  eq("a closed week reports day 7", [closed.day, closed.closed], [7, true]);
  eq("Monday is day 1", week.dayOfWeek("2026-W48", "2026-11-23"), 1);
  eq("Sunday is day 7", week.dayOfWeek("2026-W48", "2026-11-29"), 7);
  eq("a date outside the week is 0", week.dayOfWeek("2026-W48", "2026-11-30"), 0);
}

console.log("[5] Other windows");
{
  eq("month to date", week.monthWindow(WED), { from: "2026-11-01", to: "2026-11-25", days: 25 });
  eq("rolling 7 days include today", week.rollingWindow(7, WED), { from: "2026-11-19", to: "2026-11-25" });
  ok("an impossible date does not parse", Number.isNaN(week.parseIsoDate("2026-02-31").getTime()));
  eq("addDays crosses a month", week.addDays("2026-11-29", 3), "2026-12-02");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
