import fs from "fs";
import path from "path";
import type { MlbCandidate } from "@/app/mlb/lib/mlbEngine";

function getTeams(pick: MlbCandidate) {
  if (pick.teams && pick.teams.includes(" vs ")) {
    const [awayTeam, homeTeam] = pick.teams.split(" vs ");
    return {
      awayTeam,
      homeTeam,
    };
  }

  return {
    awayTeam: "Unknown Away",
    homeTeam: "Unknown Home",
  };
}

export function exportPublicSignals(picks: MlbCandidate[]) {
  const games = Array.isArray(picks)
    ? picks.map((pick) => {
        const { awayTeam, homeTeam } = getTeams(pick);

        return {
          gameId: pick.gameId,
          awayTeam,
          homeTeam,
          pick: pick.pick ?? "No Pick",
          status: "PENDING",
        };
      })
    : [];

  const formatted = {
    sport: "MLB",
    date: new Date().toISOString().split("T")[0],
    games,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "mlb-public-signals.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("mlb-public-signals.json generated successfully");
}