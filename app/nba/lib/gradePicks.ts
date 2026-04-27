type GameResult = {
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
};

export function gradePick(pick: any, result: GameResult) {
  const { home_team, away_team, home_score, away_score } = result;

  const pickLabel = String(pick.pick ?? "").toLowerCase();

  // 👉 MONEYLINE
  if (pick.market === "h2h") {
    if (pickLabel.includes(home_team.toLowerCase())) {
      return home_score > away_score ? "WIN" : "LOSS";
    }

    if (pickLabel.includes(away_team.toLowerCase())) {
      return away_score > home_score ? "WIN" : "LOSS";
    }
  }

  // 👉 TOTALS
  if (pick.market === "totals") {
    const total = home_score + away_score;

    const match = pickLabel.match(/\((.*?)\)/);
    const line = match ? Number(match[1]) : null;
    if (line === null || !Number.isFinite(line)) {
  return "PENDING";
}

    if (!Number.isFinite(line)) return "PENDING";

    if (pickLabel.includes("over")) {
      return total > line ? "WIN" : "LOSS";
    }

    if (pickLabel.includes("under")) {
      return total < line ? "WIN" : "LOSS";
    }
  }

  // 👉 SPREADS
  if (pick.market === "spreads") {
    const match = pickLabel.match(/\((.*?)\)/);
    const spread = match ? Number(match[1]) : NaN;

if (!Number.isFinite(spread)) return "PENDING";
    if (pickLabel.includes(home_team.toLowerCase())) {
      return home_score + spread > away_score ? "WIN" : "LOSS";
    }

    if (pickLabel.includes(away_team.toLowerCase())) {
      return away_score + spread > home_score ? "WIN" : "LOSS";
    }
  }

  return "PENDING";
}