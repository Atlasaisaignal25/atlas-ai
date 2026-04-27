import fs from "fs";
import path from "path";

export type SoccerGradeStatus = "won" | "lost" | "cancelled";

export type SoccerHistoryEntry = {
  gameId: string;
  teams: string;
  market: string;
  pick: string;
  line?: number;
  status: SoccerGradeStatus;
  gradedAt: string;
};

const dataDir = path.join(process.cwd(), "app", "soccer", "data");
const picksHistoryPath = path.join(dataDir, "picksHistory.json");

function ensureSoccerDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function readPicksHistory(): SoccerHistoryEntry[] {
  ensureSoccerDataDir();

  if (!fs.existsSync(picksHistoryPath)) {
    return [];
  }

  const raw = fs.readFileSync(picksHistoryPath, "utf-8");

  if (!raw.trim()) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error reading picksHistory.json:", error);
    return [];
  }
}

export function savePicksHistory(entries: SoccerHistoryEntry[]) {
  ensureSoccerDataDir();

  fs.writeFileSync(picksHistoryPath, JSON.stringify(entries, null, 2), "utf-8");
}

// -----------------------------
// ADD GRADED PICK TO HISTORY
// -----------------------------

export function addPickToHistory(entry: SoccerHistoryEntry) {
  const current = readPicksHistory();

  const alreadyExists = current.some(
    (item) =>
      item.gameId === entry.gameId &&
      item.market === entry.market &&
      item.pick === entry.pick &&
      item.line === entry.line
  );

  if (alreadyExists) {
    return current;
  }

  const updated = [entry, ...current];
  savePicksHistory(updated);
  return updated;
}

// -----------------------------
// MANUAL GRADE PICK
// -----------------------------

export function manuallyGradePick(
  pick: {
    gameId: string;
    teams: string;
    market: string;
    pick: string;
    line?: number;
  },
  result: SoccerGradeStatus
) {
  return addPickToHistory({
    gameId: pick.gameId,
    teams: pick.teams,
    market: pick.market,
    pick: pick.pick,
    line: pick.line,
    status: result,
    gradedAt: new Date().toISOString(),
  });
}