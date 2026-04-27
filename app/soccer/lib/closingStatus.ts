import fs from "fs";
import path from "path";

export type SoccerPickStatus =
  | "pending"
  | "confirmed"
  | "downgraded"
  | "removed"
  | "won"
  | "lost"
  | "cancelled";

export type ClosingStatusEntry = {
  gameId: string;
  market: string;
  pick: string;
  status: SoccerPickStatus;
  updatedAt: string;
};

const dataDir = path.join(process.cwd(), "app", "soccer", "data");
const closingStatusPath = path.join(dataDir, "closingStatus.json");

function ensureSoccerDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function readClosingStatus(): ClosingStatusEntry[] {
  ensureSoccerDataDir();

  if (!fs.existsSync(closingStatusPath)) {
    return [];
  }

  const raw = fs.readFileSync(closingStatusPath, "utf-8");

  if (!raw.trim()) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error reading closingStatus.json:", error);
    return [];
  }
}

export function saveClosingStatus(entries: ClosingStatusEntry[]) {
  ensureSoccerDataDir();

  fs.writeFileSync(closingStatusPath, JSON.stringify(entries, null, 2), "utf-8");
}

export function syncPregameStatusesToClosingStatus(pool: any[]) {
  const entries: ClosingStatusEntry[] = pool.map((pick) => ({
    gameId: pick.gameId,
    market: pick.market,
    pick: pick.pick,
    status: pick.status,
    updatedAt: new Date().toISOString(),
  }));

  saveClosingStatus(entries);
  return entries;
}

// -----------------------------
// APPLY STATUS TO POOL
// -----------------------------

export function applyStatusToPool(pool: any[]) {
  const statuses = readClosingStatus();

  return pool.map((pick) => {
    const match = statuses.find(
      (s) =>
        s.gameId === pick.gameId &&
        s.market === pick.market &&
        s.pick === pick.pick
    );

    if (!match) {
      return pick;
    }

    return {
      ...pick,
      status: match.status,
    };
  });
}