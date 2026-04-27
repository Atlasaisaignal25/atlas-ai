export type PregameStatus = "confirmed" | "downgraded" | "removed";

type MlbPregamePick = {
  confidence: number;
  valuePriority: number;
  edge: number;
  marketSignal: number;
  sharpBooks: number;
  internalScore: number;
  closingDirection: "up" | "down" | "neutral";
  market: string;
  sharpConsensus?: number;
  marketPressure?: number;
  closingProjection?: number;
  fakeValue?: boolean;
  odds?: number;
};

export function evaluatePregamePick(pick: MlbPregamePick): PregameStatus {
  const odds = Number(pick.odds);

  if (pick.fakeValue) {
    return "removed";
  }

  if (Number.isFinite(odds) && (odds < -150 || odds > 140)) {
    return "removed";
  }

  // 🔴 REMOVED solo si el mercado va en contra Y no hay soporte real
if (
  pick.closingDirection === "down" &&
  (pick.marketPressure ?? 50) < 55 &&
  (pick.sharpConsensus ?? 0) < 60
) {
  return "removed";
}

// 🟢 CONFIRMED si el mercado va a favor
if (pick.closingDirection === "up") {
  return "confirmed";
}

  if (pick.market === "totals" && pick.edge < 1.2) {
    return "removed";
  }

  if (pick.market === "ml" && pick.internalScore < 55) {
    return "removed";
  }

  if (pick.market === "spreads" && pick.internalScore < 55) {
    return "removed";
  }

  if (pick.confidence < 58) {
    return "downgraded";
  }

  if (pick.valuePriority < 80) {
    return "downgraded";
  }

  if (pick.marketSignal < 55) {
    return "downgraded";
  }

  if (pick.sharpBooks === 0 && pick.market !== "ml") {
    return "downgraded";
  }

  if ((pick.marketPressure ?? 50) < 45) {
    return "downgraded";
  }

  if ((pick.closingProjection ?? 50) < 45) {
    return "downgraded";
  }

  return "confirmed";
}

export function evaluatePregamePool<T extends MlbPregamePick>(pool: T[]) {
  return pool.map((pick) => ({
    ...pick,
    status: evaluatePregamePick(pick),
  }));
}