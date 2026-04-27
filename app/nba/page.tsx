import { readMorningPool, saveMorningPool } from "./lib/morningPool";
import { evaluatePregamePool } from "./lib/pregameEngine";
import { readClosingStatus } from "./lib/closingStatus";
import { readPicksHistory, savePicksHistory } from "./lib/picksHistory";
import { calculateStats } from "./lib/stats";
import { gradePick } from "./lib/gradePicks";
import { exportPublicSignals } from "./lib/exportPublicSignals";
import { exportTop5 } from "./lib/exportTop5";

import {
  marketConsensusWeighted,
  lineEdge,
  clvPredictor,
  isEliteSpreadCandidate,
  signalRank,
  clvRank,
  isSharpBook,
  sharpScore,
  steamSignal,
  detectReverseLineMovement,
  detectOutlier,
  confidenceScore,
  confidenceLabel,
  steamStrength,
  bookWeight,
  consensusDiffScore,
  closingLineProjection,
  detectClvTrap,
  marketPressureScore,
  marketPressureLabel,
  syntheticClosingLine,
  bookmakerDisagreementIndex,
  liquiditySignal,
  marketTimingEngine,
  marketDisagreementDetector,
  sharpConsensusEngine,
  lineVelocityTracker,
  lineEfficiencyDetector,
  smartMoneyConcentration,
  fakeSteamDetection,
  marketRegimeDetector,
  sharpTrapEngine,
  liquidityShockModel,
  valuePriorityScore,
  pickCategoryLabel,
} from "@/lib/model";

const DEBUG_MODE = false;

type TeamOdd = {
  name: string;
  price: number;
  point?: number;
  bookmaker?: string;
};

type MarketPoint = {
  point: number;
  book: string;
};

type Game = {
  id: string | number;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_score?: number | string;
  away_score?: number | string;
  bookmakers?: any[];
  moneyline?: TeamOdd[];
};

function safeBook(book?: string) {
  return book ?? "Unknown";
}

function americanToDecimal(american: number): number {
  const a = Number(american);
  if (!Number.isFinite(a) || a === 0) return NaN;
  if (a > 0) return 1 + a / 100;
  return 1 + 100 / Math.abs(a);
}

function normalizePriceToDecimal(price: any): number {
  const p = Number(price);
  if (!Number.isFinite(p)) return NaN;

  if (Math.abs(p) >= 100) return americanToDecimal(p);
  if (p > 1 && p < 100) return p;

  return NaN;
}

function decimalToProbability(decimalOdds: number): number {
  const d = Number(decimalOdds);
  if (!Number.isFinite(d) || d <= 1) return 0;
  return 1 / d;
}

function getSignalStrength(
  edgePercent: number
): "ELITE" | "STRONG" | "VALUE" | "NONE" {
  if (edgePercent >= 6) return "ELITE";
  if (edgePercent >= 4) return "STRONG";
  if (edgePercent >= 2) return "VALUE";
  return "NONE";
}

function removeVig(probA: number, probB: number) {
  const total = probA + probB;
  return {
    fairA: probA / total,
    fairB: probB / total,
  };
}

function getMarket(game: Game, key: "h2h" | "spreads" | "totals"): TeamOdd[] | null {
  if (key === "h2h" && Array.isArray(game.moneyline) && game.moneyline.length) {
    return game.moneyline;
  }

  const bms = game.bookmakers;
  if (!Array.isArray(bms) || !bms.length) return null;

  const best: Record<string, TeamOdd> = {};

  for (const bm of bms) {
    const markets = bm?.markets;
    if (!Array.isArray(markets) || !markets.length) continue;

    const market = markets.find((m: any) => m?.key === key);
    const outcomes = market?.outcomes;
    if (!Array.isArray(outcomes) || !outcomes.length) continue;

    const parsed: TeamOdd[] = outcomes
      .map((o: any) => ({
        name: String(o?.name ?? ""),
        price: Number(o?.price),
        point: o?.point != null ? Number(o.point) : undefined,
        bookmaker: String(bm?.title ?? bm?.key ?? "Unknown"),
      }))
      .filter((x: TeamOdd) => x.name && Number.isFinite(x.price));

    for (const o of parsed) {
      const dec = normalizePriceToDecimal(o.price);
      if (!Number.isFinite(dec)) continue;

      const keyName =
        key === "h2h"
          ? o.name
          : `${o.name}__${typeof o.point === "number" ? o.point : "nopoint"}`;

      if (!best[keyName]) {
        best[keyName] = o;
        continue;
      }

      const prevDec = normalizePriceToDecimal(best[keyName].price);

      if (dec > prevDec) {
        best[keyName] = o;
      }
    }
  }

  const result = Object.values(best);
  return result.length ? result : null;
}

function getMoneyline(game: Game) {
  return getMarket(game, "h2h");
}

function getSpreads(game: Game) {
  return getMarket(game, "spreads");
}

function getTotals(game: Game) {
  return getMarket(game, "totals");
}

function labelForMarket(
  market: "spreads" | "totals" | "h2h",
  o?: TeamOdd | null
) {
  if (!o) return "N/A";

  if (market === "totals") {
    const line = typeof o.point === "number" ? ` (${o.point})` : "";
    return `${o.name}${line}`;
  }

  if (market === "spreads") {
    const p = typeof o.point === "number" ? o.point : NaN;

    if (Number.isFinite(p) && p === 0) {
      return `${o.name} ML`;
    }

    const line = Number.isFinite(p) ? ` (${p > 0 ? `+${p}` : `${p}`})` : "";
    return `${o.name}${line}`;
  }

  return `${o.name} ML`;
}

function isTotalsAgainstClosing(
  pickLabel: string,
  originalLine: number,
  projectedLine: number
) {
  const label = String(pickLabel).toLowerCase();

  if (!Number.isFinite(originalLine) || !Number.isFinite(projectedLine)) {
    return false;
  }

  if (label.includes("over")) return projectedLine < originalLine;
  if (label.includes("under")) return projectedLine > originalLine;

  return false;
}

function isSpreadsAgainstClosing(
  pickLabel: string,
  originalLine: number,
  projectedLine: number
) {
  const label = String(pickLabel).toLowerCase();

  if (!Number.isFinite(originalLine) || !Number.isFinite(projectedLine)) {
    return false;
  }

  if (label.includes("(-")) return projectedLine < originalLine;
  if (label.includes("(+")) return projectedLine < originalLine;

  return false;
}

function isSameMiamiDay(startTime: string) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  const gameDay = new Date(startTime).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  return today === gameDay;
}

function formatMiamiTime(startTime: string) {
  const adjustedTime = new Date(new Date(startTime).getTime() - 10 * 60 * 1000);

  return adjustedTime.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getOdds(): Promise<Game[]> {
  const res = await fetch(
    "http://localhost:3000/api/odds?sport=basketball_nba&markets=spreads,totals,h2h&oddsFormat=american",
    { cache: "no-store" }
  );

  const text = await res.text();

  if (!text) {
    console.log("ODDS API returned empty response");
    return [];
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.log("JSON parse error:", err);
    return [];
  }
}

export default async function NBAPage() {
  const games = await getOdds();

  const todayGames = games.filter((game: Game) =>
    isSameMiamiDay(game.commence_time)
  );

  function buildSelectionKey(input: any) {
    const market = String(input?.market ?? "").toLowerCase();
    const name = String(input?.odd?.name ?? "").toLowerCase();
    const point =
      typeof input?.odd?.point === "number" ? String(input.odd.point) : "";

    if (market === "totals" || market === "spreads") {
      return `${market}__${name}__${point}`;
    }

    if (input?.odd?.name) {
      return `${market}__${name}`;
    }

    const pickLabel = String(input?.pickLabel ?? "").toLowerCase();
    const base = pickLabel.split(" (")[0].trim();

    return `${market}__${base}`;
  }

  function buildPickLabelFromCandidate(candidate: any) {
    if (!candidate) return "N/A";

    const market = candidate.market;
    const odd = candidate.odd;

    if (!odd) return "N/A";

    if (market === "totals") {
      return `${odd.name ?? "N/A"} (${odd.point ?? ""})`;
    }

    if (market === "spreads") {
      if (typeof odd.point === "number" && odd.point === 0) {
        return `${odd.name ?? "N/A"} ML`;
      }

      const point =
        typeof odd.point === "number"
          ? odd.point > 0
            ? `+${odd.point}`
            : `${odd.point}`
          : "";

      return `${odd.name ?? "N/A"} (${point})`;
    }

    if (market === "h2h") {
      return `${odd.name ?? "N/A"} ML`;
    }

    return `${odd.name ?? "N/A"}`;
  }

  const publicCardPicks: any[] = [];
  const globalRankedPicks: any[] = [];
  const liveCandidateIndex = new Map<string, any>();

  const IS_CLOSING_MODE = false;
  const SAVE_MORNING_POOL = false;

  const storedMorningPool = readMorningPool();

  todayGames.forEach((game: Game) => {
    const spreadsRaw = getSpreads(game);
    const totalsRaw = getTotals(game);
    const mlRaw = getMoneyline(game);

    const spreadPoints: MarketPoint[] =
  spreadsRaw
    ?.map((o): MarketPoint | null => {
      if (typeof o.point !== "number" || !Number.isFinite(o.point)) {
        return null;
      }

      return {
        point: Math.abs(o.point),
        book: safeBook(o.bookmaker),
      };
    })
    .filter(Boolean) as MarketPoint[];

const totalPoints: MarketPoint[] =
  totalsRaw
    ?.map((o): MarketPoint | null => {
      if (typeof o.point !== "number" || !Number.isFinite(o.point)) {
        return null;
      }

      return {
        point: o.point,
        book: safeBook(o.bookmaker),
      };
    })
    .filter(Boolean) as MarketPoint[];

    const mlCandidates =
      mlRaw
        ?.map((o, i) => {
          const decimal = normalizePriceToDecimal(o.price);

          if (
            !Number.isFinite(decimal) ||
            decimal <= 1 ||
            !mlRaw ||
            mlRaw.length < 2
          ) {
            return null;
          }

          const other = mlRaw[i === 0 ? 1 : 0];
          const otherDecimal = normalizePriceToDecimal(other?.price);

          if (!Number.isFinite(otherDecimal) || otherDecimal <= 1) {
            return null;
          }

          const probA = decimalToProbability(decimal);
          const probB = decimalToProbability(otherDecimal);

          const fair = removeVig(probA, probB);
          const trueProb = i === 0 ? fair.fairA * 100 : fair.fairB * 100;
          const impliedPct = decimalToProbability(decimal) * 100;
          const edge = trueProb - impliedPct;

          const signal = getSignalStrength(edge);

          const clv =
            edge >= 4
              ? "Strong edge vs market"
              : edge >= 2
              ? "Edge vs market"
              : "Small edge vs market";

          const confidence = Math.max(
            0,
            Math.min(
              100,
              trueProb +
                (signal === "ELITE"
                  ? 12
                  : signal === "STRONG"
                  ? 8
                  : signal === "VALUE"
                  ? 4
                  : 0)
            )
          );

          const valuePriority =
            confidence * 0.55 +
            (signal === "ELITE"
              ? 20
              : signal === "STRONG"
              ? 12
              : signal === "VALUE"
              ? 6
              : 0) +
            Math.max(0, edge * 3);

          const safetyScore = confidence * 0.7 + Math.max(0, 2 - decimal) * 25;

          const category =
            decimal <= 1.35
              ? "SAFE_CORE"
              : decimal <= 1.65
              ? "PARLAY_CORE"
              : "VALUE_DOG";

          return {
            market: "h2h" as const,
            odd: o,
            decimal,
            edge,
            signal,
            clv,
            confidence,
            tier:
              confidence >= 85
                ? "PREMIUM"
                : confidence >= 70
                ? "STRONG"
                : "PLAYABLE",
            againstClosing: false,
            clvTrap: { trap: false, label: "NONE" },
            valuePriority,
            category,
            safetyScore,
            score:
              (signal === "ELITE"
                ? 20
                : signal === "STRONG"
                ? 14
                : signal === "VALUE"
                ? 8
                : 0) +
              confidence * 0.35 +
              valuePriority * 0.25,
          };
        })
        .filter(Boolean) ?? [];

    const spreadPointNumbers = spreadPoints.map((p) => p.point);
const totalPointNumbers = totalPoints.map((p) => p.point);

const spreadConsensus = marketConsensusWeighted(spreadPoints);
const totalConsensus = marketConsensusWeighted(totalPoints);

const spreadRLM = detectReverseLineMovement(spreadPoints, "spreads");
const totalRLM = detectReverseLineMovement(totalPoints, "totals");

const spreadSteam = steamSignal(spreadPoints);
const totalSteam = steamSignal(totalPoints);

const spreadSteamStrength = steamStrength(spreadPoints);
const totalSteamStrength = steamStrength(totalPoints);

    const spreadCandidates =
      spreadsRaw
        ?.map((o) => {
          const book = safeBook(o.bookmaker);
          const decimal = normalizePriceToDecimal(o.price);

          if (
            !Number.isFinite(decimal) ||
            typeof o.point !== "number" ||
            !spreadConsensus
          ) {
            return null;
          }

          const signal = isEliteSpreadCandidate(
            Math.abs(o.point),
            spreadConsensus.median,
            decimal
          )
            ? "ELITE"
            : lineEdge(Math.abs(o.point), spreadConsensus.median);

          const outlier = detectOutlier(Math.abs(o.point), spreadConsensus.median);
          const clv = clvPredictor(Math.abs(o.point), spreadConsensus.median);

          const clp = closingLineProjection({
            line: Math.abs(o.point),
            consensus: spreadConsensus.median,
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            rlm: spreadRLM.signal,
            sharp: isSharpBook(book),
            signal,
            clv,
          });

          const spreadLabel = labelForMarket("spreads", o);

          const againstClosing = isSpreadsAgainstClosing(
            spreadLabel,
            Math.abs(o.point),
            Number(clp.projected)
          );

          const clvTrap = detectClvTrap({
            signal,
            clv,
            againstClosing,
            edge: clp.edge,
          });

          const timing = marketTimingEngine({
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            rlm: spreadRLM.signal,
            clpEdge: clp.edge,
            againstClosing,
          });

          const pressure = marketPressureScore({
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            sharp: isSharpBook(book),
            rlm: spreadRLM.signal,
            signal,
            againstClosing,
          });

          const pressureLabel = marketPressureLabel(pressure);

          const syntheticCL = syntheticClosingLine({
            line: Math.abs(o.point),
            consensus: spreadConsensus.median,
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            rlm: spreadRLM.signal,
            sharp: isSharpBook(book),
            signal,
            againstClosing,
          });

          const disagreement = bookmakerDisagreementIndex(spreadPointNumbers);

const liquidity = liquiditySignal({
  book,
  sharp: isSharpBook(book),
  steam: spreadSteam,
  steamStrength: spreadSteamStrength,
  rlm: spreadRLM.signal,
});

const sharpSpreadMarketPoints = spreadPoints.filter((x) => isSharpBook(x.book));
const sharpSpreadPointNumbers = sharpSpreadMarketPoints.map((x) => x.point);

const disagreement2 = marketDisagreementDetector({
  points: spreadPoints,
  sharpPoints: sharpSpreadMarketPoints,
});

const sharpConsensus = sharpConsensusEngine({
  points: sharpSpreadPointNumbers,
  marketConsensus: spreadConsensus.median,
});

          const velocity = lineVelocityTracker({
            line: Math.abs(o.point),
            consensus: spreadConsensus.median,
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            rlm: spreadRLM.signal,
            sharp: isSharpBook(book),
          });

          const efficiency = lineEfficiencyDetector({
            line: Math.abs(o.point),
            consensus: spreadConsensus.median,
            clv,
            clpEdge: clp.edge,
            againstClosing,
            trap: clvTrap.trap,
            liquidityScore: liquidity.score,
            pressure,
          });

          const smartMoney = smartMoneyConcentration({
            lines: spreadPoints,
            marketConsensus: spreadConsensus.median,
          });

          const fakeSteam = fakeSteamDetection({
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            sharpConsensus,
            againstClosing,
            clvTrap: clvTrap.trap,
            pressure,
            liquidityScore: liquidity.score,
          });

          const regime = marketRegimeDetector({
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            rlm: spreadRLM.signal,
            sharpConsensus,
            disagreement: disagreement2,
            fakeSteam,
            smartMoney,
            velocity,
            liquidity,
          });

          const sharpTrap = sharpTrapEngine({
            againstClosing,
            clvTrap,
            fakeSteam,
            sharpDisagreement: disagreement2.sharpDisagreement,
            regime,
            signal,
            sharpConsensus,
          });

          const liquidityShock = liquidityShockModel({
            liquidity,
            velocity,
            steamStrength: spreadSteamStrength,
            disagreement: disagreement2,
            fakeSteam,
          });

          const confidence = confidenceScore({
            signal,
            clv,
            sharp: isSharpBook(book),
            steam: spreadSteam,
            steamStrength: spreadSteamStrength,
            rlm: spreadRLM.signal,
            outlier: outlier.strength,
            decimal,
            book,
            clpEdge: clp.edge,
            againstClosing,
            clvTrap: clvTrap.trap,
            timing: timing.label,
            pressure,
            liquidity: liquidity.score,
            disagreement: disagreement2.score,
            syntheticClEdge: syntheticCL.edge,
            velocity: velocity.score,
            sharpConsensus: sharpConsensus.score,
            efficiency: efficiency.score,
            sharpDisagreement: disagreement2.sharpDisagreement,
            smartMoney: smartMoney.score,
            fakeSteam: fakeSteam.score,
            regime: regime.score,
            sharpTrapScore: sharpTrap.score,
            liquidityShock: liquidityShock.score,
          });

          const tier = confidenceLabel(confidence);
          const diffScore = consensusDiffScore(
            Math.abs(o.point),
            spreadConsensus.median
          );

          const valuePriority = valuePriorityScore({
            confidence,
            signal,
            tier,
            againstClosing,
            clvTrap,
            fakeSteam,
            sharpTrap,
            smartMoney,
            efficiency,
            regime,
          });

          const category = pickCategoryLabel(valuePriority);

          return {
            market: "spreads" as const,
            odd: o,
            decimal,
            edge: 0,
            signal,
            clv,
            outlier,
            clp,
            againstClosing,
            clvTrap,
            confidence,
            tier,
            pressure,
            pressureLabel,
            syntheticCL,
            disagreement,
            liquidity,
            disagreement2,
            sharpConsensus,
            velocity,
            efficiency,
            timing,
            smartMoney,
            fakeSteam,
            regime,
            sharpTrap,
            liquidityShock,
            valuePriority,
            category,
            score:
              signalRank(signal) * 10 +
              clvRank(clv) * 3 +
              sharpScore(book) * 4 +
              (spreadRLM.signal === "STRONG_RLM"
                ? 6
                : spreadRLM.signal === "RLM"
                ? 3
                : 0) +
              (spreadSteamStrength === "HEAVY_STEAM"
                ? 6
                : spreadSteamStrength === "STEAM"
                ? 3
                : spreadSteamStrength === "WATCH"
                ? 1
                : 0) +
              bookWeight(book) * 3 +
              diffScore +
              clp.edge * 8 -
              (againstClosing ? 10 : 0) -
              (clvTrap.trap ? 8 : 0) +
              decimal +
              confidence / 10,
          };
        })
        .filter(Boolean) ?? [];

    const totalCandidates =
      totalsRaw
        ?.map((o) => {
          const book = safeBook(o.bookmaker);
          const decimal = normalizePriceToDecimal(o.price);

          if (
            !Number.isFinite(decimal) ||
            typeof o.point !== "number" ||
            !totalConsensus
          ) {
            return null;
          }

          const signal = lineEdge(o.point, totalConsensus.median);
          const outlier = detectOutlier(o.point, totalConsensus.median);
          const clv = clvPredictor(o.point, totalConsensus.median);

          const clp = closingLineProjection({
            line: o.point,
            consensus: totalConsensus.median,
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            rlm: totalRLM.signal,
            sharp: isSharpBook(book),
            signal,
            clv,
          });

          const totalLabel = labelForMarket("totals", o);

          const againstClosing = isTotalsAgainstClosing(
            totalLabel,
            Number(o.point),
            Number(clp.projected)
          );

          const clvTrap = detectClvTrap({
            signal,
            clv,
            againstClosing,
            edge: clp.edge,
          });

          const timing = marketTimingEngine({
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            rlm: totalRLM.signal,
            clpEdge: clp.edge,
            againstClosing,
          });

          const pressure = marketPressureScore({
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            sharp: isSharpBook(book),
            rlm: totalRLM.signal,
            signal,
            againstClosing,
          });

          const pressureLabel = marketPressureLabel(pressure);

          const syntheticCL = syntheticClosingLine({
            line: o.point,
            consensus: totalConsensus.median,
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            rlm: totalRLM.signal,
            sharp: isSharpBook(book),
            signal,
            againstClosing,
          });

          const disagreement = bookmakerDisagreementIndex(totalPointNumbers);

const liquidity = liquiditySignal({
  book,
  sharp: isSharpBook(book),
  steam: totalSteam,
  steamStrength: totalSteamStrength,
  rlm: totalRLM.signal,
});

const sharpTotalMarketPoints = totalPoints.filter((x) => isSharpBook(x.book));
const sharpTotalPointNumbers = sharpTotalMarketPoints.map((x) => x.point);

const disagreement2 = marketDisagreementDetector({
  points: totalPoints,
  sharpPoints: sharpTotalMarketPoints,
});

const sharpConsensus = sharpConsensusEngine({
  points: sharpTotalPointNumbers,
  marketConsensus: totalConsensus.median,
});

          const velocity = lineVelocityTracker({
            line: o.point,
            consensus: totalConsensus.median,
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            rlm: totalRLM.signal,
            sharp: isSharpBook(book),
          });

          const efficiency = lineEfficiencyDetector({
            line: o.point,
            consensus: totalConsensus.median,
            clv,
            clpEdge: clp.edge,
            againstClosing,
            trap: clvTrap.trap,
            liquidityScore: liquidity.score,
            pressure,
          });

          const smartMoney = smartMoneyConcentration({
            lines: totalPoints,
            marketConsensus: totalConsensus.median,
          });

          const fakeSteam = fakeSteamDetection({
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            sharpConsensus,
            againstClosing,
            clvTrap: clvTrap.trap,
            pressure,
            liquidityScore: liquidity.score,
          });

          const regime = marketRegimeDetector({
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            rlm: totalRLM.signal,
            sharpConsensus,
            disagreement: disagreement2,
            fakeSteam,
            smartMoney,
            velocity,
            liquidity,
          });

          const sharpTrap = sharpTrapEngine({
            againstClosing,
            clvTrap,
            fakeSteam,
            sharpDisagreement: disagreement2.sharpDisagreement,
            regime,
            signal,
            sharpConsensus,
          });

          const liquidityShock = liquidityShockModel({
            liquidity,
            velocity,
            steamStrength: totalSteamStrength,
            disagreement: disagreement2,
            fakeSteam,
          });

          const confidence = confidenceScore({
            signal,
            clv,
            sharp: isSharpBook(book),
            steam: totalSteam,
            steamStrength: totalSteamStrength,
            rlm: totalRLM.signal,
            outlier: outlier.strength,
            decimal,
            book,
            clpEdge: clp.edge,
            againstClosing,
            clvTrap: clvTrap.trap,
            timing: timing.label,
            pressure,
            liquidity: liquidity.score,
            disagreement: disagreement2.score,
            syntheticClEdge: syntheticCL.edge,
            velocity: velocity.score,
            sharpConsensus: sharpConsensus.score,
            efficiency: efficiency.score,
            sharpDisagreement: disagreement2.sharpDisagreement,
            smartMoney: smartMoney.score,
            fakeSteam: fakeSteam.score,
            regime: regime.score,
            sharpTrapScore: sharpTrap.score,
            liquidityShock: liquidityShock.score,
          });

          const tier = confidenceLabel(confidence);
          const diffScore = consensusDiffScore(o.point, totalConsensus.median);

          const valuePriority = valuePriorityScore({
            confidence,
            signal,
            tier,
            againstClosing,
            clvTrap,
            fakeSteam,
            sharpTrap,
            smartMoney,
            efficiency,
            regime,
          });

          const category = pickCategoryLabel(valuePriority);

          return {
            market: "totals" as const,
            odd: o,
            decimal,
            edge: 0,
            signal,
            clv,
            outlier,
            confidence,
            tier,
            clp,
            againstClosing,
            clvTrap,
            pressure,
            pressureLabel,
            syntheticCL,
            disagreement,
            liquidity,
            disagreement2,
            sharpConsensus,
            velocity,
            efficiency,
            timing,
            smartMoney,
            fakeSteam,
            regime,
            sharpTrap,
            liquidityShock,
            valuePriority,
            category,
            score:
              signalRank(signal) * 10 +
              clvRank(clv) * 3 +
              sharpScore(book) * 4 +
              (totalRLM.signal === "STRONG_RLM"
                ? 6
                : totalRLM.signal === "RLM"
                ? 3
                : 0) +
              (totalSteamStrength === "HEAVY_STEAM"
                ? 6
                : totalSteamStrength === "STEAM"
                ? 3
                : totalSteamStrength === "WATCH"
                ? 1
                : 0) +
              bookWeight(book) * 3 +
              diffScore +
              clp.edge * 8 -
              (againstClosing ? 10 : 0) -
              (clvTrap.trap ? 8 : 0) +
              decimal +
              confidence / 10,
          };
        })
        .filter(Boolean) ?? [];

    const allCandidates = [
      ...(spreadCandidates ?? []),
      ...(totalCandidates ?? []),
      ...(mlCandidates ?? []),
    ].filter(Boolean);

    allCandidates.forEach((candidate: any) => {
      const candidateWithMeta = {
        ...candidate,
        gameId: game.id,
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        startTime: game.commence_time,
        pickLabel: buildPickLabelFromCandidate(candidate),
      };

      const liveKey = `${String(game.id)}__${buildSelectionKey(candidateWithMeta)}`;
      liveCandidateIndex.set(liveKey, candidateWithMeta);
    });

    function finalPickScore(p: any) {
      let score =
        (p.valuePriority ?? 0) * 0.4 +
        (p.confidence ?? 0) * 0.35 +
        (p.score ?? 0) * 0.25;

      if (p.clvTrap?.trap) score -= 35;
      if (p.againstClosing) score -= 30;

      if (p.disagreement2?.label === "HIGH" && p.sharpConsensus?.label === "NONE") {
        score -= 10;
      }

      if (p.fakeSteam?.score >= 60) score -= 12;
      if (p.sharpTrap?.score >= 50) score -= 12;

      return score;
    }

    const rankedCandidates = [...allCandidates].sort(
      (a, b) => finalPickScore(b) - finalPickScore(a)
    );

    const bestOverallCandidate = rankedCandidates[0] ?? null;

    const strictCandidates = rankedCandidates
      .filter((p: any) => {
        if (p.market === "h2h") {
          const american = Number(p?.odd?.price);
          const isValidML =
            Number.isFinite(american) && american >= -150 && american <= 120;

          return (
            isValidML &&
            (p.valuePriority ?? 0) >= 100 &&
            (p.confidence ?? 0) >= 60 &&
            !p.clvTrap?.trap &&
            !p.againstClosing
          );
        }

        return (
          (p.valuePriority ?? 0) >= 100 &&
          (p.confidence ?? 0) >= 60 &&
          !p.clvTrap?.trap &&
          !p.againstClosing
        );
      })
      .sort((a: any, b: any) => {
        const scoreA =
          (a.valuePriority ?? 0) * 0.5 +
          (a.confidence ?? 0) * 0.3 +
          (a.score ?? 0) * 0.2;

        const scoreB =
          (b.valuePriority ?? 0) * 0.5 +
          (b.confidence ?? 0) * 0.3 +
          (b.score ?? 0) * 0.2;

        return scoreB - scoreA;
      });

    if (bestOverallCandidate) {
      let finalCandidate = bestOverallCandidate;

      if (bestOverallCandidate.market === "h2h") {
        const american = Number(bestOverallCandidate?.odd?.price);
        const isUnderdog = Number.isFinite(american) && american >= 150;

        if (isUnderdog) {
          const spreadAlt = rankedCandidates.find((p: any) => {
            return (
              p.market === "spreads" &&
              p.odd?.name === bestOverallCandidate.odd?.name &&
              typeof p.odd?.point === "number" &&
              p.odd.point > 0
            );
          });

          if (spreadAlt) {
            finalCandidate = spreadAlt;
          }
        }
      }

      publicCardPicks.push({
        ...finalCandidate,
        gameId: game.id,
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        startTime: game.commence_time,
        pickLabel: buildPickLabelFromCandidate(finalCandidate),
      });
    }

    if (strictCandidates.length) {
      const bestStrict = strictCandidates[0];

      globalRankedPicks.push({
        ...bestStrict,
        gameId: game.id,
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        startTime: game.commence_time,
        pickLabel: buildPickLabelFromCandidate(bestStrict),
      });
    }

    if (DEBUG_MODE) {
      console.log("DEBUG", {
        game: `${game.away_team} vs ${game.home_team}`,
        spreadsLen: spreadsRaw?.length ?? 0,
        totalsLen: totalsRaw?.length ?? 0,
        mlLen: mlRaw?.length ?? 0,
        finalPick: bestOverallCandidate,
      });
    }
  });

  const publicSignalsPool = [...publicCardPicks].sort(
    (a, b) => (b.valuePriority ?? 0) - (a.valuePriority ?? 0)
  );

  const liveInitialPool = [...globalRankedPicks].sort(
    (a, b) => (b.valuePriority ?? 0) - (a.valuePriority ?? 0)
  );

  exportPublicSignals(publicSignalsPool);

  const refreshedMorningPool =
    storedMorningPool.length > 0
      ? storedMorningPool.map((savedPick: any) => {
          const liveKey = `${String(savedPick.gameId)}__${buildSelectionKey(savedPick)}`;
          const livePick = liveCandidateIndex.get(liveKey);

          if (!livePick) return savedPick;

          const originalPoint = Number(savedPick?.originalPoint);
          const livePoint = Number(livePick?.odd?.point);

          let recalculatedAgainstClosing = false;

          if (
            savedPick.market === "totals" &&
            Number.isFinite(originalPoint) &&
            Number.isFinite(livePoint)
          ) {
            recalculatedAgainstClosing = isTotalsAgainstClosing(
              savedPick.originalPickLabel ?? savedPick.pickLabel,
              originalPoint,
              livePoint
            );
          }

          if (
            savedPick.market === "spreads" &&
            Number.isFinite(originalPoint) &&
            Number.isFinite(livePoint)
          ) {
            recalculatedAgainstClosing = isSpreadsAgainstClosing(
              savedPick.originalPickLabel ?? savedPick.pickLabel,
              Math.abs(originalPoint),
              Math.abs(livePoint)
            );
          }

          const recalculatedClvTrap = detectClvTrap({
            signal: livePick.signal ?? savedPick.signal,
            clv: livePick.clv ?? savedPick.clv,
            againstClosing: recalculatedAgainstClosing,
            edge: livePick?.clp?.edge ?? savedPick?.clp?.edge ?? 0,
          });

          return {
            ...savedPick,
            pickLabel: savedPick.originalPickLabel ?? savedPick.pickLabel,
            market: savedPick.originalMarket ?? savedPick.market,
            originalPickLabel: savedPick.originalPickLabel ?? savedPick.pickLabel,
            originalMarket: savedPick.originalMarket ?? savedPick.market,
            originalPoint: savedPick.originalPoint ?? null,
            originalPrice: savedPick.originalPrice ?? null,
            originalConfidence: savedPick.originalConfidence ?? null,
            originalValuePriority: savedPick.originalValuePriority ?? null,
            originalEdge: savedPick.originalEdge ?? null,
            livePoint:
              typeof livePick?.odd?.point === "number" ? livePick.odd.point : null,
            livePrice:
              typeof livePick?.odd?.price === "number" ? livePick.odd.price : null,
            liveConfidence:
              typeof livePick?.confidence === "number" ? livePick.confidence : null,
            liveValuePriority:
              typeof livePick?.valuePriority === "number"
                ? livePick.valuePriority
                : null,
            liveEdge: typeof livePick?.edge === "number" ? livePick.edge : null,
            odd: livePick.odd,
            decimal: livePick.decimal,
            signal: livePick.signal,
            clv: livePick.clv,
            outlier: livePick.outlier,
            clp: livePick.clp,
            againstClosing: recalculatedAgainstClosing,
            clvTrap: recalculatedClvTrap,
            confidence: livePick.confidence,
            tier: livePick.tier,
            pressure: livePick.pressure,
            pressureLabel: livePick.pressureLabel,
            syntheticCL: livePick.syntheticCL,
            disagreement: livePick.disagreement,
            liquidity: livePick.liquidity,
            disagreement2: livePick.disagreement2,
            sharpConsensus: livePick.sharpConsensus,
            velocity: livePick.velocity,
            efficiency: livePick.efficiency,
            timing: livePick.timing,
            smartMoney: livePick.smartMoney,
            fakeSteam: livePick.fakeSteam,
            regime: livePick.regime,
            sharpTrap: livePick.sharpTrap,
            liquidityShock: livePick.liquidityShock,
            valuePriority: livePick.valuePriority,
            category: livePick.category,
            score: livePick.score,
          };
        })
      : [];

  const initialPool =
    storedMorningPool.length > 0 ? refreshedMorningPool : liveInitialPool;

  const pregameEvaluatedPool = evaluatePregamePool(initialPool, 30);

  const statusMap = readClosingStatus();

  console.log("SAVE_MORNING_POOL:", SAVE_MORNING_POOL);
  console.log("IS_CLOSING_MODE:", IS_CLOSING_MODE);
  console.log("liveInitialPool length:", liveInitialPool.length);
  console.log(
    "liveInitialPool picks:",
    liveInitialPool.map((p: any) => ({
      gameId: p.gameId,
      pickLabel: p.pickLabel,
      market: p.market,
      price: p?.odd?.price,
    }))
  );

  if (SAVE_MORNING_POOL && !IS_CLOSING_MODE) {
    const morningTop5 = liveInitialPool.slice(0, 5).map((pick: any) => {
      const fixedPickLabel = labelForMarket(pick.market, pick.odd);

      const originalPoint =
        typeof pick?.odd?.point === "number" ? pick.odd.point : null;

      const originalPrice =
        typeof pick?.odd?.price === "number" ? pick.odd.price : null;

      return {
        ...pick,
        pickLabel: fixedPickLabel,
        originalPickLabel: fixedPickLabel,
        originalMarket: pick.market,
        originalPoint,
        originalPrice,
        originalConfidence: pick.confidence ?? null,
        originalValuePriority: pick.valuePriority ?? null,
        originalEdge: pick.edge ?? null,
        livePoint: originalPoint,
        livePrice: originalPrice,
        liveConfidence: pick.confidence ?? null,
        liveValuePriority: pick.valuePriority ?? null,
        liveEdge: pick.edge ?? null,
      };
    });

    saveMorningPool(morningTop5);
  }

  const displayTopPool = pregameEvaluatedPool.slice(0, 5);

  const history = readPicksHistory();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  exportTop5({
    [today]: displayTopPool,
  });

  const alreadySaved = history.some((p) => p.date === today);

  if (!alreadySaved) {
    const newEntries = displayTopPool.map((pick, idx) => ({
      date: today,
      rank: idx + 1,
      game: `${pick.awayTeam} vs ${pick.homeTeam}`,
      pick: pick.pickLabel,
      market: pick.market,
      status: "PENDING",
      pregameStatus:
        statusMap[pick.id ?? pick.gameId]?.status ?? pick.status ?? "PENDING",
    }));

    savePicksHistory([...history, ...newEntries]);
  }

  const updatedHistory = readPicksHistory().map((entry) => {
    const matchingGame = games.find((game: Game) => {
      const sameMatch = `${game.away_team} vs ${game.home_team}` === entry.game;

      const hasScores =
        Number.isFinite(Number(game.home_score)) &&
        Number.isFinite(Number(game.away_score));

      return sameMatch && hasScores;
    });

    if (!matchingGame) return entry;

    const gradedStatus = gradePick(entry, {
      home_team: matchingGame.home_team,
      away_team: matchingGame.away_team,
      home_score: Number(matchingGame.home_score),
      away_score: Number(matchingGame.away_score),
    });

    return {
      ...entry,
      status: gradedStatus,
      pregameStatus:
        entry.pregameStatus ??
        statusMap[String(matchingGame.id)]?.status ??
        "PENDING",
    };
  });

  savePicksHistory(updatedHistory);

  const stats = calculateStats(updatedHistory);

  return (
    <div
      style={{
        padding: 20,
        background: "#0b0b0b",
        minHeight: "100vh",
        fontFamily: "system-ui",
        color: "#fff",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 20,
        }}
      >
        NBA Dashboard
      </h1>

      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              background: "#ffcc00",
              color: "#000",
              padding: "6px 12px",
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            PREMIUM SIGNALS
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>OVERALL</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {stats.wins}-{stats.losses}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Win Rate: {stats.winRate}%
            </div>
          </div>

          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>ML</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.ml}</div>
          </div>

          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>SPREADS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.spreads}</div>
          </div>

          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>TOTALS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.totals}</div>
          </div>
        </div>
      </div>

      {displayTopPool.length ? (
        <div>
          {displayTopPool.map((pick, idx) => (
            <div
              key={`top-${idx}`}
              style={{
                border: idx === 0 ? "2px solid #ffcc00" : "1px solid #333",
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                background: "#111",
                color: "#fff",
              }}
            >
              {idx === 0 && (
                <div
                  style={{
                    display: "inline-block",
                    background: "#ffcc00",
                    color: "#000",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  TOP SIGNAL
                </div>
              )}

              <div style={{ fontWeight: 700 }}>
                #{idx + 1} {pick.awayTeam} vs {pick.homeTeam}
              </div>

              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                Start: {formatMiamiTime(pick.startTime)}
              </div>

              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                {pick.market === "h2h" ? `${pick.pickLabel} ML` : pick.pickLabel}
              </div>

              <div style={{ fontSize: 12, marginTop: 6 }}>
                Price: {pick.originalPrice ?? pick.odd?.price ?? "N/A"}
              </div>

              <div style={{ fontSize: 12, marginTop: 4 }}>
                Status:{" "}
                {statusMap[pick.id ?? pick.gameId]?.status ??
                  pick.status ??
                  "PENDING"}
              </div>

              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>
                {pick.reviewReason ?? ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ opacity: 0.7 }}>No ranked picks found.</div>
      )}
    </div>
  );
}