export type SoccerMarket =
  | "ml"
  | "spreads"
  | "totals"
  | "btts"
  | "team_totals"
  | "corners";

export type SoccerCandidate = {
  market: SoccerMarket;
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

export type OddsApiSoccerGame = {
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

export function isAllowedSoccerSpread(value?: number) {
  return value === 1.5 || value === -1.5;
}

export function isAllowedSoccerTotal(value?: number) {
  return value === 2.5;
}

export function isValidSoccerLine(market: SoccerMarket, line?: number) {
  if (market === "ml") return true;
  if (line === undefined || line === null) return false;

  if (market === "spreads") return isAllowedSoccerSpread(line);
  if (market === "totals") return isAllowedSoccerTotal(line);

  return false;
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

export function countSharpBooksForMarket(
  game: OddsApiSoccerGame,
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

export function getBookmakerMarkets(
  game: OddsApiSoccerGame,
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

export function extractSpreadLines(game: OddsApiSoccerGame) {
  const lines: number[] = [];

  for (const bookmaker of game.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      if (market.key !== "spreads") continue;

      for (const outcome of market.outcomes ?? []) {
        if (isAllowedSoccerSpread(outcome.point)) {
          lines.push(outcome.point!);
        }
      }
    }
  }

  return lines;
}

export function extractTotalLines(game: OddsApiSoccerGame) {
  const lines: number[] = [];

  for (const bookmaker of game.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      if (market.key !== "totals") continue;

      for (const outcome of market.outcomes ?? []) {
        if (isAllowedSoccerTotal(outcome.point)) {
          lines.push(outcome.point!);
        }
      }
    }
  }

  return lines;
}

export function getConsensusSpreadLine(game: OddsApiSoccerGame) {
  return getConsensusLine(extractSpreadLines(game));
}

export function getConsensusTotalLine(game: OddsApiSoccerGame) {
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

  if (diff > 0) edge += diff * 10;

  if (odds > 0) {
    edge += Math.min(8, odds / 60);
  }

  if (diff < 0) {
    edge -= Math.abs(diff) * 12;
  }

  return Math.max(0, edge);
}

export function getClosingDirection(line: number, consensus: number | null) {
  if (consensus === null) return "neutral";
  if (line < consensus) return "up";
  if (line > consensus) return "down";
  return "neutral";
}

export function buildCandidate(
  game: OddsApiSoccerGame,
  market: SoccerMarket,
  pick: string,
  odds: number,
  line: number | undefined
): SoccerCandidate | null {
  if (!isValidSoccerLine(market, line)) return null;

  const american = Number(odds);
  const isValidOdds =
    Number.isFinite(american) && american >= -150 && american <= 140;

  if (!isValidOdds) return null;

  const decimal = americanToDecimal(odds);

  let sharpBooks = 0;

  if (market === "spreads" && line !== undefined) {
    sharpBooks = countSharpBooksForMarket(game, "spreads", line);
  } else if (market === "totals" && line !== undefined) {
    sharpBooks = countSharpBooksForMarket(game, "totals", line);
  } else if (market === "ml") {
    sharpBooks = countSharpBooksForMarket(game, "h2h");
  }

  let marketSignal = 50 + sharpBooks * 10;
  marketSignal = Math.max(50, Math.min(100, marketSignal));

  let closingDirection: "up" | "down" | "neutral" = "neutral";

  if ((market === "spreads" || market === "totals") && line !== undefined) {
    const consensus =
      market === "spreads"
        ? getConsensusSpreadLine(game)
        : getConsensusTotalLine(game);

    closingDirection = getClosingDirection(line, consensus);
  }

  let edge = 0;

  if (market === "spreads" && line !== undefined) {
    const consensus = getConsensusSpreadLine(game);
    edge = calculateLineEdge(line, consensus, odds);
  }

  if (market === "totals" && line !== undefined) {
    const consensus = getConsensusTotalLine(game);
    edge = calculateLineEdge(line, consensus, odds);
  }

  if (market === "ml") {
    if (pick.toLowerCase() === "draw" || pick.toLowerCase() === "empate" || pick.toLowerCase() === "tie") {
      edge = 1.5;
      marketSignal -= 6;
    } else if (odds <= -110 && odds >= -170) {
      edge = 4.5;
    } else if (odds > 0 && odds <= 130) {
      edge = 3.2;
    }

    if (sharpBooks >= 2) {
      edge += 1;
    }

    edge = Math.max(0, edge);
  }

  if (market === "totals" && edge < 0.2) {
    return null;
  }

  if (market === "spreads" && edge < 0.2) {
    return null;
  }

  let valuePriority = 80;
  let confidence = 75;

  if (market === "ml") {
    if (pick.toLowerCase() === "draw" || pick.toLowerCase() === "empate" || pick.toLowerCase() === "tie") {
      valuePriority -= 6;
      confidence -= 8;
    } else if (odds <= -110 && odds >= -170) {
      valuePriority += 10;
      confidence += 8;
    } else if (odds > 0 && odds <= 130) {
      valuePriority += 4;
      confidence += 3;
    }
  }

  if (market === "totals") {
    const pickName = String(pick).toLowerCase();

    valuePriority += 5;
    confidence += 4;

    if (pickName.includes("under")) {
      valuePriority += 3;
      confidence += 2;
    }

    if (pickName.includes("over")) {
      valuePriority += 1;
      confidence += 1;
    }
  }

  

  valuePriority += edge * 8;
  valuePriority += sharpBooks * 3;

  confidence += edge * 5;
  confidence += sharpBooks * 2;

  if (closingDirection === "up") {
    confidence += 6;
    marketSignal += 8;
  }

  if (closingDirection === "down") {
    confidence -= 10;
    marketSignal -= 12;
  }

  valuePriority = Math.max(50, Math.min(100, valuePriority));
  confidence = Math.max(50, Math.min(95, confidence));
  marketSignal = Math.max(20, Math.min(100, marketSignal));

  let internalScore = marketSignal;
  internalScore += sharpBooks * 4;

  if (closingDirection === "up") {
    internalScore += 8;
  }

  if (closingDirection === "down") {
    internalScore -= 12;
  }

  if (edge < 2) {
    internalScore -= 6;
  }

  if (market === "ml") {
    if (pick.toLowerCase() === "draw" || pick.toLowerCase() === "empate" || pick.toLowerCase() === "tie") {
      internalScore -= 6;
    } else {
      internalScore += 4;
    }
  }

  internalScore = Math.max(20, Math.min(100, internalScore));

  let finalScore =
    valuePriority * 0.35 +
    confidence * 0.4 +
    internalScore * 0.25;

    if (market === "spreads") {
  if (typeof line === "number" && line > 0) {
    finalScore += 3;
  }

  if (typeof line === "number" && line < 0) {
    finalScore -= 8;

    if ((sharpBooks ?? 0) >= 2 && closingDirection === "up") {
      finalScore += 2;
    }
  }
}

  if (market === "ml") finalScore += 0;
  if (market === "totals") finalScore += 1.5;
  if (market === "spreads") finalScore += 2;

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
    gameId: game.id,
    teams: `${game.away_team} vs ${game.home_team}`,
    startTime: game.commence_time,
  };
}

export function buildSoccerCandidates(game: OddsApiSoccerGame): SoccerCandidate[] {
  const candidates: SoccerCandidate[] = [];

  const h2hOutcomes = getBookmakerMarkets(game, "h2h");
  const spreadOutcomes = getBookmakerMarkets(game, "spreads");
  const totalOutcomes = getBookmakerMarkets(game, "totals");

  for (const item of h2hOutcomes) {
    const candidate = buildCandidate(
      game,
      "ml",
      item.outcome.name,
      item.outcome.price,
      undefined
    );

    if (candidate) candidates.push(candidate);
  }

  for (const item of spreadOutcomes) {
    if (!isAllowedSoccerSpread(item.outcome.point)) continue;

    const candidate = buildCandidate(
      game,
      "spreads",
      `${item.outcome.name} ${item.outcome.point}`,
      item.outcome.price,
      item.outcome.point
    );

    if (candidate) candidates.push(candidate);
  }

  for (const item of totalOutcomes) {
    if (!isAllowedSoccerTotal(item.outcome.point)) continue;

    const normalizedName = String(item.outcome.name).toLowerCase();

    if (normalizedName !== "over" && normalizedName !== "under") continue;

    const candidate = buildCandidate(
      game,
      "totals",
      `${item.outcome.name} ${item.outcome.point}`,
      item.outcome.price,
      item.outcome.point
    );

    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

export function finalSoccerPickScore(p: SoccerCandidate) {
  const american = Number(p.odds);

  let score =
    (p.score ?? 0) * 0.45 +
    (p.confidence ?? 0) * 0.25 +
    (p.internalScore ?? 0) * 0.20 +
    (p.edge ?? 0) * 0.10;

  if (Number.isFinite(american) && american >= -130 && american <= 120) {
    score += 5;
  }

  if (Number.isFinite(american) && american < -150) {
    score -= 18;
  }

  if (Number.isFinite(american) && american > 140) {
    score -= 14;
  }

  if (p.market === "ml") {
    score -= 5;

    const pickName = String(p.pick ?? "").toLowerCase();
    if (pickName === "draw" || pickName === "empate" || pickName === "tie") {
      score -= 8;
    }
  }

  if (p.market === "spreads") {
  if (typeof p.line === "number" && p.line > 0) {
    // +1.5 es protección, más seguro
    score += 7;
  }

  if (typeof p.line === "number" && p.line < 0) {
    // -1.5 es agresivo en soccer, no debe dominar por default
    score -= 6;

    if ((p.sharpBooks ?? 0) >= 2 && p.closingDirection === "up") {
      score += 3;
    }
  }
}

  if (p.market === "totals") {
    if ((p.edge ?? 0) >= 3) score += 4;

    const pickName = String(p.pick ?? "").toLowerCase();
    if (pickName.includes("over")) score += 2;
    if (pickName.includes("under")) score += 1;
  }

  return score;
}

export function pickBestFromGame(candidates: SoccerCandidate[]) {
  if (!candidates.length) return null;

  const filtered = [...candidates].filter((p) => {
    const american = Number(p.odds);

    return (
      Number.isFinite(american) &&
      american >= -150 &&
      american <= 140 &&
      (p.confidence ?? 0) >= 58 &&
      (p.internalScore ?? 0) >= 52
    );
  });

  const poolToUse = filtered.length ? filtered : candidates;

  return [...poolToUse].sort(
    (a, b) => finalSoccerPickScore(b) - finalSoccerPickScore(a)
  )[0] ?? null;
}

export function buildSoccerFullPool(games: OddsApiSoccerGame[]) {
  const pool: SoccerCandidate[] = [];

  for (const game of games) {
    const candidates = buildSoccerCandidates(game);

    if (!candidates.length) continue;

    const best = pickBestFromGame(candidates);

    if (!best) continue;

    pool.push(best);
  }

  return pool.sort(
  (a, b) => finalSoccerPickScore(b) - finalSoccerPickScore(a)
);
}

export function buildSoccerPool(games: OddsApiSoccerGame[]) {
  return buildSoccerFullPool(games)
    .filter((pick) => {
      const american = Number(pick.odds);
      const isValidOdds =
        Number.isFinite(american) && american >= -150 && american <= 140;

      if (!isValidOdds) return false;

      if (pick.market === "ml") {
        if (
          pick.pick.toLowerCase() === "draw" ||
          pick.pick.toLowerCase() === "empate" ||
          pick.pick.toLowerCase() === "tie"
        ) {
          return (
            (pick.confidence ?? 0) >= 64 &&
            (pick.internalScore ?? 0) >= 60
          );
        }

        return (
          (pick.confidence ?? 0) >= 62 &&
          (pick.internalScore ?? 0) >= 58
        );
      }

      if (pick.market === "spreads") {
        return (
          (pick.confidence ?? 0) >= 60 &&
          (pick.internalScore ?? 0) >= 56
        );
      }

      return (
        (pick.confidence ?? 0) >= 60 &&
        (pick.internalScore ?? 0) >= 55
      );
    })
    .slice(0, 5);
}