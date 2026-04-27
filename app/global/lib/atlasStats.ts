export function calculateAtlasStats(history: any[]) {
  const graded = history.filter(
    (item) => item.status === "WIN" || item.status === "LOSS"
  );

  const wins = graded.filter((item) => item.status === "WIN").length;
  const losses = graded.filter((item) => item.status === "LOSS").length;

  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return {
    wins,
    losses,
    winRate,
  };
}