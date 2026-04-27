import fs from "fs";
import path from "path";

type MorningPick = {
  awayTeam?: string;
  homeTeam?: string;
  teams?: string;
  market?: string;
  pickLabel?: string;
  pick?: string;
  odd?: {
    price?: number;
    point?: number;
  };
  originalPrice?: number | null;
  livePrice?: number | null;
  originalPoint?: number | null;
  livePoint?: number | null;
  confidence?: number | null;
  valuePriority?: number | null;
  score?: number | null;
  status?: string;
  reviewReason?: string;
  startTime?: string | null;
};

type MorningPoolData = Record<string, MorningPick[]>;

function getTeams(pick: MorningPick) {
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

function formatNbaPick(pick: MorningPick) {
  const basePick = pick.pickLabel ?? pick.pick ?? "No Pick";

  if (pick.market === "h2h" && !basePick.toLowerCase().includes("ml")) {
    return `${basePick} ML`;
  }

  return basePick;
}

function getOdds(pick: MorningPick) {
  return pick.originalPrice ?? pick.livePrice ?? pick.odd?.price ?? null;
}

function getLine(pick: MorningPick) {
  return pick.originalPoint ?? pick.livePoint ?? pick.odd?.point ?? null;
}

export function exportTop5(morningData: MorningPoolData) {
  const dateKey = Object.keys(morningData)[0];

  if (!dateKey) {
    console.log("No date found in morningPool data");
    return;
  }

  const dayGames = Array.isArray(morningData[dateKey])
    ? morningData[dateKey]
    : [];

  const top5 = dayGames.slice(0, 5).map((pick, index) => {
    const { awayTeam, homeTeam } = getTeams(pick);

    return {
      sport: "NBA",
      rank: index + 1,
      awayTeam,
      homeTeam,
      market: pick.market ?? null,
      pick: formatNbaPick(pick),
      odds: getOdds(pick),
      line: getLine(pick),
      confidence: pick.confidence ?? null,
      valuePriority: pick.valuePriority ?? null,
      score: pick.score ?? null,
      startTime: pick.startTime ?? null,
      status: pick.status ?? "PENDING",
      reviewReason: pick.reviewReason ?? null,
      isTopSignal: index === 0,
    };
  });

  const formatted = {
    sport: "NBA",
    date: dateKey,
    top5,
  };

  const exportsDir = path.join(process.cwd(), "exports");
  const filePath = path.join(exportsDir, "nba-top5.json");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2), "utf-8");

  console.log("nba-top5.json generated successfully");
}