export function americanToDecimal(american:number){

  if(american > 0){
    return 1 + american/100
  }

  return 1 + 100/Math.abs(american)
}

export function decimalToAmerican(decimal:number){

  if(decimal >= 2){
    return Math.round((decimal-1)*100)
  }

  return Math.round(-100/(decimal-1))
}

export function decimalToProbability(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return 0;
  return (1 / decimal) * 100; // porcentaje 0..100
}

export function removeVig(pA: number, pB: number) {
  const total = pA + pB;
  if (!Number.isFinite(total) || total <= 0) return { fairA: 0, fairB: 0 };

  return {
    fairA: (pA / total) * 100,
    fairB: (pB / total) * 100,
  };
}

export function calculateEdge(decimal:number,trueProb:number){

  const implied = decimalToProbability(decimal)

  return (trueProb - implied) * 100

}

export function signalStrength(edge:number){

  if(edge >= 3) return "ELITE"
  if(edge >= 2) return "STRONG"
  if(edge >= 0.8) return "VALUE"

  return "NONE"

}

// ---------- A + B: Evaluación de mercados (h2h + spreads + totals) ----------

export type MarketKey = "h2h" | "spreads" | "totals";

export type MarketPick = {
  market: MarketKey;
  label: string;        // texto para mostrar (equipo + line si aplica)
  decimal: number;      // odds decimal
  american: number;     // odds american (número)
  prob: number;         // probabilidad "fair" sin vig (0..100)
  edge: number;         // edge en % (true - implied)
  signal: string;       // ELITE / STRONG / VALUE / NONE
};

function isValidDecimal(d: number) {
  return Number.isFinite(d) && d > 1 && d < 1000;
}

// Convierte decimal -> american number
export function decimalToAmericanNumber(decimal: number): number {
  if (!isValidDecimal(decimal)) return NaN;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

// Normaliza “price” a decimal.
// Si viene american (|p|>=100) => convierte.
// Si viene decimal (>1 y <100) => deja.
export function normalizePriceToDecimal(p: any): number {
  const n = Number(p);
  if (!Number.isFinite(n)) return NaN;

  if (Math.abs(n) >= 100) return americanToDecimal(n);
  if (n > 1 && n < 100) return n;

  return NaN;
}

// Calcula fair probs (sin vig) para 2 outcomes usando removeVig
function fairTwoWayFromDecimals(d0: number, d1: number) {
  const p0 = decimalToProbability(d0); // 0..1 (según tu helper en model.ts)
  const p1 = decimalToProbability(d1);

  // removeVig espera probs en 0..1
  return removeVig(p0, p1); // { fairA: 0..1, fairB: 0..1 }
}

function buildTwoWayPick(
  market: MarketKey,
  label0: string,
  d0: number,
  fair0: number, // 0..1
): MarketPick {
  const impliedPct = (1 / d0) * 100;
  const truePct = fair0 * 100;
  const edge = truePct - impliedPct;

  return {
    market,
    label: label0,
    decimal: d0,
    american: decimalToAmericanNumber(d0),
    prob: truePct,
    edge,
    signal: signalStrength(edge),
  };
}

/**
 * Evalúa un mercado de 2 outcomes (h2h, spreads, totals)
 * outcomes debe venir con length 2.
 */
export function evaluateTwoWayMarket(
  market: MarketKey,
  outcomeA: { name: string; price: any; point?: any },
  outcomeB: { name: string; price: any; point?: any },
  labelFor: (o: any) => string
): { pickA: MarketPick; pickB: MarketPick } | null {
  const d0 = normalizePriceToDecimal(outcomeA.price);
  const d1 = normalizePriceToDecimal(outcomeB.price);
  if (!isValidDecimal(d0) || !isValidDecimal(d1)) return null;

  const fair = fairTwoWayFromDecimals(d0, d1);
  // fair.fairA/fair.fairB están en 0..1

  const pickA = buildTwoWayPick(market, labelFor(outcomeA), d0, fair.fairA);
  const pickB = buildTwoWayPick(market, labelFor(outcomeB), d1, fair.fairB);

  return { pickA, pickB };
}

/**
 * Elige el mejor pick entre 2 outcomes de un mercado.
 * Regla: max edge.
 */
function bestOfTwo(pickA: MarketPick, pickB: MarketPick): MarketPick {
  return pickA.edge >= pickB.edge ? pickA : pickB;
}

export function bestLineFromSportsbooks(outcomes:any[]){
  let best:any = null

  for(const o of outcomes){

    const decimal = normalizePriceToDecimal(o.price)

    if(!Number.isFinite(decimal)) continue

    if(!best || decimal > best.decimal){
      best = {
        ...o,
        decimal
      }
    }
  }

  return best
}

/**
 * Evalúa h2h/spreads/totals y devuelve:
 * - best per market
 * - best overall
 */
export function bestPickAcrossMarkets(params: {
  h2h?: any[] | null;
  spreads?: any[] | null;
  totals?: any[] | null;
}): {
  bestOverall: MarketPick | null;
  bestH2H: MarketPick | null;
  bestSpreads: MarketPick | null;
  bestTotals: MarketPick | null;
} {
  const result = {
    bestOverall: null as MarketPick | null,
    bestH2H: null as MarketPick | null,
    bestSpreads: null as MarketPick | null,
    bestTotals: null as MarketPick | null,
  };

  // ---------- h2h ----------
  if (params.h2h && params.h2h.length >= 2) {
    const a = params.h2h[0];
    const b = params.h2h[1];

    const evalH = evaluateTwoWayMarket(
      "h2h",
      a,
      b,
      (o) => String(o.name)
    );

    if (evalH) {
      result.bestH2H = bestOfTwo(evalH.pickA, evalH.pickB);
    }
  }

  // ---------- spreads ----------
  if (params.spreads && params.spreads.length >= 2) {
    const a = params.spreads[0];
    const b = params.spreads[1];

    const evalS = evaluateTwoWayMarket(
      "spreads",
      a,
      b,
      (o) => `${o.name} (${o.point > 0 ? `+${o.point}` : o.point})`
    );

    if (evalS) {
      result.bestSpreads = bestOfTwo(evalS.pickA, evalS.pickB);
    }
  }

  // ---------- totals ----------
  if (params.totals && params.totals.length >= 2) {
    const a = params.totals[0];
    const b = params.totals[1];

    const evalT = evaluateTwoWayMarket(
      "totals",
      a,
      b,
      (o) => `${o.name} (${o.point})`
    );

    if (evalT) {
      result.bestTotals = bestOfTwo(evalT.pickA, evalT.pickB);
    }
  }

  // ---------- best overall ----------
  const candidates = [result.bestH2H, result.bestSpreads, result.bestTotals].filter(Boolean) as MarketPick[];
  if (candidates.length) {
    candidates.sort((x, y) => y.edge - x.edge);
    result.bestOverall = candidates[0];
  }

  return result;
}

export function evaluateMoneyline(teamA:number,teamB:number){

  const dA = americanToDecimal(teamA)
  const dB = americanToDecimal(teamB)

  const pA = decimalToProbability(dA)
  const pB = decimalToProbability(dB)

  const fair = removeVig(pA,pB)

  const edgeA = calculateEdge(dA,fair.fairA)
  const edgeB = calculateEdge(dB,fair.fairB)

  return {
    teamA:{
      decimal:dA,
      prob:fair.fairA*100,
      edge:edgeA,
      signal:signalStrength(edgeA)
    },
    teamB:{
      decimal:dB,
      prob:fair.fairB*100,
      edge:edgeB,
      signal:signalStrength(edgeB)
    }
  }

}

// ---------- Atlas simple probability model ----------
export function atlasTrueProbability(decimalOdds:number){

  // Probabilidad del sportsbook
  const implied = decimalToProbability(decimalOdds) / 100

  // Ajuste Atlas (detecta valor en underdogs)
  let adjustment = 0

  if(decimalOdds >= 3) adjustment = 0.05
  else if(decimalOdds >= 2) adjustment = 0.03
  else if(decimalOdds >= 1.5) adjustment = 0.01

  return Math.min(implied + adjustment, 0.95)
}

export type AtlasCandidate = {
  market: "h2h" | "spreads" | "totals"
  odd: any
  decimal: number
  american: string | number
  trueProb: number
  edge: number
  signal: string
}

export function buildAtlasCandidate(
  market: "h2h" | "spreads" | "totals",
  odd: any
): AtlasCandidate | null {

  if(!odd) return null

  const decimal = normalizePriceToDecimal(odd.price)
  if(!Number.isFinite(decimal) || decimal <= 1) return null

  const trueProb = decimalToProbability(decimal) // ya viene en %
  const edge = 0
  const signal = signalStrength(edge)

  return {
    market,
    odd,
    decimal,
    american: decimalToAmericanNumber(decimal),
    trueProb,
    edge,
    signal
  }
}

export function compareMarkets(
  bestSpread:any,
  bestTotal:any,
  bestML:any
){
  const spreadCandidate = buildAtlasCandidate("spreads", bestSpread)
  const totalCandidate = buildAtlasCandidate("totals", bestTotal)
  const mlCandidate = buildAtlasCandidate("h2h", bestML)

  const candidates = [spreadCandidate, totalCandidate, mlCandidate]
    .filter(Boolean) as AtlasCandidate[]

  if(!candidates.length) return null

  candidates.sort((a,b)=> b.decimal - a.decimal)

  return candidates[0]
}

export function marketConsensusWeighted(lines: { point: number; book?: string }[]) {
  if (!lines.length) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const l of lines) {
    const weight = bookWeight(l.book);
    weightedSum += l.point * weight;
    totalWeight += weight;
  }

  const avg = weightedSum / totalWeight;

  const sorted = lines.map((l) => l.point).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  const median =
    sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    average: avg,
    median
  };
}

export function lineEdge(line: number, consensus: number) {
  const diff = Math.abs(line - consensus);

  // ELITE solo si la desviación es realmente grande
  if (diff >= 2) return "ELITE";
  if (diff >= 1.25) return "STRONG";
  if (diff >= 0.5) return "VALUE";

  return "NONE";
}

export function isEliteSpreadCandidate(
  point: number,
  consensus: number,
  decimal: number
) {
  const diff = Math.abs(point - consensus);

  // Debe haber gran desviación del consenso
  if (diff < 1.5) return false;

  // Y además el precio no debe ser malo
  // Queremos algo razonable, no una línea "mejor" pero con juice tóxico
  if (!Number.isFinite(decimal) || decimal < 1.80) return false;

  return true;
}

export function clvPredictor(line:number, consensus:number){

  const diff = line - consensus
  const abs = Math.abs(diff)

  if(abs >= 2){
    return "High probability of market correction"
  }

  if(abs >= 1.25){
    return "Strong chance of closing line movement"
  }

  if(abs >= 0.5){
    return "Small edge vs market"
  }

  return "Market aligned"
}

export function detectOutlier(line:number, consensus:number){

 const diff = Math.abs(line - consensus)

 if(diff >= 2.5){
   return {
     outlier: true,
     strength: "EXTREME",
     edge: diff
   }
 }

 if(diff >= 1.5){
   return {
     outlier: true,
     strength: "STRONG",
     edge: diff
   }
 }

 if(diff >= 0.75){
   return {
     outlier: true,
     strength: "MINOR",
     edge: diff
   }
 }

 return {
   outlier:false,
   strength:"NONE",
   edge:diff
 }
}

export function signalRank(signal: string) {
  if (signal === "ELITE") return 4;
  if (signal === "STRONG") return 3;
  if (signal === "VALUE") return 2;
  return 1;
}

export function clvRank(text: string) {
  if (text === "High probability of market correction") return 3;
  if (text === "Strong chance of closing line movement") return 2;
  if (text === "Small edge vs market") return 1;
  return 0;
}

export function isSharpBook(bookmaker?: string) {
  const name = String(bookmaker ?? "").toLowerCase();

  return (
    name.includes("lowvig") ||
    name.includes("pinnacle") ||
    name.includes("circa") ||
    name.includes("bookmaker")
  );
}

export function sharpScore(book?: string) {
  const weight = bookWeight(book);

  if (weight >= 4) return 4;
  if (weight === 3) return 2;
  if (weight === 2) return 1;

  return 0;
}

export function bookWeight(book?: string) {
  const name = String(book ?? "").toLowerCase();

  if (
    name.includes("pinnacle") ||
    name.includes("circa") ||
    name.includes("bookmaker") ||
    name.includes("lowvig")
  ) {
    return 4;
  }

  if (
    name.includes("betonline") ||
    name.includes("heritage") ||
    name.includes("cris")
  ) {
    return 3;
  }

  if (
    name.includes("draftkings") ||
    name.includes("fanduel") ||
    name.includes("caesars") ||
    name.includes("betmgm") ||
    name.includes("betrivers")
  ) {
    return 2;
  }

  return 1;
}

export function steamSignal(lines: { point: number; book?: string }[]) {
  if (!lines || lines.length < 2) return "NONE";

  const rawPoints = lines
    .map((l) => l.point)
    .filter((p) => typeof p === "number" && Number.isFinite(p));

  if (rawPoints.length < 2) return "NONE";

  const max = Math.max(...rawPoints);
  const min = Math.min(...rawPoints);
  const spread = Math.abs(max - min);

  if (spread >= 1.5) return "STRONG";
  if (spread >= 0.75) return "WATCH";

  return "NONE";
}

export function steamStrength(lines: { point: number; book?: string }[]) {
  if (!lines || lines.length < 3) return "NONE";

  const rawPoints = lines
    .map((l) => l.point)
    .filter((p) => typeof p === "number" && Number.isFinite(p));

  if (rawPoints.length < 3) return "NONE";

  const sorted = [...rawPoints].sort((a, b) => a - b);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const diff = Math.abs(last - first);

  if (diff >= 2) return "HEAVY_STEAM";
  if (diff >= 1) return "STEAM";
  if (diff >= 0.5) return "WATCH";

  return "NONE";
}

export const SHARP_BOOKS = [
 "Pinnacle",
 "Circa",
 "LowVig.ag"
]

export const MID_BOOKS = [
 "Bookmaker",
 "BetOnline"
]

export function medianOfNumbers(values: number[]) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectReverseLineMovement(
  lines: { point: number; book?: string }[],
  marketType: "spreads" | "totals"
) {
  if (!lines.length) {
    return {
      signal: "NONE",
      note: "No market data"
    };
  }

  const rawPoints = lines
    .map((l) => l.point)
    .filter((p) => Number.isFinite(p));

  const median = medianOfNumbers(rawPoints);
  if (median == null) {
    return {
      signal: "NONE",
      note: "No valid median"
    };
  }

  const sharpLines = lines.filter((l) => isSharpBook(l.book));
  if (!sharpLines.length) {
    return {
      signal: "WATCH",
      note: "No sharp book available"
    };
  }

  const sharpMedian = medianOfNumbers(
    sharpLines.map((l) => l.point).filter((p) => Number.isFinite(p))
  );

  if (sharpMedian == null) {
    return {
      signal: "WATCH",
      note: "Sharp books unavailable"
    };
  }

  const diff = Math.abs(sharpMedian - median);

  // spreads: normalmente usamos magnitud absoluta
  if (marketType === "spreads") {
    if (diff >= 1.5) {
      return {
        signal: "STRONG_RLM",
        note: "Sharp books disagree strongly with market consensus"
      };
    }

    if (diff >= 0.75) {
      return {
        signal: "RLM",
        note: "Sharp books leaning away from market consensus"
      };
    }

    return {
      signal: "NONE",
      note: "Sharp books aligned with market"
    };
  }

  // totals
  if (diff >= 1.5) {
    return {
      signal: "STRONG_RLM",
      note: "Sharp total differs strongly from market consensus"
    };
  }

  if (diff >= 0.75) {
    return {
      signal: "RLM",
      note: "Sharp total leaning away from market consensus"
    };
  }

  return {
    signal: "NONE",
    note: "Sharp books aligned with market"
  };
}

export function outlierRank(strength?: string) {
  if (strength === "EXTREME") return 4;
  if (strength === "STRONG") return 3;
  if (strength === "MINOR") return 1;
  return 0;
}

export function steamRank(signal?: string) {
  if (signal === "STRONG") return 3;
  if (signal === "WATCH") return 1;
  return 0;
}

export function rlmRank(signal?: string) {
  if (signal === "STRONG_RLM") return 4;
  if (signal === "RLM") return 2;
  if (signal === "WATCH") return 1;
  return 0;
}

export function priceRank(decimal: number) {
  if (!Number.isFinite(decimal)) return 0;

  if (decimal >= 2.0 && decimal <= 2.2) return 3;
  if (decimal >= 1.9 && decimal < 2.0) return 2;
  if (decimal >= 1.8 && decimal < 1.9) return 1;

  return 0;
}

export function confidenceScore(input: {
  signal: string;
  clv: string;
  sharp?: boolean;
  steam?: string;
  rlm?: string;
  outlier?: string;
  decimal: number;
  steamStrength?: string;
  book?: string;
  clpEdge?: number;
againstClosing?: boolean;
clvTrap?: boolean;
pressure?: number;
liquidity?: number;
disagreement?: number;
syntheticClEdge?: number;
timing?: string;
velocity?: number;
efficiency?: number;
sharpConsensus?: number;
sharpDisagreement?: boolean;
smartMoney?: number;
fakeSteam?: number;
regime?: number;
sharpTrapScore?: number;
liquidityShock?: number;
line?: number;
consensus?: number;
}) {
 
   const score =
  signalRank(input.signal) * 12 +
  clvRank(input.clv) * 7 +
  consensusDiffScore(input.line ?? 0, input.consensus ?? 0) +
  (input.sharp ? 8 : 0) +
  steamRank(input.steam) * 5 +
  steamStrengthRank(input.steamStrength) * 6 +
  rlmRank(input.rlm) * 6 +
  outlierRank(input.outlier) * 6 +
  priceRank(input.decimal) * 4 +
  bookWeight(input.book) * 3 +
  clpEdgeRank(input.clpEdge) * 2 +
  timingRank(input.timing) +
  ((input.pressure ?? 0) * 0.12) +
  ((input.liquidity ?? 0) * 0.08) +
  ((input.disagreement ?? 0) * 0.08) +
  ((input.syntheticClEdge ?? 0) * 8) +
  ((input.velocity ?? 0) * 0.05) +
  ((input.sharpConsensus ?? 0) * 0.06) +
  ((input.efficiency ?? 0) * 0.05) -
  ((input.smartMoney ?? 0) * 0.08) -
  ((input.fakeSteam ?? 0) * 0.10) +
  (input.sharpDisagreement ? 6 : 0) -
  (input.againstClosing ? 12 : 0) -
  ((input.regime ?? 0) * 0.05) -
  ((input.sharpTrapScore ?? 0) * 0.10) -
  ((input.liquidityShock ?? 0) * 0.06) -
  (input.clvTrap ? 10 : 0) ;
   

return Math.max(0, Math.min(100, score));
}

export function marketPressureScore(input: {
  steam?: string;
  steamStrength?: string;
  sharp?: boolean;
  rlm?: string;
  signal?: string;
  againstClosing?: boolean;
}) {
  let score = 0;

  if (input.steam === "STRONG") score += 18;
  else if (input.steam === "WATCH") score += 8;

  if (input.steamStrength === "HEAVY_STEAM") score += 22;
  else if (input.steamStrength === "STEAM") score += 12;
  else if (input.steamStrength === "WATCH") score += 6;

  if (input.sharp) score += 16;

  if (input.rlm === "STRONG_RLM") score += 20;
  else if (input.rlm === "RLM") score += 10;

  if (input.signal === "ELITE") score += 14;
  else if (input.signal === "STRONG") score += 10;
  else if (input.signal === "VALUE") score += 6;

  if (input.againstClosing) score -= 18;

  return Math.max(0, Math.min(100, score));
}

export function marketPressureLabel(score: number) {
  if (score >= 70) return "EXTREME";
  if (score >= 50) return "HIGH";
  if (score >= 30) return "MEDIUM";
  if (score >= 15) return "LOW";
  return "NONE";
}

export function closingLineProjection(input: {
  line: number;
  consensus: number;
  steam?: string;
  steamStrength?: string;
  rlm?: string;
  sharp?: boolean;
  signal?: string;
  clv?: string;
}) {
  let projected = input.consensus;

  const diff = input.line - input.consensus;

  // Si ya la línea está despegada del consenso, parte del propio consenso
  // pero deja algo de inercia a la línea actual
  projected = input.consensus + diff * 0.35;

  // Steam empuja la proyección
  if (input.steamStrength === "HEAVY_STEAM") {
    projected += diff > 0 ? 0.75 : -0.75;
  } else if (input.steamStrength === "STEAM") {
    projected += diff > 0 ? 0.4 : -0.4;
  } else if (input.steamStrength === "WATCH") {
    projected += diff > 0 ? 0.2 : -0.2;
  }

  // RLM tiene bastante peso
  if (input.rlm === "STRONG_RLM") {
    projected += diff > 0 ? 0.6 : -0.6;
  } else if (input.rlm === "RLM") {
    projected += diff > 0 ? 0.3 : -0.3;
  }

  // Sharp book confirmado
  if (input.sharp) {
    projected += diff > 0 ? 0.2 : -0.2;
  }

  // Señales del modelo
  if (input.signal === "ELITE") {
    projected += diff > 0 ? 0.5 : -0.5;
  } else if (input.signal === "STRONG") {
    projected += diff > 0 ? 0.25 : -0.25;
  } else if (input.signal === "VALUE") {
    projected += diff > 0 ? 0.15 : -0.15;
  }

  if (input.clv?.toLowerCase().includes("strong")) {
    projected += diff > 0 ? 0.35 : -0.35;
  } else if (input.clv?.toLowerCase().includes("small")) {
    projected += diff > 0 ? 0.15 : -0.15;
  }

  const direction =
    projected > input.line
      ? "UP"
      : projected < input.line
        ? "DOWN"
        : "FLAT";

  const edge = Math.abs(projected - input.line);

  return {
    projected: Number(projected.toFixed(2)),
    direction,
    edge: Number(edge.toFixed(2))
  };
}

export function syntheticClosingLine(input: {
  line: number;
  consensus: number;
  steam?: string;
  steamStrength?: string;
  rlm?: string;
  sharp?: boolean;
  signal?: string;
  againstClosing?: boolean;
}) {
  let projected = input.consensus;

  const diff = input.line - input.consensus;
  projected = input.consensus + diff * 0.35;

  if (input.steamStrength === "HEAVY_STEAM") {
    projected += diff > 0 ? 0.9 : -0.9;
  } else if (input.steamStrength === "STEAM") {
    projected += diff > 0 ? 0.55 : -0.55;
  } else if (input.steamStrength === "WATCH") {
    projected += diff > 0 ? 0.25 : -0.25;
  }

  if (input.rlm === "STRONG_RLM") {
    projected += diff > 0 ? 0.7 : -0.7;
  } else if (input.rlm === "RLM") {
    projected += diff > 0 ? 0.35 : -0.35;
  }

  if (input.sharp) {
    projected += diff > 0 ? 0.3 : -0.3;
  }

  if (input.signal === "ELITE") {
    projected += diff > 0 ? 0.35 : -0.35;
  } else if (input.signal === "STRONG") {
    projected += diff > 0 ? 0.2 : -0.2;
  }

  if (input.againstClosing) {
    projected -= diff > 0 ? 0.25 : -0.25;
  }

  const edge = Math.abs(projected - input.line);
  const direction =
    projected > input.line ? "UP" : projected < input.line ? "DOWN" : "FLAT";

  return {
    projected,
    edge,
    direction
  };
}

export function marketTimingEngine(input: {
  steam?: string
  steamStrength?: string
  rlm?: string
  clpEdge?: number
  againstClosing?: boolean
}) {

  const steam = input.steam ?? "NONE"
  const steamStrength = input.steamStrength ?? "NONE"
  const rlm = input.rlm ?? "NONE"
  const clp = input.clpEdge ?? 0
  const against = input.againstClosing ?? false

  // Early sharp money
  if (steamStrength === "HEAVY_STEAM" && clp > 0.2 && !against) {
    return {
      label: "EARLY_SHARP",
      score: 80
    }
  }

  // Late steam chasing
  if (steam === "STEAM" && clp < 0.05) {
    return {
      label: "LATE_STEAM",
      score: 40
    }
  }

  // Trap zone
  if (against && clp < 0) {
    return {
      label: "TRAP_ZONE",
      score: 20
    }
  }

  return {
    label: "NEUTRAL",
    score: 50
  }
}

export function clpEdgeRank(edge?: number) {
  if (typeof edge !== "number" || !Number.isFinite(edge)) return 0;

  if (edge >= 1.5) return 8;
  if (edge >= 1.0) return 6;
  if (edge >= 0.5) return 4;
  if (edge >= 0.25) return 2;

  return 0;
}

export function isPickAgainstClosing(input: {
  market: "spreads" | "totals";
  label: string;
  direction?: string;
}) {
  const label = String(input.label ?? "").toLowerCase();
  const dir = input.direction ?? "FLAT";

  if (dir === "FLAT") return false;

  if (input.market === "totals") {
    if (label.includes("over") && dir === "DOWN") return true;
    if (label.includes("under") && dir === "UP") return true;
    return false;
  }

  if (input.market === "spreads") {
    // Para spreads usamos la lógica simple:
    // si proyecta subir y tú tienes el lado "más corto", puede ir contra ti.
    // como trabajas con abs(point), aquí miramos el signo del label.
    if (label.includes("+") && dir === "DOWN") return true;
    if (label.includes("-") && dir === "UP") return true;
    return false;
  }

  return false;
}

export function detectClvTrap(input: {
  signal?: string;
  clv?: string;
  againstClosing?: boolean;
  edge?: number;
}) {
  const signal = String(input.signal ?? "");
  const clv = String(input.clv ?? "").toLowerCase();
  const edge = typeof input.edge === "number" ? input.edge : 0;

  const hasValueSignal =
    signal === "VALUE" || signal === "STRONG" || signal === "ELITE";

  const hasPositiveClv =
    clv.includes("small") || clv.includes("strong") || clv.includes("movement");

  if (hasValueSignal && hasPositiveClv && input.againstClosing && edge <= 0.35) {
    return {
      trap: true,
      label: "CLV_TRAP"
    };
  }

  return {
    trap: false,
    label: "NONE"
  };
}

export function consensusDiffScore(line: number, consensus: number) {

  const diff = Math.abs(line - consensus);

  if (diff >= 2.5) return 12;
  if (diff >= 1.5) return 8;
  if (diff >= 1) return 5;
  if (diff >= 0.5) return 2;

  return 0;
}

export function confidenceLabel(score: number) {
  if (score >= 85) return "PREMIUM";
  if (score >= 70) return "STRONG";
  if (score >= 55) return "PLAYABLE";
  return "PASS";
}

export function steamStrengthRank(signal?: string) {
  if (signal === "HEAVY_STEAM") return 4;
  if (signal === "STEAM") return 2;
  if (signal === "WATCH") return 1;
  return 0;
}

export function timingRank(label?: string) {

  if (label === "EARLY_SHARP") return 10
  if (label === "LATE_STEAM") return -5
  if (label === "TRAP_ZONE") return -10

  return 0
}

export function bookmakerDisagreementIndex(points: number[]) {

  if (!points || points.length === 0) {
    return {
      score: 0,
      label: "NONE",
      range: 0
    };
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;

  let score = 0;
  let label = "NONE";

  if (range >= 2) {
    score = 90;
    label = "EXTREME";
  } else if (range >= 1.5) {
    score = 70;
    label = "HIGH";
  } else if (range >= 1) {
    score = 50;
    label = "MEDIUM";
  } else if (range >= 0.5) {
    score = 25;
    label = "LOW";
  }

  return { score, label, range };
}

export function liquiditySignal(input: {
  book?: string;
  sharp?: boolean;
  steam?: string;
  steamStrength?: string;
  rlm?: string;
}) {
  let score = 0;

  if (input.sharp) score += 35;

  if (input.steam === "STRONG") score += 20;
  else if (input.steam === "WATCH") score += 8;

  if (input.steamStrength === "HEAVY_STEAM") score += 25;
  else if (input.steamStrength === "STEAM") score += 15;
  else if (input.steamStrength === "WATCH") score += 5;

  if (input.rlm === "STRONG_RLM") score += 20;
  else if (input.rlm === "RLM") score += 10;

  let label = "THIN";
  if (score >= 70) label = "DEEP";
  else if (score >= 45) label = "SOLID";
  else if (score >= 20) label = "MEDIUM";

  return {
    score: Math.max(0, Math.min(100, score)),
    label
  };
}

export function marketDisagreementDetector(input: {
  points: { point: number; book?: string }[];
  sharpPoints?: { point: number; book?: string }[];
}) {
  const cleanPoints = (input.points ?? [])
    .map((p) => p.point)
    .filter((p) => typeof p === "number" && Number.isFinite(p));

  if (cleanPoints.length === 0) {
    return {
      score: 0,
      label: "NONE",
      range: 0,
      sharpDisagreement: false
    };
  }

  const min = Math.min(...cleanPoints);
  const max = Math.max(...cleanPoints);
  const range = max - min;

  let score = 0;
  let label = "NONE";

  if (range >= 2) {
    score = 90;
    label = "EXTREME";
  } else if (range >= 1.5) {
    score = 70;
    label = "HIGH";
  } else if (range >= 1) {
    score = 50;
    label = "MEDIUM";
  } else if (range >= 0.5) {
    score = 25;
    label = "LOW";
  }

  const cleanSharp = (input.sharpPoints ?? [])
    .map((p) => p.point)
    .filter((p) => typeof p === "number" && Number.isFinite(p));

  let sharpDisagreement = false;

  if (cleanSharp.length > 0) {
    const sharpAvg = cleanSharp.reduce((a, b) => a + b, 0) / cleanSharp.length;
    const marketAvg = cleanPoints.reduce((a, b) => a + b, 0) / cleanPoints.length;
    sharpDisagreement = Math.abs(sharpAvg - marketAvg) >= 0.5;
  }

  return {
    score,
    label,
    range,
    sharpDisagreement
  };
}

export function sharpConsensusEngine(input: {
  points: number[];
  marketConsensus: number;
}) {
  if (!input.points || input.points.length === 0) {
    return {
      score: 0,
      label: "NONE",
      direction: "FLAT",
      avg: input.marketConsensus
    };
  }

  const avg = input.points.reduce((a, b) => a + b, 0) / input.points.length;
  const diff = avg - input.marketConsensus;

  let score = 0;
  let label = "NONE";

  const absDiff = Math.abs(diff);

  if (absDiff >= 1.5) {
    score = 90;
    label = "EXTREME";
  } else if (absDiff >= 1) {
    score = 70;
    label = "HIGH";
  } else if (absDiff >= 0.5) {
    score = 45;
    label = "MEDIUM";
  } else if (absDiff >= 0.25) {
    score = 20;
    label = "LOW";
  }

  const direction = diff > 0 ? "UP" : diff < 0 ? "DOWN" : "FLAT";

  return {
    score,
    label,
    direction,
    avg
  };
}

export function lineVelocityTracker(input: {
  line: number;
  consensus: number;
  steam?: string;
  steamStrength?: string;
  rlm?: string;
  sharp?: boolean;
}) {
  const diff = Math.abs(input.line - input.consensus);

  let velocity = diff * 12;

  if (input.steam === "STRONG") velocity += 15;
  else if (input.steam === "WATCH") velocity += 7;

  if (input.steamStrength === "HEAVY_STEAM") velocity += 20;
  else if (input.steamStrength === "STEAM") velocity += 10;
  else if (input.steamStrength === "WATCH") velocity += 4;

  if (input.rlm === "STRONG_RLM") velocity += 18;
  else if (input.rlm === "RLM") velocity += 9;

  if (input.sharp) velocity += 10;

  const score = Math.max(0, Math.min(100, velocity));

  let label = "SLOW";
  if (score >= 70) label = "FAST";
  else if (score >= 40) label = "MEDIUM";

  return {
    score,
    label
  };
}

export function lineEfficiencyDetector(input: {
  line: number;
  consensus: number;
  clv?: string;
  clpEdge?: number;
  againstClosing?: boolean;
  trap?: boolean;
  liquidityScore?: number;
  pressure?: number;
}) {
  const diff = Math.abs(input.line - input.consensus);
  const clpEdge = input.clpEdge ?? 0;
  const liquidity = input.liquidityScore ?? 0;
  const pressure = input.pressure ?? 0;

  if (input.trap || input.againstClosing) {
    return {
      score: 20,
      label: "TRAP_LINE"
    };
  }

  if (diff <= 0.25 && clpEdge <= 0.15 && pressure <= 15) {
    return {
      score: 85,
      label: "MARKET_EFFICIENT"
    };
  }

  if (diff >= 1 && clpEdge < 0.15 && liquidity < 20) {
    return {
      score: 35,
      label: "OVERREACTION"
    };
  }

  if (clpEdge >= 0.35 && liquidity >= 20 && pressure >= 20) {
    return {
      score: 75,
      label: "SHARP_WINDOW"
    };
  }

  return {
    score: 55,
    label: "TRANSITION"
  };
}

export function smartMoneyConcentration(input: {
  lines: { point: number; book?: string }[];
  marketConsensus: number;
}) {
  if (!input.lines || input.lines.length === 0) {
    return {
      label: "NONE",
      score: 0,
      sharpCount: 0,
      sharpLean: 0
    };
  }

  const sharpLines = input.lines.filter((l) => isSharpBook(l.book));
  if (!sharpLines.length) {
    return {
      label: "NONE",
      score: 0,
      sharpCount: 0,
      sharpLean: 0
    };
  }

  const sharpAvg =
    sharpLines.reduce((sum, l) => sum + l.point, 0) / sharpLines.length;

  const diff = Math.abs(sharpAvg - input.marketConsensus);

  let label = "NONE";
  let score = 0;

  if (sharpLines.length >= 3 && diff >= 1) {
    label = "HEAVY";
    score = 90;
  } else if (sharpLines.length >= 2 && diff >= 0.5) {
    label = "MEDIUM";
    score = 60;
  } else if (diff >= 0.25) {
    label = "LIGHT";
    score = 30;
  }

  return {
    label,
    score,
    sharpCount: sharpLines.length,
    sharpLean: sharpAvg
  };
}

export function fakeSteamDetection(input: {
  steam?: string;
  steamStrength?: string;
  sharpConsensus?: { label: string; score: number; direction: string };
  againstClosing?: boolean;
  clvTrap?: boolean;
  pressure?: number;
  liquidityScore?: number;
}) {
  const pressure = input.pressure ?? 0;
  const liquidity = input.liquidityScore ?? 0;
  const sharpConsensusScore = input.sharpConsensus?.score ?? 0;

  let label = "NONE";
  let score = 0;

  const hasSteam =
    input.steam === "STRONG" ||
    input.steam === "WATCH" ||
    input.steamStrength === "STEAM" ||
    input.steamStrength === "HEAVY_STEAM";

  if (!hasSteam) {
    return {
      label,
      score
    };
  }

  if (
    hasSteam &&
    sharpConsensusScore < 20 &&
    liquidity < 15 &&
    pressure < 12
  ) {
    label = "LIKELY_FAKE";
    score = 75;
  }

  if (input.againstClosing || input.clvTrap) {
    label = "TRAP_STEAM";
    score = 90;
  }

  return {
    label,
    score
  };
}

export function marketRegimeDetector(input: {
  steam?: string;
  steamStrength?: string;
  rlm?: string;
  sharpConsensus?: { label: string; score: number; direction: string };
  disagreement?: { label: string; score: number; range: number; sharpDisagreement?: boolean };
  fakeSteam?: { label: string; score: number };
  smartMoney?: { label: string; score: number };
  velocity?: { label: string; score: number };
  liquidity?: { label: string; score: number };
}) {
  const steam = input.steam ?? "NONE";
  const steamStrength = input.steamStrength ?? "NONE";
  const rlm = input.rlm ?? "NONE";
  const sharpConsensusScore = input.sharpConsensus?.score ?? 0;
  const disagreementScore = input.disagreement?.score ?? 0;
  const fakeSteamScore = input.fakeSteam?.score ?? 0;
  const smartMoneyScore = input.smartMoney?.score ?? 0;
  const velocityScore = input.velocity?.score ?? 0;
  const liquidityScore = input.liquidity?.score ?? 0;

  if (
    fakeSteamScore >= 60 &&
    disagreementScore >= 50 &&
    sharpConsensusScore < 25
  ) {
    return { label: "TRAP_ENVIRONMENT", score: 85 };
  }

  if (
    (steam === "STRONG" || steamStrength === "STEAM" || steamStrength === "HEAVY_STEAM") &&
    (rlm === "RLM" || rlm === "STRONG_RLM") &&
    sharpConsensusScore >= 50
  ) {
    return { label: "SHARP_DRIVEN", score: 80 };
  }

  if (
    disagreementScore >= 55 &&
    velocityScore >= 45 &&
    fakeSteamScore >= 35
  ) {
    return { label: "PUBLIC_CHAOS", score: 70 };
  }

  if (
    sharpConsensusScore >= 35 &&
    disagreementScore < 35 &&
    smartMoneyScore >= 20
  ) {
    return { label: "BALANCED", score: 60 };
  }

  if (
    liquidityScore < 15 &&
    velocityScore < 15 &&
    disagreementScore < 20
  ) {
    return { label: "QUIET", score: 35 };
  }

  return { label: "BALANCED", score: 50 };
}

export function sharpTrapEngine(input: {
  againstClosing?: boolean;
  clvTrap?: { label: string; trap: boolean };
  fakeSteam?: { label: string; score: number };
  sharpDisagreement?: boolean;
  regime?: { label: string; score: number };
  signal?: string;
  sharpConsensus?: { label: string; score: number; direction: string };
}) {
  const againstClosing = input.againstClosing ?? false;
  const trap = input.clvTrap?.trap ?? false;
  const fakeSteamScore = input.fakeSteam?.score ?? 0;
  const sharpDisagreement = input.sharpDisagreement ?? false;
  const regime = input.regime?.label ?? "BALANCED";
  const signal = input.signal ?? "NONE";
  const sharpConsensusScore = input.sharpConsensus?.score ?? 0;

  let score = 0;

  if (againstClosing) score += 30;
  if (trap) score += 25;
  if (fakeSteamScore >= 40) score += 20;
  if (sharpDisagreement) score += 15;
  if (regime === "TRAP_ENVIRONMENT") score += 20;
  if (signal === "VALUE" && sharpConsensusScore < 20) score += 10;

  if (score >= 70) return { label: "HIGH_SHARP_TRAP", score };
  if (score >= 40) return { label: "MEDIUM_SHARP_TRAP", score };
  if (score >= 20) return { label: "LOW_SHARP_TRAP", score };

  return { label: "NONE", score: 0 };
}

export function liquidityShockModel(input: {
  liquidity?: { label: string; score: number };
  velocity?: { label: string; score: number };
  steamStrength?: string;
  disagreement?: { label: string; score: number; range: number };
  fakeSteam?: { label: string; score: number };
}) {
  const liquidityScore = input.liquidity?.score ?? 0;
  const velocityScore = input.velocity?.score ?? 0;
  const disagreementScore = input.disagreement?.score ?? 0;
  const fakeSteamScore = input.fakeSteam?.score ?? 0;
  const steamStrength = input.steamStrength ?? "NONE";

  let score = 0;

  if (liquidityScore <= 10) score += 30;
  if (velocityScore >= 45) score += 20;
  if (disagreementScore >= 45) score += 20;
  if (fakeSteamScore >= 35) score += 15;
  if (steamStrength === "HEAVY_STEAM") score += 15;

  if (score >= 70) return { label: "HIGH_SHOCK", score };
  if (score >= 40) return { label: "MEDIUM_SHOCK", score };
  if (score >= 20) return { label: "LOW_SHOCK", score };

  return { label: "NONE", score: 0 };
}

export function valuePriorityScore(input: {
  confidence: number;
  signal?: string;
  tier?: string;
  againstClosing?: boolean;
  clvTrap?: { trap: boolean };
  fakeSteam?: { score: number };
  sharpTrap?: { score: number };
  smartMoney?: { score: number };
  efficiency?: { score: number };
  regime?: { label: string; score: number };
}) {
  let score = input.confidence;

  if (input.signal === "ELITE") score += 20;
  else if (input.signal === "STRONG") score += 12;
  else if (input.signal === "VALUE") score += 8;

  if (input.tier === "PREMIUM") score += 20;
  else if (input.tier === "STRONG") score += 12;
  else if (input.tier === "PLAYABLE") score += 5;

  score += (input.smartMoney?.score ?? 0) * 0.12;
  score += (input.efficiency?.score ?? 0) * 0.08;

  if (input.regime?.label === "SHARP_DRIVEN") score += 10;
  if (input.regime?.label === "TRAP_ENVIRONMENT") score -= 15;

  if (input.againstClosing) score -= 20;
  if (input.clvTrap?.trap) score -= 15;
  score -= (input.fakeSteam?.score ?? 0) * 0.12;
  score -= (input.sharpTrap?.score ?? 0) * 0.15;

  return Math.max(0, score);
}

export function pickCategoryLabel(score: number) {
  if (score >= 95) return "NUCLEAR";
  if (score >= 80) return "A+";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  if (score >= 35) return "C";
  if (score >= 20) return "D";
  return "NO_PICK";
}