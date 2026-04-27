import fs from "fs";
import path from "path";
import type { MlbCandidate } from "@/app/mlb/lib/mlbEngine";
import { exportTop5 } from "@/app/mlb/lib/exportTop5";

const dataDir = path.join(process.cwd(), "app", "mlb", "data");
const morningPoolPath = path.join(dataDir, "morningPool.json");

function ensureMlbDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(morningPoolPath)) {
    fs.writeFileSync(morningPoolPath, "[]", "utf-8");
  }
}

export function readMorningPool(): MlbCandidate[] {
  ensureMlbDataDir();

  console.log("📘 MLB readMorningPool path:", morningPoolPath);

  const raw = fs.readFileSync(morningPoolPath, "utf-8");

  if (!raw.trim()) {
    console.log("🔴 MLB morningPool vacío");
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.log("🔴 MLB morningPool no es array");
      return [];
    }

    console.log("🟢 MLB readMorningPool picks:", parsed.length);
    return parsed;
  } catch (error) {
    console.error("❌ Error leyendo MLB morningPool:", error);
    return [];
  }
}

export function saveMorningPool(picks: MlbCandidate[]) {
  ensureMlbDataDir();

  console.log("🟡 MLB saveMorningPool path:", morningPoolPath);
  console.log("🟡 MLB saveMorningPool recibió picks:", picks.length);

  fs.writeFileSync(morningPoolPath, JSON.stringify(picks, null, 2), "utf-8");

  const verify = fs.readFileSync(morningPoolPath, "utf-8");
  console.log("🟢 MLB morningPool guardado:", verify.slice(0, 200));

  exportTop5(picks);
}