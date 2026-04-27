import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "app/nba/data/picksHistory.json");

export function readPicksHistory(): any[] {
  try {
    if (!fs.existsSync(filePath)) return [];

    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return [];

    return JSON.parse(raw);
  } catch (err) {
    console.log("❌ Error leyendo picksHistory:", err);
    return [];
  }
}

export function savePicksHistory(picks: any[]) {
  try {
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(picks, null, 2), "utf-8");
    console.log("✅ Picks history guardado");
  } catch (err) {
    console.log("❌ Error guardando picksHistory:", err);
  }
}