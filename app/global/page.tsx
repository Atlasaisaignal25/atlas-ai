import fs from "fs";
import path from "path";

function readGlobalTopSignal() {
  const filePath = path.join(process.cwd(), "exports", "global-top-signal.json");

  if (!fs.existsSync(filePath)) {
    return {
      date: null,
      topSignal: null,
      ranked: [],
    };
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function getStatusColor(status?: string) {
  const s = String(status ?? "").toUpperCase();

  if (s === "CONFIRMED") return "#7CFC98";
  if (s === "DOWNGRADED") return "#FFD700";
  if (s === "REMOVED") return "#ff8b8b";

  return "#ccc";
}

function getOfficialLabel(pick: any) {
  if (pick?.officialStatus === "OFFICIAL") return "OFFICIAL TOP SIGNAL";
  if (pick?.officialStatus === "WAITING_FOR_VALIDATION") return "WAITING VALIDATION";
  if (pick?.officialStatus === "WAITING_FOR_SPORT_ENGINE") return "WAITING SPORT ENGINE";

  return "TOP SIGNAL";
}

export default function GlobalTopSignalPage() {
  const data = readGlobalTopSignal();

  const ranked = Array.isArray(data.ranked) ? data.ranked : [];
  const topSignal = data.topSignal ?? ranked[0] ?? null;

  return (
    <div
      style={{
        padding: 20,
        background: "#0b0b0b",
        minHeight: "100vh",
        fontFamily: "system-ui",
        color: "#fff",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 20,
        }}
      >
        Global Top Signal
      </h1>

      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              background: "#ffcc00",
              color: "#000",
              padding: "6px 12px",
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            PREMIUM GLOBAL SIGNALS
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>DATE</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {data.date ?? "N/A"}
            </div>
          </div>

          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>TOP SPORT</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {topSignal?.sport ?? "N/A"}
            </div>
          </div>

          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>STATUS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {topSignal?.officialStatus ?? topSignal?.status ?? "PENDING"}
            </div>
          </div>

          <div
            style={{
              background: "#0b0b0b",
              border: "1px solid #222",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>TOTAL RANKED</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {ranked.length}
            </div>
          </div>
        </div>
      </div>

      {ranked.length ? (
        <div>
          {ranked.map((pick: any, idx: number) => {
            const isCurrentTop =
              topSignal &&
              pick.pick === topSignal.pick &&
              pick.awayTeam === topSignal.awayTeam &&
              pick.homeTeam === topSignal.homeTeam &&
              pick.sport === topSignal.sport;

            return (
              <div
                key={`${pick.sport}-${pick.awayTeam}-${pick.homeTeam}-${pick.pick}-${idx}`}
                style={{
                  border: isCurrentTop ? "2px solid #ffcc00" : "1px solid #333",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: "#111",
                  color: "#fff",
                }}
              >
                {isCurrentTop && (
                  <div
                    style={{
                      display: "inline-block",
                      background: "#ffcc00",
                      color: "#000",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    {getOfficialLabel(topSignal)}
                  </div>
                )}

                <div style={{ fontWeight: 700 }}>
                  #{idx + 1} {pick.sport} • {pick.awayTeam} vs {pick.homeTeam}
                </div>

                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                  Start:{" "}
                  {pick.startTime
                    ? new Date(pick.startTime).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "America/New_York",
                      })
                    : "N/A"}
                </div>

                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  {pick.pick}
                </div>

                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Price: {pick.odds ?? "N/A"}
                </div>

                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Status:{" "}
                  <span
                    style={{
                      color: getStatusColor(pick.status),
                      fontWeight: 800,
                    }}
                  >
                    {String(pick.status ?? "PENDING").toUpperCase()}
                  </span>
                </div>

                {isCurrentTop && topSignal?.officialReason && (
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                    Reason: {topSignal.officialReason}
                  </div>
                )}

                <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>
                  Market: {String(pick.market ?? "N/A").toUpperCase()}
                  {pick.line !== null && pick.line !== undefined
                    ? ` • Line: ${pick.line}`
                    : ""}
                  {` • Confidence: ${pick.confidence ?? "N/A"}`}
                  {` • Score: ${
                    typeof pick.score === "number"
                      ? pick.score.toFixed(1)
                      : "N/A"
                  }`}
                  {` • Global: ${
                    typeof pick.globalScore === "number"
                      ? pick.globalScore.toFixed(2)
                      : "N/A"
                  }`}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ opacity: 0.7 }}>No global rankings found.</div>
      )}
    </div>
  );
}