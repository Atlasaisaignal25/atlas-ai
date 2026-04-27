import { readPicksHistory } from "@/app/mlb/lib/gradePicks";

export function calculateMlbStats() {
  const history = readPicksHistory();

  let wins = 0;
  let losses = 0;
  let cancelled = 0;

  const marketStats: Record<
    string,
    { wins: number; losses: number; total: number }
  > = {};

  for (const pick of history) {
    if (pick.status === "won") wins++;
    if (pick.status === "lost") losses++;
    if (pick.status === "cancelled") cancelled++;

    if (!marketStats[pick.market]) {
      marketStats[pick.market] = {
        wins: 0,
        losses: 0,
        total: 0,
      };
    }

    if (pick.status === "won") {
      marketStats[pick.market].wins++;
    }

    if (pick.status === "lost") {
      marketStats[pick.market].losses++;
    }

    marketStats[pick.market].total++;
  }

  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : "0.00";

  return {
    wins,
    losses,
    cancelled,
    total,
    winRate,
    marketStats,
  };
}