import fs from "fs";
import path from "path";
import type { ClosingStatusEntry } from "@/app/mlb/lib/closingStatus";

export function exportSignals(entries: ClosingStatusEntry[]) {
  const games = Array.isArray(entries)
    ? entries.map((entry) => ({
        gameId: entry.gameId,
        pick: entry.pick,
        status: "PENDING",
      }))
    : [];

  const formatted = {
    sport: "MLB",
    date: new Date().toISOString().split("T")[0],
    games,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "mlb-signals.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("mlb-signals.json generated successfully");
}