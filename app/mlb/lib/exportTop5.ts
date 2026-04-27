import fs from "fs";
import path from "path";

type MlbMorningPick = {
  awayTeam?: string;
  homeTeam?: string;
  teams?: string;
  market?: string;
  line?: number;
  odds?: number;
  pickLabel?: string;
  pick?: string;
  confidence?: number | null;
  valuePriority?: number | null;
  score?: number | null;
  status?: string;
  reviewReason?: string;
  startTime?: string | null;
};

function getTeams(pick: MlbMorningPick) {
  if (pick.awayTeam && pick.homeTeam) {
    return {
      awayTeam: pick.awayTeam,
      homeTeam: pick.homeTeam,
    };
  }

  if (pick.teams && pick.teams.includes(" vs ")) {
    const [awayTeam, homeTeam] = pick.teams.split(" vs ");
    return { awayTeam, homeTeam };
  }

  return {
    awayTeam: "Unknown Away",
    homeTeam: "Unknown Home",
  };
}

function formatMlbPick(pick: MlbMorningPick) {
  const basePick = pick.pickLabel ?? pick.pick ?? "No Pick";

  if (pick.market === "spreads") {
    const line =
      typeof pick.line === "number"
        ? pick.line > 0
          ? `+${pick.line}`
          : `${pick.line}`
        : "";

    return `${basePick} ${line}`.trim();
  }

  if (pick.market === "totals") {
    const line = typeof pick.line === "number" ? `${pick.line}` : "";
    return `${basePick} ${line}`.trim();
  }

  if (pick.market === "ml") {
    return basePick.toLowerCase().includes("ml")
      ? basePick
      : `${basePick} ML`;
  }

  return basePick;
}

export function exportTop5(picks: MlbMorningPick[]) {
  const top5 = Array.isArray(picks)
    ? picks.slice(0, 5).map((pick, index) => {
        const { awayTeam, homeTeam } = getTeams(pick);

        return {
          sport: "MLB",
          rank: index + 1,
          awayTeam,
          homeTeam,
          market: pick.market ?? null,
          pick: formatMlbPick(pick),
          odds: pick.odds ?? null,
          line: pick.line ?? null,
          confidence: pick.confidence ?? null,
          valuePriority: pick.valuePriority ?? null,
          score: pick.score ?? null,
          startTime: pick.startTime ?? null,
          status: pick.status ?? "PENDING",
          reviewReason: pick.reviewReason ?? null,
          isTopSignal: index === 0,
        };
      })
    : [];

  const formatted = {
    sport: "MLB",
    date: new Date().toISOString().split("T")[0],
    top5,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "mlb-top5.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("mlb-top5.json generated successfully in /exports");
}