import fs from "fs";
import path from "path";
import type { SoccerCandidate } from "@/app/soccer/lib/soccerEngine";
import { exportTop5 } from "@/app/soccer/lib/exportTop5";

const dataDir = path.join(process.cwd(), "app", "soccer", "data");
const morningPoolPath = path.join(dataDir, "morningPool.json");

export function ensureSoccerDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function readMorningPool(): SoccerCandidate[] {
  ensureSoccerDataDir();

  if (!fs.existsSync(morningPoolPath)) {
    return [];
  }

  const raw = fs.readFileSync(morningPoolPath, "utf-8");

  if (!raw.trim()) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error reading morningPool.json:", error);
    return [];
  }
}

export function saveMorningPool(picks: SoccerCandidate[]) {
  ensureSoccerDataDir();

  fs.writeFileSync(morningPoolPath, JSON.stringify(picks, null, 2), "utf-8");

  exportTop5(picks);
}