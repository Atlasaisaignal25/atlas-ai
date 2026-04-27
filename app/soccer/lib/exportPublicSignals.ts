import fs from "fs";
import path from "path";
import type { SoccerCandidate } from "@/app/soccer/lib/soccerEngine";

function getTeams(pick: SoccerCandidate) {
  if (pick.teams && pick.teams.includes(" vs ")) {
    const [homeTeam, awayTeam] = pick.teams.split(" vs ");

    return {
      awayTeam: awayTeam ?? "Unknown Away",
      homeTeam: homeTeam ?? "Unknown Home",
    };
  }

  return {
    awayTeam: "Unknown Away",
    homeTeam: "Unknown Home",
  };
}

function formatSignedLine(line?: number) {
  if (typeof line !== "number" || !Number.isFinite(line)) return "";
  return line > 0 ? `+${line}` : `${line}`;
}

function formatSoccerPick(pick: SoccerCandidate) {
  if (pick.market === "ml") {
    return `${pick.pick} ML`;
  }

  if (pick.market === "totals") {
    const side = String(pick.pick).toLowerCase().includes("over") ? "Over" : "Under";
    return typeof pick.line === "number" ? `${side} ${pick.line}` : pick.pick;
  }

  if (pick.market === "spreads") {
    const teamName = String(pick.pick)
      .replace(/\s*[+-]?\d+(\.\d+)?$/, "")
      .trim();

    if (pick.line === -0.5 || pick.line === 0.5) {
      return `${teamName} ML`;
    }

    return `${teamName} (${formatSignedLine(pick.line)})`;
  }

  return pick.pick ?? "No Pick";
}

export function exportPublicSignals(picks: SoccerCandidate[]) {
  const games = Array.isArray(picks)
    ? picks.map((pick) => {
        const { awayTeam, homeTeam } = getTeams(pick);

        return {
          gameId: pick.gameId,
          awayTeam,
          homeTeam,
          pick: formatSoccerPick(pick),
          status: "PENDING",
        };
      })
    : [];

  const formatted = {
    sport: "SOCCER",
    date: new Date().toISOString().split("T")[0],
    games,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "soccer-public-signals.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("soccer-public-signals.json generated successfully");
}