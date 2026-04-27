export type PregameStatus = "confirmed" | "downgraded" | "removed";

type SoccerPregamePick = {
  confidence: number;
  valuePriority: number;
  edge: number;
  marketSignal: number;
  sharpBooks: number;
  internalScore: number;
  closingDirection: "up" | "down" | "neutral";
  market: string;
};

export function evaluatePregamePick(pick: SoccerPregamePick): PregameStatus {
  // filtros duros
  if (pick.closingDirection === "down") {
  return "removed";
}

if (pick.market === "totals" && pick.edge < 1.5) {
  return "removed";
}

if (pick.market === "spreads" && pick.edge < 1.2) {
  return "removed";
}

if (pick.market === "ml") {
  if (pick.internalScore < 60) {
    return "removed";
  }
}

  // degradaciones
  if (pick.confidence < 60) {
    return "downgraded";
  }

  if (pick.valuePriority < 85) {
    return "downgraded";
  }

  if (pick.marketSignal < 60) {
    return "downgraded";
  }

  if (pick.sharpBooks === 0 && pick.market !== "ml") {
    return "downgraded";
  }

if (pick.market !== "ml" && pick.internalScore < 70) {
    return "removed";
  }

  return "confirmed";
}

export function evaluatePregamePool<T extends SoccerPregamePick>(pool: T[]) {
  return pool.map((pick) => ({
    ...pick,
    status: evaluatePregamePick(pick),
  }));
}