type Props = {
  smartPick: any;
  rankedCandidates: any[];
};

function labelForDisplay(market: string, odd: any) {
  if (!odd) return "N/A";

  if (market === "totals") {
    return `${odd.name}${typeof odd.point === "number" ? ` (${odd.point})` : ""}`;
  }

  if (market === "spreads") {
    return `${odd.name}${
      typeof odd.point === "number"
        ? ` (${odd.point > 0 ? `+${odd.point}` : odd.point})`
        : ""
    }`;
  }

  return odd.name ?? "N/A";
}

function decimalToAmerican(decimalOdds: number): string {
  const d = Number(decimalOdds);
  if (!Number.isFinite(d) || d <= 1) return "N/A";
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `-${Math.round(100 / (d - 1))}`;
}

function formatNumber(value: any, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

export default function AtlasPickBlock({ smartPick }: Props) {
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
        <strong>Atlas AI Pick</strong>
      </div>

      {smartPick ? (
        <>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {labelForDisplay(smartPick.market, smartPick.odd)}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Signal:</strong> {smartPick.signal ?? "N/A"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Tier:</strong> {smartPick.tier ?? "N/A"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Book:</strong> {smartPick.odd?.bookmaker ?? "N/A"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>American:</strong> {decimalToAmerican(smartPick.decimal)}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Decimal:</strong> {formatNumber(smartPick.decimal)}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Confidence:</strong> {formatNumber(smartPick.confidence)}/100
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Score:</strong> {formatNumber(smartPick.score)}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Value Priority:</strong> {formatNumber(smartPick.valuePriority)}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Category:</strong> {smartPick.category ?? "NO_PICK"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>CLV:</strong> {smartPick.clv ?? "N/A"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Regime:</strong> {smartPick.regime?.label ?? "N/A"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Sharp Trap:</strong> {smartPick.sharpTrap?.label ?? "NONE"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Liquidity Shock:</strong> {smartPick.liquidityShock?.label ?? "NONE"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Closing Line Direction:</strong> {smartPick.clp?.direction ?? "N/A"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Closing Line Edge:</strong> {formatNumber(smartPick.clp?.edge)}
          </div>

          <div style={{ marginBottom: 6 }}>
            <strong>Against Closing:</strong> {smartPick.againstClosing ? "YES" : "NO"}
          </div>

          <div>
            <strong>Trap:</strong> {smartPick.clvTrap?.label ?? "NONE"}
          </div>
        </>
      ) : (
        <div style={{ opacity: 0.7 }}>No pick found.</div>
      )}
    </div>
  );
}