import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "app/nhl/data/closingStatus.json");

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
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
    console.log("❌ Error leyendo archivo NHL closingStatus:", err);
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
    console.log("❌ Error leyendo NHL closingStatus:", err);
    return {};
  }
}

export function saveClosingStatus(
  statusMap: Record<string, any>,
  dateKey?: string
) {
  try {
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const allData = readClosingStatusFile();
    const targetDate = dateKey ?? getTodayKey();

    allData[targetDate] = statusMap;

    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), "utf-8");
    console.log(`✅ NHL closingStatus guardado para ${targetDate}`);
  } catch (err) {
    console.log("❌ Error guardando NHL closingStatus:", err);
  }
}