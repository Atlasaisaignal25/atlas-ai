import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "app/nba/data/closingStatus.json");

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function readClosingStatusFile(): Record<string, Record<string, any>> {
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
    console.log("❌ Error leyendo archivo NBA closingStatus:", err);
    return {};
  }
}

export function readClosingStatus(dateKey?: string): Record<string, any> {
  try {
    const allData = readClosingStatusFile();
    const targetDate = dateKey ?? getTodayKey();

    const dayData = allData[targetDate];
    return dayData && typeof dayData === "object" && !Array.isArray(dayData)
      ? dayData
      : {};
  } catch (err) {
    console.log("❌ Error leyendo NBA closingStatus:", err);
    return {};
  }
}

export function saveClosingStatus(statusMap: Record<string, any>, dateKey?: string) {
  try {
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const allData = readClosingStatusFile();
    const targetDate = dateKey ?? getTodayKey();

    allData[targetDate] = statusMap;

    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), "utf-8");
    return allData;
    console.log(`✅ NBA closingStatus guardado para ${targetDate}`);
  } catch (err) {
    console.log("❌ Error guardando NBA closingStatus:", err);
  }
}