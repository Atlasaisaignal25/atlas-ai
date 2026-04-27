import fs from "fs";
import path from "path";

type PublicSignalPick = {
  gameId: string | number;
  awayTeam?: string;
  homeTeam?: string;
  pickLabel?: string;
};

export function exportPublicSignals(picks: PublicSignalPick[]) {
  const games = Array.isArray(picks)
    ? picks.map((pick) => ({
        gameId: pick.gameId,
        awayTeam: pick.awayTeam ?? "Unknown Away",
        homeTeam: pick.homeTeam ?? "Unknown Home",
        pick: pick.pickLabel ?? "No Pick",
        status: "PENDING",
      }))
    : [];

  const formatted = {
    sport: "NBA",
    date: new Date().toISOString().split("T")[0],
    games,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "nba-public-signals.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("nba-public-signals.json generated successfully");
}