import { buildSoccerFullPool, buildSoccerPool } from "@/app/soccer/lib/soccerEngine";
import { saveMorningPool, readMorningPool } from "@/app/soccer/lib/morningPool";
import {
  applyStatusToPool,
  syncPregameStatusesToClosingStatus,
} from "@/app/soccer/lib/closingStatus";
import { readPicksHistory } from "@/app/soccer/lib/gradePicks";
import { calculateSoccerStats } from "@/app/soccer/lib/stats";
import { evaluatePregamePool } from "@/app/soccer/lib/pregameEngine";
import { soccerLeagues } from "@/app/soccer/data/soccerLeagues";
import { soccerMode } from "@/app/soccer/data/soccerMode";
import { exportPublicSignals } from "@/app/soccer/lib/exportPublicSignals";
import { exportTop5 } from "@/app/soccer/lib/exportTop5";

export default async function SoccerPage() {
  const oddsResponses = await Promise.all(
    soccerLeagues.map(async (league) => {
      const res = await fetch(
        `http://localhost:3000/api/odds?sport=${league.key}&markets=h2h,spreads,totals&regions=us&oddsFormat=american`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    })
  );

  const allSoccerGames = oddsResponses.flat();
  const now = new Date();

  const todayGames = allSoccerGames.filter((game: any) => {
    const gameDate = new Date(game.commence_time);
    const diffHours =
      (gameDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    return diffHours >= -6 && diffHours <= 18;
  });

  const generatedFullPool = buildSoccerFullPool(todayGames);
const generatedPool = buildSoccerPool(todayGames);

console.log("SOCCER todayGames:", todayGames.length);
console.log("SOCCER generatedFullPool length:", generatedFullPool.length);
console.log("SOCCER generatedPool length:", generatedPool.length);
console.log("SOCCER generatedFullPool sample:", generatedFullPool[0]);
console.log("SOCCER generatedPool sample:", generatedPool[0]);
console.log("SOCCER saveMorningPool flag:", soccerMode.saveMorningPool);

const isClosingMode = soccerMode.isClosingMode;

 if (soccerMode.saveMorningPool) {
  saveMorningPool(generatedFullPool);
}

  const savedPool = readMorningPool();
console.log("SOCCER savedPool length:", savedPool.length);
console.log("SOCCER savedPool sample:", savedPool[0]);

const allSignalsPool = generatedFullPool;
console.log("SOCCER allSignalsPool length:", allSignalsPool.length);

  const nowMs = Date.now();

  const closingEligiblePool = allSignalsPool.filter((pick) => {
    const startMs = new Date(pick.startTime).getTime();
    const diffMinutes = (startMs - nowMs) / (1000 * 60);

    return diffMinutes <= 30 && diffMinutes >= 0;
  });

  const evaluatedClosingPool = evaluatePregamePool(closingEligiblePool);

  const basePool = allSignalsPool.map((pick) => ({
    ...pick,
    status: "pending",
  }));

  if (isClosingMode) {
    syncPregameStatusesToClosingStatus(evaluatedClosingPool);
  }

  const finalPool = isClosingMode
    ? applyStatusToPool(basePool)
    : basePool;

    console.log("SOCCER finalPool length:", finalPool.length);
console.log("SOCCER finalPool sample:", finalPool[0]);

  const history = readPicksHistory();
  const stats = calculateSoccerStats();
  const topSignal = finalPool[0];
  const topFiveSignals = finalPool.slice(0, 5);
  
  exportTop5(topFiveSignals);

  // export correcto: al final del flujo, no antes
  exportPublicSignals(finalPool);
  
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
        Soccer Dashboard
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
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {history.filter((pick) => pick.market === "ml").length}
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
            <div style={{ fontSize: 11, opacity: 0.65 }}>SPREADS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {history.filter((pick) => pick.market === "spreads").length}
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
            <div style={{ fontSize: 11, opacity: 0.65 }}>TOTALS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {history.filter((pick) => pick.market === "totals").length}
            </div>
          </div>
        </div>
      </div>

      {topFiveSignals.length ? (
        <div>
          {topFiveSignals.map((pick, idx) => (
            <div
              key={`${pick.gameId}-${pick.market}-${pick.pick}-${idx}`}
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
                #{idx + 1} {pick.teams}
              </div>

              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                Start:{" "}
                {new Date(pick.startTime).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: "America/New_York",
                })}
              </div>

              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
  {pick.market === "ml" &&
  pick.pick.toLowerCase() !== "draw" &&
  pick.pick.toLowerCase() !== "empate" &&
  pick.pick.toLowerCase() !== "tie"
    ? `${pick.pick} ML`
    : pick.pick}
</div>

              <div style={{ fontSize: 12, marginTop: 6 }}>
                Price: {pick.odds ?? "N/A"}
              </div>

              <div style={{ fontSize: 12, marginTop: 4 }}>
                Status:{" "}
                <span
                  style={{
                    color:
                      pick.status === "confirmed"
                        ? "#7CFC98"
                        : pick.status === "downgraded"
                        ? "#FFD700"
                        : pick.status === "removed"
                        ? "#ff8b8b"
                        : "#ccc",
                    fontWeight: 800,
                  }}
                >
                  {pick.status?.toUpperCase() ?? "PENDING"}
                </span>
              </div>

              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>
                Market: {pick.market.toUpperCase()}
                {pick.line !== undefined ? ` • Line: ${pick.line}` : ""}
                {` • Edge: ${pick.edge?.toFixed(2) ?? "0.00"}%`}
                {` • Internal: ${pick.internalScore?.toFixed(1) ?? "0.0"}`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ opacity: 0.7 }}>No ranked picks found.</div>
      )}

      <h2
        style={{
          fontSize: 18,
          fontWeight: 800,
          marginTop: 28,
          marginBottom: 12,
        }}
      >
        Picks History
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {history.map((pick, index) => (
          <div
            key={`${pick.gameId}-${pick.market}-${pick.pick}-${index}`}
            style={{
              background: "#111",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                {pick.market.toUpperCase()}
              </div>

              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background:
                    pick.status === "won"
                      ? "#0f2a1f"
                      : pick.status === "lost"
                      ? "#2a0f0f"
                      : "#1a1a1a",
                  color:
                    pick.status === "won"
                      ? "#7CFC98"
                      : pick.status === "lost"
                      ? "#ff8b8b"
                      : "#ddd",
                  border: "1px solid #333",
                }}
              >
                {pick.status.toUpperCase()}
              </div>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {pick.teams}
            </div>

            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
              {pick.pick}
            </div>

            {pick.line !== undefined && (
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>
                Line: {pick.line}
              </div>
            )}

            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
              {new Date(pick.gradedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "America/New_York",
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}