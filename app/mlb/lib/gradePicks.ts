import fs from "fs";
import path from "path";

export type MlbGradeStatus = "won" | "lost" | "cancelled";

export type MlbHistoryEntry = {
  gameId: string;
  teams: string;
  market: string;
  pick: string;
  line?: number;
  status: MlbGradeStatus;
  gradedAt: string;
};

const dataDir = path.join(process.cwd(), "app", "mlb", "data");
const picksHistoryPath = path.join(dataDir, "picksHistory.json");

function ensureMlbDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function readPicksHistory(): MlbHistoryEntry[] {
  ensureMlbDataDir();

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
    console.error("Error reading MLB picksHistory.json:", error);
    return [];
  }
}

export function savePicksHistory(entries: MlbHistoryEntry[]) {
  ensureMlbDataDir();
  fs.writeFileSync(picksHistoryPath, JSON.stringify(entries, null, 2), "utf-8");
}

export function addPickToHistory(entry: MlbHistoryEntry) {
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

export function manuallyGradePick(
  pick: {
    gameId: string;
    teams: string;
    market: string;
    pick: string;
    line?: number;
  },
  result: MlbGradeStatus
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