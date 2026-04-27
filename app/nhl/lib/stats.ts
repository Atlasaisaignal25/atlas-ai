export function calculateStats(history: any[]) {
  const confirmedGraded = history.filter(
    (pick) =>
      pick.pregameStatus === "CONFIRMED" &&
      (pick.status === "WIN" || pick.status === "LOSS")
  );

  const topSignalGraded = confirmedGraded.filter(
    (pick) => Number(pick.rank ?? 0) === 1
  );

  const topSignalWins = topSignalGraded.filter((pick) => pick.status === "WIN").length;
  const topSignalLosses = topSignalGraded.filter((pick) => pick.status === "LOSS").length;

  const topSignalTotal = topSignalWins + topSignalLosses;
  const topSignalWinRate =
    topSignalTotal > 0 ? Math.round((topSignalWins / topSignalTotal) * 100) : 0;

  const mlWins = confirmedGraded.filter(
    (pick) => pick.market === "h2h" && pick.status === "WIN"
  ).length;
  const mlLosses = confirmedGraded.filter(
    (pick) => pick.market === "h2h" && pick.status === "LOSS"
  ).length;

  const totalWins = confirmedGraded.filter(
    (pick) => pick.market === "totals" && pick.status === "WIN"
  ).length;
  const totalLosses = confirmedGraded.filter(
    (pick) => pick.market === "totals" && pick.status === "LOSS"
  ).length;

  const spreadWins = confirmedGraded.filter(
    (pick) => pick.market === "spreads" && pick.status === "WIN"
  ).length;
  const spreadLosses = confirmedGraded.filter(
    (pick) => pick.market === "spreads" && pick.status === "LOSS"
  ).length;

  return {
    wins: topSignalWins,
    losses: topSignalLosses,
    winRate: topSignalWinRate,
    ml: `${mlWins}-${mlLosses}`,
    totals: `${totalWins}-${totalLosses}`,
    spreads: `${spreadWins}-${spreadLosses}`,
  };
}