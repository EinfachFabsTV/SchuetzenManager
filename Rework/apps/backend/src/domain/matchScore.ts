// Mirrors Match.java#score(): only the top 3 of the 4 primary shoots count
// toward the match result. Additional/substitute shoots never contribute.
export function computeMatchScore(results: number[]): number {
  return [...results]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, r) => sum + r, 0);
}
