import fs from "fs";
import path from "path";
import type { SoccerCandidate } from "@/app/soccer/lib/soccerEngine";

function getTeams(pick: SoccerCandidate) {
  if (pick.teams && pick.teams.includes(" vs ")) {
    const [awayTeam, homeTeam] = pick.teams.split(" vs ");

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
    return String(pick.pick).toLowerCase().includes("ml")
      ? pick.pick
      : `${pick.pick} ML`;
  }

  if (pick.market === "totals") {
    const side = String(pick.pick).toLowerCase().includes("over")
      ? "Over"
      : "Under";

    return typeof pick.line === "number" ? `${side} ${pick.line}` : pick.pick;
  }

  if (pick.market === "spreads") {
    const teamName = String(pick.pick)
      .replace(/\s*[+-]?\d+(\.\d+)?$/, "")
      .trim();

    return `${teamName} ${formatSignedLine(pick.line)}`.trim();
  }

  return pick.pick ?? "No Pick";
}

export function exportTop5(picks: SoccerCandidate[]) {
  const top5 = Array.isArray(picks)
    ? picks.slice(0, 5).map((pick, index) => {
        const { awayTeam, homeTeam } = getTeams(pick);

        return {
          sport: "SOCCER",
          rank: index + 1,
          awayTeam,
          homeTeam,
          market: pick.market ?? null,
          pick: formatSoccerPick(pick),
          odds: pick.odds ?? null,
          line: pick.line ?? null,
          confidence: pick.confidence ?? null,
          valuePriority: pick.valuePriority ?? null,
          score: pick.score ?? null,
          startTime: pick.startTime ?? null,
          status: pick.status ?? "PENDING",
          reviewReason: null,
          isTopSignal: index === 0,
        };
      })
    : [];

  const formatted = {
    sport: "SOCCER",
    date: new Date().toISOString().split("T")[0],
    top5,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "soccer-top5.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("soccer-top5.json generated successfully");
}