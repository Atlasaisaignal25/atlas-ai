import fs from "fs";
import path from "path";

type ClosingGame = {
  awayTeam: string;
  homeTeam: string;
  pickLabel?: string;
};

type ClosingStatusData = Record<string, Record<string, ClosingGame>>;

export function exportSignals(closingData: ClosingStatusData) {
  const dateKey = Object.keys(closingData)[0];

  if (!dateKey) {
    console.log("No date found in closingStatus data");
    return;
  }

  const dayGames = closingData[dateKey];

  const games = Object.values(dayGames).map((game) => ({
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    pick: game.pickLabel ?? "No Pick",
    status: "PENDING",
  }));

  const formatted = {
    sport: "NBA",
    date: dateKey,
    games,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "nba-signals.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2));

  console.log("nba-signals.json generated successfully");
}