type Props = {
  picks: any[];
};

function formatNumber(value: any, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

function pickStrength(pick: any) {
  const value = pick?.valuePriority ?? 0;
  const confidence = pick?.confidence ?? 0;
  const signal = pick?.signal ?? "N/A";
  const category = pick?.category ?? "N/A";
  const againstClosing = !!pick?.againstClosing;
  const trap = !!pick?.clvTrap?.trap;

  if (trap || againstClosing) return "PASS";

  if (
    value >= 130 &&
    confidence >= 90 &&
    (signal === "ELITE" || signal === "VALUE") &&
    category !== "NO_PICK"
  ) {
    return "ELITE";
  }

  if (
    value >= 120 &&
    confidence >= 80 &&
    category !== "NO_PICK"
  ) {
    return "STRONG";
  }

  if (value >= 100 && confidence >= 65) {
    return "PLAYABLE";
  }

  return "PASS";
}

function strengthStyle(strength: string) {
  if (strength === "ELITE") {
    return {
      border: "2px solid #111",
      background: "#f0f0f0",
      fontWeight: 800,
    };
  }

  if (strength === "STRONG") {
    return {
      border: "1px solid #333",
      background: "#f7f7f7",
      fontWeight: 700,
    };
  }

  if (strength === "PLAYABLE") {
    return {
      border: "1px solid #777",
      background: "#fafafa",
      fontWeight: 600,
    };
  }

  return {
    border: "1px solid #bbb",
    background: "#fff",
    fontWeight: 500,
  };
}

function formatMarketLabel(market: string) {
  if (market === "spreads") return "Spread";
  if (market === "totals") return "Total";
  if (market === "h2h") return "Moneyline";
  return market ?? "N/A";
}

export default function JornadaRankedPicks({ picks }: Props) {
  const sortedPicks = [...(picks ?? [])]
    .filter((pick) => (pick.valuePriority ?? 0) >= 100)
    .sort((a, b) => {
      const scoreA =
        (a.valuePriority ?? 0) * 0.55 +
        (a.confidence ?? 0) * 0.25 +
        ((a.signal === "VALUE" || a.signal === "ELITE") ? 10 : 0) +
        (a.score ?? 0) * 0.2;

      const scoreB =
        (b.valuePriority ?? 0) * 0.55 +
        (b.confidence ?? 0) * 0.25 +
        ((b.signal === "VALUE" || b.signal === "ELITE") ? 10 : 0) +
        (b.score ?? 0) * 0.2;

      return scoreB - scoreA;
    });

  const eligiblePicks = sortedPicks.filter((pick) => pickStrength(pick) !== "PASS");

  const seenGames = new Set<string>();
  const filteredPicks = eligiblePicks.filter((pick) => {
    const gameKey = `${pick.awayTeam}__${pick.homeTeam}`;

    if (seenGames.has(gameKey)) return false;

    seenGames.add(gameKey);
    return true;
  });

  const discardedPicks = sortedPicks.length - filteredPicks.length;
  const top3Picks = filteredPicks.slice(0, 3);

  return (
    <div
      style={{
        border: "1px solid #333",
        padding: 14,
        marginBottom: 14,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 22 }}>Top Picks del Día</strong>
      </div>

      <div style={{ marginBottom: 12, opacity: 0.8 }}>
        Picks mostrados: {filteredPicks.length} | Picks descartados por filtro: {discardedPicks}
      </div>

      {top3Picks.length ? (
        <div
          style={{
            border: "1px solid #111",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
            background: "#f5f5f5",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>
            Top 3 Picks del Día
          </div>

          {top3Picks.map((pick, idx) => (
            <div
              key={`top3-${idx}`}
              style={{
                marginBottom: idx !== top3Picks.length - 1 ? 10 : 0,
                paddingBottom: idx !== top3Picks.length - 1 ? 10 : 0,
                borderBottom:
                  idx !== top3Picks.length - 1 ? "1px solid #ccc" : "none",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                #{idx + 1} {pick.awayTeam} vs {pick.homeTeam}
              </div>

              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                {pick.pickLabel ?? "N/A"}
              </div>

              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    ...strengthStyle(pickStrength(pick)),
                  }}
                >
                  {pickStrength(pick)}
                </span>
              </div>

              <div>
                <strong>Confidence:</strong> {formatNumber(pick.confidence)}
              </div>

              <div>
                <strong>Value Priority:</strong> {formatNumber(pick.valuePriority)}
              </div>

              <div>
                <strong>Status:</strong> {pick.status ?? "N/A"}
             </div>

             <div>
                <strong>Line Move:</strong> {pick.lineMove ?? "0"}
             </div>

            </div>

          ))}
        </div>
      ) : null}

      {filteredPicks.length ? (
        <div>
          {filteredPicks.map((pick, idx) => (
            <div
              key={idx}
              style={{
                border: idx === 0 ? "2px solid #111" : "1px solid #ddd",
                borderRadius: 10,
                padding: idx === 0 ? 14 : 12,
                marginBottom: 10,
                background: idx === 0 ? "#f3f3f3" : "#fafafa",
              }}
            >
              {idx === 0 && (
                <div
                  style={{
                    display: "inline-block",
                    border: "2px solid #111",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 10,
                    background: "#fff",
                    letterSpacing: 0.5,
                  }}
                >
                  🔥 TOP SIGNAL
                </div>
              )}

              <div
                style={{
                  fontWeight: 700,
                  fontSize: idx === 0 ? 26 : 20,
                  marginBottom: 6,
                  lineHeight: 1.2,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <img src={pick.awayLogo} width={24} height={24} />
  <span>{pick.awayTeam}</span>

  <span>vs</span>

  <img src={pick.homeLogo} width={24} height={24} />
  <span>{pick.homeTeam}</span>
</div>
              </div>

              <div
                style={{
                  fontSize: idx === 0 ? 32 : 22,
                  fontWeight: 800,
                  marginBottom: 10,
                  lineHeight: 1.15,
                }}
              >
                {pick.pickLabel ?? "N/A"}
              </div>

              <div style={{ marginBottom: 4 }}>
                <strong>Market:</strong> {formatMarketLabel(pick.market)}
              </div>

              <div style={{ marginBottom: 4 }}>
                <strong>Signal:</strong> {pick.signal ?? "N/A"}
              </div>

              <div
                style={{
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                Confidence: {formatNumber(pick.confidence)}
              </div>

              <div
                style={{
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                Value Priority: {formatNumber(pick.valuePriority)}
              </div>

              <div style={{ marginBottom: 4 }}>
                <strong>Book:</strong> {pick.odd?.bookmaker ?? "N/A"}
              </div>

              <div style={{ marginBottom: 4 }}>
                <strong>Category:</strong> {pick.category ?? "N/A"}
              </div>

             {"status" in pick ? (
  <div style={{ marginBottom: 4 }}>
    <strong>Status:</strong> {pick.status ?? "N/A"}
  </div>
) : null}

              <div>
                <strong>Tier:</strong> {pick.tier ?? "N/A"}
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 12,
                      ...strengthStyle(pickStrength(pick)),
                    }}
                  >
                    {pickStrength(pick)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ opacity: 0.7 }}>No ranked picks found.</div>
      )}
    </div>
  );
}
