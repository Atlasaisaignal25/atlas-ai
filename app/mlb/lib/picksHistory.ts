import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "app/mlb/data/picksHistory.json");

function ensureFileExists() {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readPicksHistory(): any[] {
  try {
    ensureFileExists();

    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.log("❌ Error leyendo MLB picksHistory:", err);
    return [];
  }
}

export function savePicksHistory(history: any[]) {
  try {
    ensureFileExists();
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
    console.log("✅ MLB picksHistory guardado");
  } catch (err) {
    console.log("❌ Error guardando MLB picksHistory:", err);
  }
}

export function appendPicksHistory(entries: any[]) {
  try {
    const history = readPicksHistory();
    savePicksHistory([...history, ...entries]);
  } catch (err) {
    console.log("❌ Error agregando MLB picksHistory:", err);
  }
}

export function updatePickHistoryGrades(
  results: Array<{
    away_team: string;
    home_team: string;
    home_score: number;
    away_score: number;
  }>,
  gradePick: (entry: any, result: any) => "WIN" | "LOSS" | "PUSH" | "PENDING"
) {
  try {
    const history = readPicksHistory();

    const updated = history.map((entry) => {
      if (
        entry.status === "WIN" ||
        entry.status === "LOSS" ||
        entry.status === "PUSH"
      ) {
        return entry;
      }

      const result = results.find(
        (r) =>
          r.away_team === entry.awayTeam &&
          r.home_team === entry.homeTeam
      );

      if (!result) {
        return entry;
      }

      const gradedStatus = gradePick(
        {
          pick: entry.pick,
          market: entry.market,
        },
        result
      );

      return {
        ...entry,
        status: gradedStatus,
        gradedAt: new Date().toISOString(),
        home_score: result.home_score,
        away_score: result.away_score,
      };
    });

    savePicksHistory(updated);
    return updated;
  } catch (err) {
    console.log("❌ Error actualizando grades MLB:", err);
    return [];
  }
}