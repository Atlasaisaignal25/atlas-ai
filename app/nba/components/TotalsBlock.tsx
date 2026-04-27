type Props = {
  totalCandidates: any[];
  totalConsensus: any;
  totalSteam: string;
  totalSteamStrength: string;
  totalRLM: any;
};

function decimalToAmerican(decimalOdds: number): string {
  const d = Number(decimalOdds);
  if (!Number.isFinite(d) || d <= 1) return "N/A";
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `-${Math.round(100 / (d - 1))}`;
}

function labelForDisplay(odd: any) {
  if (!odd) return "N/A";
  return `${odd.name}${
    typeof odd.point === "number" ? ` (${odd.point})` : ""
  }`;
}

function formatNumber(value: any, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

export default function TotalsBlock({
  totalConsensus,
  totalSteam,
  totalSteamStrength,
  totalRLM,
  totalCandidates,
}: Props) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 10,
        padding: 14,
        background: "#fafafa",
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <strong>Totals</strong>
      </div>

      <div style={{ marginBottom: 6, opacity: 0.85 }}>
        <strong>Consensus:</strong> avg={formatNumber(totalConsensus?.average)} | median={formatNumber(totalConsensus?.median)}
      </div>

      <div style={{ marginBottom: 6, opacity: 0.85 }}>
        <strong>Steam:</strong> {totalSteam ?? "NONE"} | <strong>Strength:</strong> {totalSteamStrength ?? "NONE"}
      </div>

      <div style={{ marginBottom: 10, opacity: 0.85 }}>
        <strong>RLM:</strong> {totalRLM?.signal ?? "NONE"} | {totalRLM?.note ?? "No RLM data"}
      </div>

      {(totalCandidates ?? []).length ? (
        (totalCandidates ?? []).map((c: any, idx: number) => (
          <div
            key={`tot-${c.odd?.name}-${c.odd?.point}-${idx}`}
            style={{
              marginTop: idx === 0 ? 0 : 10,
              paddingTop: idx === 0 ? 0 : 10,
              borderTop: idx === 0 ? "none" : "1px solid #ddd",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {labelForDisplay(c.odd)}
            </div>

            <div><strong>American:</strong> {decimalToAmerican(c.decimal)}</div>
            <div><strong>Decimal:</strong> {formatNumber(c.decimal)}</div>
            <div><strong>Book:</strong> {c.odd?.bookmaker ?? "N/A"}</div>
            <div><strong>Signal:</strong> {c.signal ?? "NONE"}</div>
            <div><strong>Confidence:</strong> {formatNumber(c.confidence)}/100</div>
            <div><strong>Value Priority:</strong> {formatNumber(c.valuePriority)}</div>
            <div><strong>Category:</strong> {c.category ?? "NO_PICK"}</div>
          </div>
        ))
      ) : (
        <div style={{ opacity: 0.7 }}>No totals found.</div>
      )}
    </div>
  );
}