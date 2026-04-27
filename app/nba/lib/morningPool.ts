import fs from "fs";
import path from "path";
import { exportTop5 } from "@/app/nba/lib/exportTop5";

const filePath = path.join(process.cwd(), "app/nba/data/morningPool.json");

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function readMorningPoolFile(): Record<string, any[]> {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    const raw = fs.readFileSync(filePath, "utf-8").trim();

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }

    return {};
  } catch (err) {
    console.log("❌ Error leyendo archivo NBA morningPool:", err);
    return {};
  }
}

export function readMorningPool(dateKey?: string): any[] {
  try {
    const allData = readMorningPoolFile();
    const targetDate = dateKey ?? getTodayKey();

    return Array.isArray(allData[targetDate]) ? allData[targetDate] : [];
  } catch (err) {
    console.log("❌ Error leyendo NBA morningPool:", err);
    return [];
  }
}

function enrichMorningPick(pick: any) {
  return {
    ...pick,

    // Identidad congelada del pick
    originalPickLabel: pick?.pickLabel ?? "N/A",
    originalMarket: pick?.market ?? null,

    // Línea y precio originales de la mañana
    originalPoint:
      typeof pick?.odd?.point === "number" ? pick.odd.point : null,
    originalPrice:
      typeof pick?.odd?.price === "number" ? pick.odd.price : null,

    // Métricas originales de la mañana
    originalConfidence:
      typeof pick?.confidence === "number" ? pick.confidence : null,
    originalValuePriority:
      typeof pick?.valuePriority === "number" ? pick.valuePriority : null,
    originalEdge:
      typeof pick?.edge === "number" ? pick.edge : null,

    // Datos live iniciales, arrancan iguales al snapshot
    livePoint:
      typeof pick?.odd?.point === "number" ? pick.odd.point : null,
    livePrice:
      typeof pick?.odd?.price === "number" ? pick.odd.price : null,
    liveConfidence:
      typeof pick?.confidence === "number" ? pick.confidence : null,
    liveValuePriority:
      typeof pick?.valuePriority === "number" ? pick.valuePriority : null,
    liveEdge:
      typeof pick?.edge === "number" ? pick.edge : null,
  };
}

export function saveMorningPool(picks: any[], dateKey?: string) {
  try {
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const allData = readMorningPoolFile();
    const targetDate = dateKey ?? getTodayKey();

    allData[targetDate] = Array.isArray(picks)
      ? picks.map((pick) => enrichMorningPick(pick))
      : [];

    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), "utf-8");
    exportTop5(allData);
    console.log(`✅ NBA Morning Pool guardado para ${targetDate}`);
  } catch (err) {
    console.log("❌ Error guardando NBA morningPool:", err);
  }
}