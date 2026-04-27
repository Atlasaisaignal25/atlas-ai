export type MlbMarket = "ml" | "totals" | "spreads";

export type MlbCandidate = {
  market: MlbMarket;
  pick: string;
  line?: number;
  odds: number;
  decimal: number;
  confidence: number;
  valuePriority: number;
  edge: number;
  score: number;
  internalScore: number;
  sharpBooks: number;
  marketSignal: number;
  closingDirection: "up" | "down" | "neutral";
  fakeValue: boolean;
  rlmSignal: "none" | "mild_rlm" | "strong_rlm" | "against";
  sharpConsensus: number;
  closingProjection: number;
  marketDisagreement: number;
  outlierScore: number;
  marketPressure: number;
  gameId: string;
  teams: string;
  startTime: string;
  status?: string;
};

export type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

export type OddsApiMarket = {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
};

export type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
};

export type OddsApiMlbGame = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export function americanToDecimal(odds: number): number {
  if (odds > 0) return 1 + odds / 100;
  return 1 + 100 / Math.abs(odds);
}

export function isHalfLine(value: number) {
  return Math.abs(value % 1) === 0.5;
}

export function isValidMlbLine(market: MlbMarket, line?: number) {
  if (market === "ml") return true;
  if (line === undefined || line === null) return false;
  return isHalfLine(line);
}

export const sharpBookKeys = [
  "pinnacle",
  "cris",
  "circa",
  "betonlineag",
  "lowvig",
];

export function isSharpBook(bookmakerKey: string) {
  return sharpBookKeys.includes(bookmakerKey);
}

export function getBookmakerMarkets(
  game: OddsApiMlbGame,
  marketKey: string
) {
  const markets: Array<{
    bookmaker: string;
    bookmakerKey: string;
    outcome: OddsApiOutcome;
    marketKey: string;
  }> = [];

  for (const bookmaker of game.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      if (market.key !== marketKey) continue;

      for (const outcome of market.outcomes ?? []) {
        markets.push({
          bookmaker: bookmaker.title,
          bookmakerKey: bookmaker.key,
          outcome,
          marketKey,
        });
      }
    }
  }

  return markets;
}

export function getConsensusLine(lines: number[]) {
  if (!lines.length) return null;

  const sorted = [...lines].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

export function extractTotalLines(game: OddsApiMlbGame) {
  const lines: number[] = [];

  for (const bookmaker of game.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      if (market.key !== "totals") continue;

      for (const outcome of market.outcomes ?? []) {
        if (outcome.point !== undefined && isHalfLine(outcome.point)) {
          lines.push(outcome.point);
        }
      }
    }
  }

  return lines;
}

export function getConsensusTotalLine(game: OddsApiMlbGame) {
  return getConsensusLine(extractTotalLines(game));
}

export function calculateLineEdge(
  line: number,
  consensus: number | null,
  odds: number
) {
  if (consensus === null) return 0;

  let edge = 0;
  const diff = consensus - line;

  if (diff > 0) {
    edge += diff * 10;
  }

  if (odds > 0) {
    edge += Math.min(10, odds / 50);
  }

  if (diff < 0) {
    edge -= Math.abs(diff) * 12;
  }

  return Math.max(0, edge);
}

export function detectReverseLineMovement(
  currentLine: number,
  consensus: number | null,
  odds: number
) {
  if (consensus === null) return "none" as const;

  if (currentLine < consensus && odds > 0) {
    return "mild_rlm" as const;
  }

  if (currentLine < consensus && odds >= -110 && odds <= 120) {
    return "strong_rlm" as const;
  }

  if (currentLine > consensus) {
    return "against" as const;
  }

  return "none" as const;
}

export function getClosingDirection(line: number, consensus: number | null) {
  if (consensus === null) return "neutral" as const;

  if (line < consensus) return "up" as const;
  if (line > consensus) return "down" as const;

  return "neutral" as const;
}

export function countSharpBooksForMarket(
  game: OddsApiMlbGame,
  marketKey: string,
  targetPoint?: number
) {
  let count = 0;

  for (const bookmaker of game.bookmakers ?? []) {
    if (!isSharpBook(bookmaker.key)) continue;

    for (const market of bookmaker.markets ?? []) {
      if (market.key !== marketKey) continue;

      const hasMatchingOutcome = market.outcomes.some((outcome) => {
        if (targetPoint === undefined) return true;
        return outcome.point === targetPoint;
      });

      if (hasMatchingOutcome) {
        count++;
        break;
      }
    }
  }

  return count;
}

export function getSharpConsensusScore(
  game: OddsApiMlbGame,
  market: MlbMarket,
  line?: number
) {
  let sharpMatches = 0;
  let sharpTotal = 0;

  for (const bookmaker of game.bookmakers ?? []) {
    if (!isSharpBook(bookmaker.key)) continue;

    sharpTotal++;

    for (const m of bookmaker.markets ?? []) {
      if (market === "ml" && m.key !== "h2h") continue;
      if (market === "totals" && m.key !== "totals") continue;

      const hasMatch = m.outcomes.some((outcome) => {
        if (market === "ml") return true;
        return line !== undefined && outcome.point === line;
      });

      if (hasMatch) {
        sharpMatches++;
        break;
      }
    }
  }

  if (sharpTotal === 0) return 0;

  return (sharpMatches / sharpTotal) * 100;
}

export function getClosingProjectionScore(
  market: MlbMarket,
  line: number | undefined,
  consensus: number | null,
  edge: number,
  sharpConsensus: number
) {
  if (market === "ml") {
    let score = 50;
    score += edge * 2;
    score += sharpConsensus * 0.15;
    return Math.max(0, Math.min(100, score));
  }

  if (line === undefined || consensus === null) {
    return 50;
  }

  let score = 50;

  if (line < consensus) {
    score += 15;
  } else if (line > consensus) {
    score -= 15;
  }

  score += edge * 2;
  score += sharpConsensus * 0.15;

  return Math.max(0, Math.min(100, score));
}

export function getMarketDisagreementScore(
  game: OddsApiMlbGame,
  market: MlbMarket,
  line?: number
) {
  const values: number[] = [];

  for (const bookmaker of game.bookmakers ?? []) {
    for (const m of bookmaker.markets ?? []) {
      if (market === "ml" && m.key !== "h2h") continue;
      if (market === "totals" && m.key !== "totals") continue;

      for (const outcome of m.outcomes ?? []) {
        if (market === "totals") {
          if (line !== undefined && outcome.point === line) {
            values.push(outcome.price);
          }
        } else {
          values.push(outcome.price);
        }
      }
    }
  }

  if (values.length < 2) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  return Math.min(100, stdDev * 2);
}

export function getOutlierScore(
  game: OddsApiMlbGame,
  market: MlbMarket,
  line: number | undefined,
  odds: number
) {
  const values: number[] = [];

  for (const bookmaker of game.bookmakers ?? []) {
    for (const m of bookmaker.markets ?? []) {
      if (market === "ml" && m.key !== "h2h") continue;
      if (market === "totals" && m.key !== "totals") continue;

      for (const outcome of m.outcomes ?? []) {
        if (market === "totals") {
          if (line !== undefined && outcome.point === line) {
            values.push(outcome.price);
          }
        } else {
          values.push(outcome.price);
        }
      }
    }
  }

  if (values.length < 2) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const diff = Math.abs(odds - avg);

  return Math.min(100, diff);
}

export function getMarketPressureScore(
  edge: number,
  sharpConsensus: number,
  closingProjection: number
) {
  let score = 50;

  score += edge * 1.5;
  score += sharpConsensus * 0.2;
  score += (closingProjection - 50) * 0.5;

  return Math.max(0, Math.min(100, score));
}

export function getAllH2HOutcomes(game: OddsApiMlbGame) {
  return getBookmakerMarkets(game, "h2h").filter((item) => {
    const name = String(item.outcome.name ?? "").trim();
    return name === game.home_team || name === game.away_team;
  });
}

export function getBestTotalAtConsensus(game: OddsApiMlbGame) {
  const consensus = getConsensusTotalLine(game);

  if (consensus === null) return null;

  const outcomes = getBookmakerMarkets(game, "totals").filter(
    (item) => item.outcome.point !== undefined
  );

  if (!outcomes.length) return null;

  const preferredLines = outcomes.filter(
    (item) => item.outcome.point! <= consensus
  );

  const poolToUse = preferredLines.length ? preferredLines : outcomes;

  let best = poolToUse[0];

  for (const current of poolToUse) {
    const currentPoint = current.outcome.point!;
    const bestPoint = best.outcome.point!;

    if (currentPoint < bestPoint) {
      best = current;
      continue;
    }

    if (
      currentPoint === bestPoint &&
      current.outcome.price > best.outcome.price
    ) {
      best = current;
    }
  }

  return {
    consensus,
    best,
  };
}

export function buildCandidate(
  game: OddsApiMlbGame,
  market: MlbMarket,
  pick: string,
  odds: number,
  line?: number
): MlbCandidate | null {
  if (!isValidMlbLine(market, line)) return null;

  const decimal = americanToDecimal(odds);

  let sharpBooks = 0;

  if (market === "totals" && line !== undefined) {
    sharpBooks = countSharpBooksForMarket(game, "totals", line);
  } else if (market === "spreads" && line !== undefined) {
    sharpBooks = countSharpBooksForMarket(game, "spreads", line);
  } else if (market === "ml") {
    sharpBooks = countSharpBooksForMarket(game, "h2h");
  }

  let marketSignal = 50 + sharpBooks * 10;
  marketSignal = Math.max(50, Math.min(100, marketSignal));

  const sharpConsensus = getSharpConsensusScore(game, market, line);
  const marketDisagreement = getMarketDisagreementScore(game, market, line);
  const outlierScore = getOutlierScore(game, market, line, odds);

  let closingDirection: "up" | "down" | "neutral" = "neutral";

  if (market === "totals" && line !== undefined) {
    const consensus = getConsensusTotalLine(game);
    closingDirection = getClosingDirection(line, consensus);
  }

  let rlmSignal: "none" | "mild_rlm" | "strong_rlm" | "against" = "none";

  if (market === "totals" && line !== undefined) {
    const consensus = getConsensusTotalLine(game);
    rlmSignal = detectReverseLineMovement(line, consensus, odds);
  }

  let edge = 0;

  if (market === "totals" && line !== undefined) {
    const consensus = getConsensusTotalLine(game);
    edge = calculateLineEdge(line, consensus, odds);
  }

  if (market === "totals" && edge < 0.5) {
    return null;
  }

  if (market === "totals") {
    if (sharpBooks >= 2) edge += 1.5;
    if (sharpConsensus >= 60) edge += 1;
  }

  if (market === "spreads") {
    if (line !== undefined && line > 0) {
      edge = 3.8;
    } else {
      edge = 2.6;
    }

    if (odds >= -150 && odds <= 140) edge += 1.2;
    if (sharpBooks >= 2) edge += 1.2;
    if (sharpConsensus >= 60) edge += 0.8;
    if (odds < -150 || odds > 140) edge -= 2;
    edge = Math.max(0, edge);
  }

  if (market === "ml") {
    if (odds > 0) {
      edge = Math.min(5, odds / 70);

      if (odds > 130) edge -= 1.2;
      if (odds > 150) edge -= 2;
      if (sharpBooks <= 1) edge -= 1;
    } else {
      if (odds >= -115) edge = 3.6;
      else if (odds >= -130) edge = 3.2;
      else if (odds >= -145) edge = 2.7;
      else if (odds >= -160) edge = 2;
      else if (odds >= -175) edge = 1.3;
      else if (odds >= -200) edge = 0.7;
      else edge = 0;

      if (sharpBooks >= 2) edge += 0.7;
      if (sharpBooks === 0 && odds < -150) edge -= 2;
    }

    edge += sharpBooks * 0.35;

    if (sharpConsensus >= 60) {
      edge += 0.5;
    }

    edge = Math.max(0, edge);
  }

  const closingProjection =
    market === "totals"
      ? getClosingProjectionScore(
          market,
          line,
          getConsensusTotalLine(game),
          edge,
          sharpConsensus
        )
      : getClosingProjectionScore(
          market,
          undefined,
          null,
          edge,
          sharpConsensus
        );

  let valuePriority = 80;
  let confidence = 75;

  if (market === "totals") {
    valuePriority += 4;
    confidence += 3;

    const pickName = String(pick).toLowerCase();

    if (pickName.includes("over")) {
      valuePriority += 7;
      confidence += 5;
      edge += 1;
    }

    if (pickName.includes("under")) {
      valuePriority -= 3;
      confidence -= 2;
    }
  }

  if (market === "spreads") {
    valuePriority += 5;
    confidence += 4;

    if (line !== undefined && line > 0) {
      valuePriority += 4;
      confidence += 3;
    }

    if (odds < -150 || odds > 140) {
      valuePriority -= 12;
      confidence -= 8;
    }
  }

  if (odds >= 120 && odds <= 140) valuePriority += 8;
  if (odds > 140) valuePriority -= 10;
  if (odds >= -150 && odds <= -110) valuePriority += 7;
  if (odds < -150) valuePriority -= 12;
  if (odds < -200) valuePriority -= 18;

  valuePriority += edge * 5;
  valuePriority += sharpBooks * 2;

  if (odds < -150) confidence -= 8;
  if (odds > 140) confidence -= 8;
  if (odds >= -150 && odds <= 140) confidence += 7;

  confidence += edge * 3.5;
  confidence += sharpBooks * 1.5;

  if (closingDirection === "up") {
    confidence += 8;
    marketSignal += 12;
  }

  if (closingDirection === "down") {
    confidence -= 12;
    marketSignal -= 15;
  }

  let fakeValue = false;

  if (market === "ml") {
    if (odds > 0 && sharpBooks === 0) fakeValue = true;
    if (odds > 140) fakeValue = true;
    if (odds < -150 && edge < 2.5) fakeValue = true;
    if (edge < 3 && sharpBooks <= 1) fakeValue = true;
  }

  if (market === "spreads") {
    if (odds < -150 || odds > 140) fakeValue = true;
    if (sharpBooks === 0 && edge < 3) fakeValue = true;
  }

  if (market === "ml") {
  if (odds <= -115 && odds >= -145) {
    valuePriority += 2;
    confidence += 1;
  }

  // ML no debe dominar por default
  valuePriority -= 6;
  confidence -= 4;

  if (odds > 130) {
    valuePriority -= 6;
    confidence -= 4;
  }

  if (fakeValue) {
    valuePriority -= 15;
    confidence -= 8;
  }
}

  valuePriority = Math.max(50, Math.min(100, valuePriority));
  confidence = Math.max(50, Math.min(95, confidence));
  marketSignal = Math.max(20, Math.min(100, marketSignal));

  let internalScore = marketSignal;

  internalScore += sharpBooks * 3;

  if (sharpBooks === 0) internalScore -= 10;
  if (sharpBooks >= 2) internalScore += 5;

  if (sharpConsensus >= 100) internalScore += 10;
  else if (sharpConsensus >= 60) internalScore += 5;
  else if (sharpConsensus === 0) internalScore -= 8;

  if (closingProjection >= 75) internalScore += 4;
  else if (closingProjection >= 60) internalScore += 4;
  else if (closingProjection <= 40) internalScore -= 8;

  if (marketDisagreement >= 25) internalScore -= 10;
  else if (marketDisagreement >= 15) internalScore -= 5;

  if (closingDirection === "up") internalScore += 10;
  if (closingDirection === "down") internalScore -= 20;

  if (edge < 3) internalScore -= 10;
  if (fakeValue) internalScore -= 25;

  if (outlierScore >= 25) internalScore -= 10;
  else if (outlierScore >= 15) internalScore -= 5;

  internalScore += edge * 0.7;

  if (rlmSignal === "strong_rlm") internalScore += 10;
  if (rlmSignal === "mild_rlm") internalScore += 5;
  if (rlmSignal === "against") internalScore -= 12;

  const marketPressure = getMarketPressureScore(
    edge,
    sharpConsensus,
    closingProjection
  );

  if (marketPressure >= 70) internalScore += 4;
  else if (marketPressure <= 40) internalScore -= 10;

  internalScore = Math.max(25, Math.min(92, internalScore));

  let marketSupportScore = 0;

  marketSupportScore += sharpConsensus * 0.1;
  marketSupportScore += closingProjection >= 60 ? 4 : 0;
  marketSupportScore += marketPressure >= 70 ? 4 : 0;

  if (marketDisagreement >= 25) marketSupportScore -= 6;
  if (fakeValue) marketSupportScore -= 8;

  marketSupportScore = Math.max(0, Math.min(20, marketSupportScore));

  let finalScore =
    valuePriority * 0.4 +
    confidence * 0.25 +
    internalScore * 0.2 +
    marketSupportScore * 0.15;

  if (market === "totals") {
    const pickName = String(pick).toLowerCase();

    if (pickName.includes("over")) finalScore += 2;
    if (pickName.includes("under")) finalScore -= 1;
  }

  if (market === "spreads") {
    finalScore += 2;
  }

  return {
    market,
    pick,
    line,
    odds,
    decimal,
    confidence,
    valuePriority,
    edge,
    score: finalScore,
    internalScore,
    sharpBooks,
    marketSignal,
    closingDirection,
    fakeValue,
    rlmSignal,
    sharpConsensus,
    closingProjection,
    marketDisagreement,
    outlierScore,
    marketPressure,
    gameId: game.id,
    teams: `${game.away_team} vs ${game.home_team}`,
    startTime: game.commence_time,
  };
}

export function buildMlbCandidates(game: OddsApiMlbGame): MlbCandidate[] {
  const candidates: MlbCandidate[] = [];

  const h2hOutcomes = getAllH2HOutcomes(game);
  const bestTotal = getBestTotalAtConsensus(game);
  const spreadMarkets = getBookmakerMarkets(game, "spreads").filter(
  (item) =>
    typeof item.outcome.point === "number" &&
    isHalfLine(item.outcome.point)
);

  for (const item of h2hOutcomes) {
    const mlCandidate = buildCandidate(
      game,
      "ml",
      item.outcome.name,
      item.outcome.price,
      undefined
    );

    if (mlCandidate) {
      candidates.push(mlCandidate);
    }
  }

  if (bestTotal) {
    const totalCandidate = buildCandidate(
      game,
      "totals",
      bestTotal.best.outcome.name,
      bestTotal.best.outcome.price,
      bestTotal.best.outcome.point
    );

    if (totalCandidate) {
      candidates.push(totalCandidate);
    }
  }

  for (const item of spreadMarkets) {
  const spreadCandidate = buildCandidate(
    game,
    "spreads",
    item.outcome.name,
    item.outcome.price,
    item.outcome.point
  );

  if (spreadCandidate) {
    candidates.push(spreadCandidate);
  }
}

  return candidates;
}


export function finalMlbPickScore(p: MlbCandidate) {
  const american = Number(p.odds);

  let score =
    (p.score ?? 0) * 0.35 +
    (p.confidence ?? 0) * 0.25 +
    (p.internalScore ?? 0) * 0.20 +
    (p.marketPressure ?? 0) * 0.20;

  // rango sano de precio
  if (Number.isFinite(american) && american >= -130 && american <= 120) {
    score += 5;
  }

  // evitar precios feos
  if (Number.isFinite(american) && american < -150) {
    score -= 18;
  }

  if (Number.isFinite(american) && american > 140) {
    score -= 14;
  }

  // ML está inflado en MLB, bajarlo sin matarlo
  if (p.market === "ml") {
    score -= 8;

    if (american >= -125 && american <= 115) {
      score += 4;
    }

    if ((p.sharpConsensus ?? 0) >= 80 && (p.marketPressure ?? 0) >= 75) {
      score += 3;
    }
  }

  // Run line: más seguro cuando es +1.5 y precio sano
  if (p.market === "spreads") {
    if (typeof p.line === "number" && p.line > 0) {
      score += 8;
    } else {
      score += 3;
    }

    if (american >= -140 && american <= 120) {
      score += 4;
    }
  }

  // Totals: competir si tiene presión/edge, no por decreto
  if (p.market === "totals") {
    if ((p.edge ?? 0) >= 4) score += 4;
    if ((p.marketPressure ?? 0) >= 70) score += 4;

    const pickName = String(p.pick ?? "").toLowerCase();
    if (pickName.includes("over")) score += 2;
  }

  if (p.fakeValue) {
    score -= 25;
  }

  if ((p.marketDisagreement ?? 0) >= 80) {
    score -= 6;
  }

  if ((p.outlierScore ?? 0) >= 80) {
    score -= 5;
  }

  return score;
}

export function pickBestFromGame(candidates: MlbCandidate[]) {
  if (!candidates.length) return null;

  const filtered = [...candidates].filter((p) => {
    const american = Number(p.odds);

    const isValidOdds =
      Number.isFinite(american) && american >= -150 && american <= 140;

    if (!isValidOdds) return false;
    if (p.fakeValue) return false;

    return (
      (p.confidence ?? 0) >= 58 &&
      (p.internalScore ?? 0) >= 50 &&
      (p.marketPressure ?? 0) >= 45 &&
      (p.closingProjection ?? 0) >= 45
    );
  });

  const poolToUse = filtered.length ? filtered : candidates.filter((p) => {
    const american = Number(p.odds);
    return Number.isFinite(american) && american >= -150 && american <= 140;
  });

  return [...poolToUse].sort(
    (a, b) => finalMlbPickScore(b) - finalMlbPickScore(a)
  )[0] ?? null;
}

export function buildMlbFullPool(games: OddsApiMlbGame[]) {
  const pool: MlbCandidate[] = [];

  for (const game of games) {
    const candidates = buildMlbCandidates(game);

    if (!candidates.length) continue;

    const best = pickBestFromGame(candidates);

    if (!best) continue;

    const american = Number(best.odds);
    const isValidOdds =
      Number.isFinite(american) && american >= -150 && american <= 120;

    if (!isValidOdds) continue;
    if (best.fakeValue) continue;
    if ((best.confidence ?? 0) < 58) continue;

    pool.push(best);
  }

  return pool.sort(
  (a, b) => finalMlbPickScore(b) - finalMlbPickScore(a)
);
}

export function buildMlbPool(games: OddsApiMlbGame[]) {
  return buildMlbFullPool(games).slice(0, 5);
}