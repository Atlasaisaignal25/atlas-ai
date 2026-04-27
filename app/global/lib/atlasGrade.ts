export function gradeAtlasBestPick(entry: any, sourcePicks: any[]) {
  const match = sourcePicks.find((pick: any) => {
    const sameGame = `${pick.awayTeam} vs ${pick.homeTeam}` === entry.game;
    const samePick = pick.pickLabel === entry.pick;
    return sameGame && samePick;
  });

  if (!match) return "PENDING";

  const status = String(match.status ?? "").toUpperCase();

  if (status === "WIN") return "WIN";
  if (status === "LOSS") return "LOSS";

  return "PENDING";
}

export function gradeAtlasBestParlay(entry: any, sourcePicksBySport: Record<string, any[]>) {
  const legs = Array.isArray(entry.legs) ? entry.legs : [];
  if (!legs.length) return "PENDING";

  let hasPending = false;

  for (const leg of legs) {
    const sport = String(leg.sport ?? "");
    const sourcePicks = sourcePicksBySport[sport] ?? [];

    const match = sourcePicks.find((pick: any) => {
      const sameGame = `${pick.awayTeam} vs ${pick.homeTeam}` === leg.game;
      const samePick = pick.pickLabel === leg.pick;
      return sameGame && samePick;
    });

    if (!match) {
      hasPending = true;
      continue;
    }

    const status = String(match.status ?? "").toUpperCase();

    if (status === "LOSS") return "LOSS";
    if (status !== "WIN") hasPending = true;
  }

  if (hasPending) return "PENDING";
  return "WIN";
}