import { test } from "node:test";
import assert from "node:assert/strict";
import { isAgeGroup } from "./ageGroup.js";

test("accepts the two known age groups", () => {
  assert.ok(isAgeGroup("Schützenklasse"));
  assert.ok(isAgeGroup("Senioren"));
});

test("rejects anything else", () => {
  assert.ok(!isAgeGroup("Jugend"));
  assert.ok(!isAgeGroup(""));
  assert.ok(!isAgeGroup("SCHUETZENKLASSE"));
});
