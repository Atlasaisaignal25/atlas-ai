import { readMorningPool, saveMorningPool } from "./lib/morningPool";
import { evaluatePregamePool } from "./lib/pregameEngine";
import { readClosingStatus } from "./lib/closingStatus";
import { readPicksHistory, savePicksHistory } from "./lib/picksHistory";
import { calculateStats } from "./lib/stats";
import { gradePick } from "./lib/gradePicks";
import { exportPublicSignals } from "./lib/exportPublicSignals";
import { exportTop5 } from "./lib/exportTop5";

type TeamOdd = {
  name: string;
  price: number;
  point?: number;
  bookmaker?: string;
};

type Game = {
  id: string | number;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_score?: number | string;
  away_score?: number | string;
  bookmakers?: any[];
};

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

function formatSignedPoint(point?: number) {
  if (typeof point !== "number" || !Number.isFinite(point)) return "";
  return point > 0 ? `+${point}` : `${point}`;
}

function labelForMarket(
  market: "h2h" | "spreads" | "totals",
  odd?: TeamOdd | null
) {
  if (!odd) return "N/A";

  if (market === "h2h") return `${odd.name} ML`;
  if (market === "spreads") return `${odd.name} (${formatSignedPoint(odd.point)})`;
  return `${odd.name} (${odd.point ?? ""})`;
}

function getBestMarket(
  game: Game,
  key: "h2h" | "spreads" | "totals"
): TeamOdd[] {
  const bookmakers = game.bookmakers ?? [];
  const best: Record<string, TeamOdd> = {};

  for (const bm of bookmakers) {
    const market = bm?.markets?.find((m: any) => m?.key === key);
    const outcomes = market?.outcomes ?? [];
    if (!Array.isArray(outcomes) || !outcomes.length) continue;

    for (const o of outcomes) {
      const parsed: TeamOdd = {
        name: String(o?.name ?? ""),
        price: Number(o?.price),
        point: o?.point != null ? Number(o.point) : undefined,
        bookmaker: String(bm?.title ?? bm?.key ?? "Unknown"),
      };

      if (!parsed.name || !Number.isFinite(parsed.price)) continue;

      const decimal = normalizePriceToDecimal(parsed.price);
      if (!Number.isFinite(decimal)) continue;

      const dedupeKey =
        key === "h2h"
          ? parsed.name
          : `${parsed.name}__${typeof parsed.point === "number" ? parsed.point : "nopoint"}`;

      if (!best[dedupeKey]) {
        best[dedupeKey] = parsed;
        continue;
      }

      const prevDecimal = normalizePriceToDecimal(best[dedupeKey].price);
      if (decimal > prevDecimal) {
        best[dedupeKey] = parsed;
      }
    }
  }

  return Object.values(best);
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
  return new Date(startTime).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getOdds(): Promise<Game[]> {
  const res = await fetch(
    "http://localhost:3000/api/odds?sport=icehockey_nhl&markets=spreads,totals,h2h&oddsFormat=american",
    { cache: "no-store" }
  );

  const text = await res.text();

  if (!text) {
    console.log("NHL ODDS API returned empty response");
    return [];
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.log("NHL JSON parse error:", err);
    return [];
  }
}

export default async function NHLPage() {
  const games = await getOdds();

  const todayGames = games.filter((game: Game) =>
    isSameMiamiDay(game.commence_time)
  );

  function buildSelectionKey(input: any) {
    const market = String(input?.market ?? "").toLowerCase();
    const name = String(input?.odd?.name ?? "").toLowerCase();
    const point =
      typeof input?.odd?.point === "number"
        ? String(input.odd.point)
        : "";

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
      const point =
        typeof odd.point === "number"
          ? odd.point > 0
            ? `+${odd.point}`
            : `${odd.point}`
          : "";

      return `${odd.name ?? "N/A"} (${point})`;
    }

    return `${odd.name ?? "N/A"}`;
  }

  const globalRankedPicks: any[] = [];
  const liveCandidateIndex = new Map<string, any>();

  const IS_CLOSING_MODE = false;
  const SAVE_MORNING_POOL = false;

  const storedMorningPool = readMorningPool();

  function finalNhlPickScore(p: any) {
  let score =
    (p.valuePriority ?? 0) * 0.45 +
    (p.confidence ?? 0) * 0.35 +
    (p.decimal && Number.isFinite(p.decimal) ? Math.min(p.decimal, 2.25) * 8 : 0);

  const isML = p.market === "h2h";
  const isPuckLine = p.market === "spreads";
  const isTotal = p.market === "totals";

  const american = Number(p?.odd?.price);
  const point = Number(p?.odd?.point);

  if (Number.isFinite(american) && american >= -130 && american <= 120) {
  score += 6;
}

if (Number.isFinite(american) && american < -150) {
  score -= 15;
}

if (Number.isFinite(american) && american > 140) {
  score -= 10;
}

  if (isPuckLine && Number.isFinite(point) && point > 0) {
  score += 6;

  if (Number.isFinite(american) && american >= -130 && american <= 120) {
    score += 4;
  }
}

  if (isML && Number.isFinite(american)) {
    if (american >= 150) score -= 12;
    if (american <= -180) score -= 8;
  }

  if (isTotal && Number.isFinite(point)) {
  if (point >= 6.5) score -= 4;
}

  return score;
}

  todayGames.forEach((game: Game) => {
    const mlRaw = getBestMarket(game, "h2h");
    const spreadsRaw = getBestMarket(game, "spreads");
    const totalsRaw = getBestMarket(game, "totals");

    const bestML = mlRaw[0] ?? null;
    const bestSpread = spreadsRaw[0] ?? null;
    const bestTotal = totalsRaw[0] ?? null;

    const candidates = [
      bestML
        ? {
            market: "h2h",
            odd: bestML,
            pickLabel: labelForMarket("h2h", bestML),
            decimal: normalizePriceToDecimal(bestML.price),
            edge: 0,
            confidence: 70,
            valuePriority: 85,
            category: "ML_CORE",
            gameId: game.id,
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            startTime: game.commence_time,
          }
        : null,

      bestSpread
        ? {
            market: "spreads",
            odd: bestSpread,
            pickLabel: labelForMarket("spreads", bestSpread),
            decimal: normalizePriceToDecimal(bestSpread.price),
            edge: 0,
            confidence: bestSpread.point && bestSpread.point > 0 ? 78 : 66,
            valuePriority: bestSpread.point && bestSpread.point > 0 ? 92 : 74,
            category:
              bestSpread.point && bestSpread.point > 0
                ? "PUCK_PROTECTION"
                : "PUCK_ATTACK",
            gameId: game.id,
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            startTime: game.commence_time,
          }
        : null,

      bestTotal
        ? {
            market: "totals",
            odd: bestTotal,
            pickLabel: labelForMarket("totals", bestTotal),
            decimal: normalizePriceToDecimal(bestTotal.price),
            edge: 0,
           confidence:
  typeof bestTotal.point === "number" && bestTotal.point <= 5.5
    ? 72
    : 70,
valuePriority:
  typeof bestTotal.point === "number" && bestTotal.point <= 5.5
    ? 84
    : 80,
category: "TOTALS_CORE",
            gameId: game.id,
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            startTime: game.commence_time,
          }
        : null,
    ].filter(Boolean) as any[];

    

    const filteredCandidates = candidates.filter((p: any) => {
  const american = Number(p?.odd?.price);

  if (!Number.isFinite(american)) return false;

  return american >= -150 && american <= 140;
});

const bestCandidate =
  [...(filteredCandidates.length ? filteredCandidates : candidates)].sort(
    (a, b) => finalNhlPickScore(b) - finalNhlPickScore(a)
  )[0] ?? null;

    if (bestCandidate) {
      globalRankedPicks.push({
        ...bestCandidate,
        pickLabel: buildPickLabelFromCandidate(bestCandidate),
      });
    }

    candidates.forEach((candidate: any) => {
      liveCandidateIndex.set(
        `${String(game.id)}__${buildSelectionKey(candidate)}`,
        {
          ...candidate,
          pickLabel: buildPickLabelFromCandidate(candidate),
        }
      );
    });
  });

  const liveInitialPool = [...globalRankedPicks].sort(
  (a, b) => finalNhlPickScore(b) - finalNhlPickScore(a)
);

  exportPublicSignals(liveInitialPool);

  const refreshedMorningPool =
  storedMorningPool.length > 0
    ? storedMorningPool.map((savedPick: any) => {
        const livePick = liveInitialPool.find(
          (pick: any) =>
            pick.gameId === savedPick.gameId &&
            pick.market === savedPick.market &&
            pick.pickLabel === savedPick.pickLabel
        );

        if (!livePick) {
          return savedPick;
        }

        const originalPrice =
          typeof savedPick.originalPrice === "number"
            ? savedPick.originalPrice
            : typeof savedPick?.odd?.price === "number"
            ? savedPick.odd.price
            : null;

        const livePrice =
          typeof livePick?.odd?.price === "number" ? livePick.odd.price : null;

        const originalPoint =
          typeof savedPick.originalPoint === "number"
            ? savedPick.originalPoint
            : typeof savedPick?.odd?.point === "number"
            ? savedPick.odd.point
            : null;

        const livePoint =
          typeof livePick?.odd?.point === "number" ? livePick.odd.point : null;

        let closingDirection: "up" | "down" | "neutral" = "neutral";

        if (
          typeof originalPrice === "number" &&
          typeof livePrice === "number"
        ) {
          if (savedPick.market === "h2h") {
            // Ej: -130 -> -150 = up / a favor
            // Ej: -130 -> -115 = down / en contra
            if (livePrice < originalPrice) closingDirection = "up";
            if (livePrice > originalPrice) closingDirection = "down";
          }

          if (savedPick.market === "spreads") {
            // Para spread, si el precio se hace más caro en el mismo punto, va a favor
            if (livePrice < originalPrice) closingDirection = "up";
            if (livePrice > originalPrice) closingDirection = "down";

            // Si el punto mejora para el pick, también va a favor
            if (
              typeof originalPoint === "number" &&
              typeof livePoint === "number"
            ) {
              if (originalPoint > 0 && livePoint < originalPoint) {
                closingDirection = "up";
              }

              if (originalPoint > 0 && livePoint > originalPoint) {
                closingDirection = "down";
              }
            }
          }

          if (savedPick.market === "totals") {
            const pickLabel = String(
              savedPick.originalPickLabel ?? savedPick.pickLabel ?? ""
            ).toLowerCase();

            if (
              typeof originalPoint === "number" &&
              typeof livePoint === "number"
            ) {
              if (pickLabel.includes("over")) {
                if (livePoint > originalPoint) closingDirection = "up";
                if (livePoint < originalPoint) closingDirection = "down";
              }

              if (pickLabel.includes("under")) {
                if (livePoint < originalPoint) closingDirection = "up";
                if (livePoint > originalPoint) closingDirection = "down";
              }
            }
          }
        }

        const marketPressure =
          closingDirection === "up"
            ? 70
            : closingDirection === "down"
            ? 40
            : 55;

        const sharpConsensus =
          closingDirection === "up"
            ? 70
            : closingDirection === "down"
            ? 40
            : 55;

        const againstClosing = closingDirection === "down";

        return {
          ...savedPick,

          pickLabel: savedPick.originalPickLabel ?? savedPick.pickLabel,
          market: savedPick.originalMarket ?? savedPick.market,

          originalPickLabel: savedPick.originalPickLabel ?? savedPick.pickLabel,
          originalMarket: savedPick.originalMarket ?? savedPick.market,
          originalPoint,
          originalPrice,
          originalConfidence: savedPick.originalConfidence ?? null,
          originalValuePriority: savedPick.originalValuePriority ?? null,
          originalEdge: savedPick.originalEdge ?? null,

          livePoint,
          livePrice,
          liveConfidence:
            typeof livePick?.confidence === "number" ? livePick.confidence : null,
          liveValuePriority:
            typeof livePick?.valuePriority === "number"
              ? livePick.valuePriority
              : null,
          liveEdge:
            typeof livePick?.edge === "number" ? livePick.edge : null,

          closingDirection,
          marketPressure,
          sharpConsensus,
          againstClosing,

          odd: livePick.odd,
          decimal: livePick.decimal,
          confidence: livePick.confidence,
          valuePriority: livePick.valuePriority,
          category: livePick.category,
          gameId: savedPick.gameId,
          awayTeam: savedPick.awayTeam,
          homeTeam: savedPick.homeTeam,
          startTime: savedPick.startTime,
        };
      })
    : [];

const initialPool =
  storedMorningPool.length > 0 ? refreshedMorningPool : liveInitialPool;

  const pregameEvaluatedPool = evaluatePregamePool(
    initialPool,
    30
  );

  const statusMap = readClosingStatus();

  if (SAVE_MORNING_POOL && !IS_CLOSING_MODE) {
    const morningTop5 = liveInitialPool.slice(0, 5);
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
    const matchingGame = games.find((game: any) => {
      const sameMatch =
        `${game.away_team} vs ${game.home_team}` === entry.game;

      const hasScores =
        Number.isFinite(Number(game.home_score)) &&
        Number.isFinite(Number(game.away_score));

      return sameMatch && hasScores;
    });

    if (!matchingGame) {
      return entry;
    }

    const gradedStatus = gradePick(entry, {
      home_team: matchingGame.home_team,
      away_team: matchingGame.away_team,
      home_score: Number(matchingGame.home_score),
      away_score: Number(matchingGame.away_score),
    });

    return {
      ...entry,
      status: gradedStatus,
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
      NHL Dashboard
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
            key={`nhl-top-${idx}`}
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
              {pick.market === "h2h"
                ? `${pick.pickLabel} ML`
                : pick.pickLabel}
            </div>

            <div style={{ fontSize: 12, marginTop: 6 }}>
              Price: {pick.originalPrice ?? pick.odd?.price ?? "N/A"}
            </div>

            <div style={{ fontSize: 12, marginTop: 4 }}>
              Status: {statusMap[pick.id ?? pick.gameId]?.status ?? pick.status ?? "PENDING"}
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