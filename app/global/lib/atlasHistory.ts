import fs from "fs";
import path from "path";

const bestPickHistoryPath = path.join(
  process.cwd(),
  "app/atlas/data/bestPickHistory.json"
);

function ensureFile(filePath: string) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
  }
}

export function readBestPickHistory(): any[] {
  try {
    ensureFile(bestPickHistoryPath);

    const raw = fs.readFileSync(bestPickHistoryPath, "utf-8").trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.log("Error reading Atlas bestPickHistory:", err);
    return [];
  }
}

export function saveBestPickHistory(history: any[]) {
  try {
    ensureFile(bestPickHistoryPath);

    fs.writeFileSync(
      bestPickHistoryPath,
      JSON.stringify(Array.isArray(history) ? history : [], null, 2),
      "utf-8"
    );
  } catch (err) {
    console.log("Error saving Atlas bestPickHistory:", err);
  }
}