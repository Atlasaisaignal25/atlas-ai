import fs from "fs";
import path from "path";
import { saveAtlasFeed } from "@/app/lib/saveAtlasFeed";

type GlobalPick = {
  sport: string;
  rank: number;
  awayTeam?: string;
  homeTeam?: string;
  pick: string;
  market: string;
  odds: number | null;
  line: number | null;
  confidence: number | null;
  valuePriority: number | null;
  score: number | null;
  status: string;
  reviewReason?: string | null;
  startTime: string | null;
  isTopSignal: boolean;
  globalScore?: number;
};

function exportsPath(fileName: string) {
  return path.join(process.cwd(), "exports", fileName);
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function readTop5(fileName: string) {
  const filePath = exportsPath(fileName);

  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  return parsed.top5 ?? [];
}

function readMorningRankings(): GlobalPick[] {
  const filePath = exportsPath("global-morning-rankings.json");

  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  if (parsed.date !== todayKey()) return [];

  return parsed.ranked ?? [];
}

function getRankScore(rank: number) {
  if (rank === 1) return 50;
  if (rank === 2) return 42;
  if (rank === 3) return 35;
  if (rank === 4) return 28;
  if (rank === 5) return 22;
  return 10;
}

function getStatusScore(status: string) {
  const normalized = String(status ?? "").toUpperCase();

  if (normalized === "CONFIRMED") return 30;
  if (normalized === "PENDING") return 10;
  if (normalized === "DOWNGRADED") return 5;
  if (normalized === "REMOVED") return -100;

  return 0;
}

function getOddsScore(odds: number | null) {
  if (odds === null) return 0;

  if (odds >= -130 && odds <= 120) return 3;
  if (odds >= -150 && odds < -130) return 1;
  if (odds > 120 && odds <= 140) return 1;

  return -8;
}

function calculateGlobalScore(p: GlobalPick) {
  const contextComponent =
    getRankScore(p.rank) + getStatusScore(p.status);

  const strengthComponent =
    ((p.score ?? 50) * 0.18) + ((p.confidence ?? 50) * 0.12);

  const priceGuardrail = getOddsScore(p.odds);

  return contextComponent + strengthComponent + priceGuardrail;
}

function writeJson(fileName: string, data: any) {
  const exportsDir = path.join(process.cwd(), "exports");

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  fs.writeFileSync(
    exportsPath(fileName),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

function isReviewWindow(startTime: string | null, minutesBefore = 30) {
  if (!startTime) return false;

  const now = new Date();
  const gameTime = new Date(startTime);

  const diffMs = gameTime.getTime() - now.getTime();
  const reviewWindowMs = minutesBefore * 60 * 1000;

  return diffMs <= reviewWindowMs && diffMs >= -10 * 60 * 1000;
}

function buildMorningRankings() {
  const nba = readTop5("nba-top5.json");
  const nhl = readTop5("nhl-top5.json");
  const mlb = readTop5("mlb-top5.json");
  const soccer = readTop5("soccer-top5.json");

  const allPicks: GlobalPick[] = [...nba, ...nhl, ...mlb, ...soccer];

  const validPicks = allPicks.filter(
    (p) => String(p.status ?? "").toUpperCase() !== "REMOVED"
  );

  return validPicks
    .map((p) => ({
      ...p,
      globalScore: calculateGlobalScore(p),
    }))
    .sort((a, b) => (b.globalScore ?? 0) - (a.globalScore ?? 0));
}

function getLiveStatus(pick: GlobalPick) {
  const sportFile =
    pick.sport === "NBA"
      ? "nba-top5.json"
      : pick.sport === "NHL"
      ? "nhl-top5.json"
      : pick.sport === "MLB"
      ? "mlb-top5.json"
      : "soccer-top5.json";

  const latest = readTop5(sportFile);

  const match = latest.find(
    (p: any) =>
      p.pick === pick.pick &&
      p.awayTeam === pick.awayTeam &&
      p.homeTeam === pick.homeTeam
  );

  return match?.status ?? pick.status;
}

function resolveOfficialTopSignal(ranked: GlobalPick[]) {
  for (const pick of ranked) {
    const liveStatus = getLiveStatus(pick);
const status = String(liveStatus ?? "").toUpperCase();

    if (status === "REMOVED") {
      continue;
    }

    if (status === "DOWNGRADED") {
      continue;
    }

    const inWindow = isReviewWindow(pick.startTime, 30);

    if (!inWindow && status === "PENDING") {
      return {
        ...pick,
        officialStatus: "WAITING_FOR_VALIDATION",
        officialReason: "GLOBAL_TOP_SIGNAL_NOT_IN_CLOSING_WINDOW",
      };
    }

    if (status === "CONFIRMED") {
      return {
        ...pick,
        officialStatus: "OFFICIAL",
        officialReason: "CONFIRMED_BY_CLOSING_VALIDATION",
      };
    }

    if (inWindow && status === "PENDING") {
      return {
        ...pick,
        officialStatus: "WAITING_FOR_SPORT_ENGINE",
        officialReason: "IN_CLOSING_WINDOW_BUT_STILL_PENDING",
      };
    }

    return {
      ...pick,
      officialStatus: "WAITING_FOR_VALIDATION",
      officialReason: "PENDING",
    };
  }

  return null;
}

export async function buildGlobalTopSignal() {
  let ranked = readMorningRankings();

  if (!ranked.length) {
    ranked = buildMorningRankings();

    writeJson("global-morning-rankings.json", {
      date: todayKey(),
      ranked,
    });

    console.log("SAVING MORNING RANKINGS...");
await saveAtlasFeed("global-morning-rankings", {
  date: todayKey(),
  ranked,
});
console.log("SAVED MORNING RANKINGS");

    await saveAtlasFeed("global-morning-rankings", {
  date: todayKey(),
  ranked,
});

    console.log("global-morning-rankings.json generated");
  } else {
    console.log("global-morning-rankings.json reused");
  }

  const topSignal = resolveOfficialTopSignal(ranked);

  writeJson("global-top-signal.json", {
    date: todayKey(),
    topSignal,
    ranked,
  });

  console.log("SAVING TO SUPABASE...");
await saveAtlasFeed("global-top-signal", {
  date: todayKey(),
  topSignal,
  ranked,
});
console.log("SAVED GLOBAL TOP SIGNAL");

  await saveAtlasFeed("global-top-signal", {
  date: todayKey(),
  topSignal,
  ranked,
});

  console.log("global-top-signal.json generated");
}