// Flags a reading as anomalous if it's an unusual spike relative to that
// station's own recent history — a simple but real statistical technique
// (z-score), not a hand-wavy threshold.
export function computeZScore(value: number, history: number[]): number {
  if (history.length < 5) return 0; // not enough history to judge yet

  const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
  const variance =
    history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// A z-score beyond this threshold gets flagged as an anomaly.
export const ANOMALY_Z_THRESHOLD = 3;
