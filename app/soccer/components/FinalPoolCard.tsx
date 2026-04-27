"use client";

type FinalPoolCardProps = {
  pick: {
    gameId: string;
    teams: string;
    market: string;
    pick: string;
    line?: number;
    odds: number;
    edge: number;
    confidence: number;
    valuePriority: number;
    internalScore: number;
    marketSignal: number;
    sharpBooks: number;
    closingDirection: "up" | "down" | "neutral";
    status: string;
    startTime: string;
  };
};

export default function FinalPoolCard({ pick }: FinalPoolCardProps) {
  async function handleGrade(result: "won" | "lost" | "cancelled") {
  try {
    const res = await fetch("/api/soccer/grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: pick.gameId,
        teams: pick.teams,
        market: pick.market,
        pick: pick.pick,
        line: pick.line,
        result,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to grade pick:", data);
      return;
    }

    console.log("Pick graded successfully:", data);

    window.location.reload();
  } catch (error) {
    console.error("Error grading pick:", error);
  }
}

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 16,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "#aaa" }}>
          {pick.market.toUpperCase()}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 999,
            background: "#1a1a1a",
            border: "1px solid #333",
          }}
        >
          {pick.status.toUpperCase()}
        </div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
        {pick.teams}
      </div>

      <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
  {new Date(pick.startTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  })}
</div>

      <div style={{ fontSize: 15, marginBottom: 6 }}>
        Pick: <strong>{pick.pick}</strong>
      </div>

      {pick.line !== undefined && (
        <div style={{ fontSize: 14, color: "#ccc", marginBottom: 6 }}>
          Line: {pick.line}
        </div>
      )}

      <div style={{ fontSize: 14, color: "#ccc", marginBottom: 6 }}>
  Odds: {pick.odds}
</div>

<div style={{ fontSize: 14, color: "#ccc", marginBottom: 6 }}>
  Edge: {pick.edge?.toFixed(2) ?? "0.00"}%
</div>

<div style={{ fontSize: 14, color: "#ccc", marginBottom: 6 }}>
  Confidence: {pick.confidence?.toFixed(1) ?? "0.0"}
</div>

<div style={{ fontSize: 14, color: "#ccc", marginBottom: 6 }}>
  Value Priority: {pick.valuePriority?.toFixed(1) ?? "0.0"}
</div>

<div style={{ fontSize: 14, color: "#ccc", marginTop: 6 }}>
  Sharp Books: {pick.sharpBooks ?? 0}
</div>

<div style={{ fontSize: 14, color: "#ccc" }}>
  Market Signal: {pick.marketSignal?.toFixed(1) ?? "0.0"}
</div>

<div style={{ fontSize: 14, color: "#ccc", marginTop: 6 }}>
  Internal Score: {pick.internalScore?.toFixed(1) ?? "0.0"}
</div>

<div style={{ fontSize: 14, color: "#ccc", marginTop: 6 }}>
  Closing Direction: {pick.closingDirection ?? "neutral"}
</div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => handleGrade("won")}
          style={{
            background: "#0f2a1f",
            color: "#fff",
            border: "1px solid #1f5a3f",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          WIN
        </button>

        <button
          onClick={() => handleGrade("lost")}
          style={{
            background: "#2a0f0f",
            color: "#fff",
            border: "1px solid #5a1f1f",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          LOSS
        </button>

        <button
          onClick={() => handleGrade("cancelled")}
          style={{
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}