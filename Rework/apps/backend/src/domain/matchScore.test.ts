import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatchScore } from "./matchScore.js";

test("sums the top 3 of 4 results, dropping the lowest", () => {
  assert.equal(computeMatchScore([382, 370, 360, 190]), 382 + 370 + 360);
});

test("uses all results when fewer than 3 are given", () => {
  assert.equal(computeMatchScore([100, 50]), 150);
});

test("returns 0 for no results", () => {
  assert.equal(computeMatchScore([]), 0);
});

test("does not mutate the input array", () => {
  const results = [10, 40, 30, 20];
  computeMatchScore(results);
  assert.deepEqual(results, [10, 40, 30, 20]);
});
