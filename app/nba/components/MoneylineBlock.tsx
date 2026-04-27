type Props = {
  mlRaw: any[];
};

function americanToDecimal(american: number): number {
  const a = Number(american);
  if (!Number.isFinite(a) || a === 0) return NaN;
  if (a > 0) return 1 + a / 100;
  return 1 + 100 / Math.abs(a);
}

function normalizePriceToDecimal(price: any): number {
  const p = Number(price);
  if (!Number.isFinite(p)) return NaN;
  if (Math.abs(p) >= 100) return americanToDecimal(p);
  if (p > 1 && p < 100) return p;
  return NaN;
}

function decimalToAmerican(decimalOdds: number): string {
  const d = Number(decimalOdds);
  if (!Number.isFinite(d) || d <= 1) return "N/A";
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `-${Math.round(100 / (d - 1))}`;
}

function removeVig(probA: number, probB: number) {
  const total = probA + probB;
  return {
    fairA: probA / total,
    fairB: probB / total,
  };
}

function formatNumber(value: any, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

export default function MoneylineBlock({ mlRaw }: Props) {
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
        <strong>Moneyline</strong>
      </div>

      {mlRaw && mlRaw.length >= 2 ? (
        (() => {
          const d0 = normalizePriceToDecimal(mlRaw[0]?.price);
          const d1 = normalizePriceToDecimal(mlRaw[1]?.price);

          if (!Number.isFinite(d0) || !Number.isFinite(d1) || d0 <= 1 || d1 <= 1) {
            return (
              <div style={{ opacity: 0.7 }}>
                Moneyline inválido.
              </div>
            );
          }

          const p0 = 1 / d0;
          const p1 = 1 / d1;
          const fair = removeVig(p0, p1);

          return (
            <div>
              {mlRaw.map((o: any, i: number) => {
                const decimal = normalizePriceToDecimal(o.price);
                if (!Number.isFinite(decimal) || decimal <= 1) return null;

                const trueProb = i === 0 ? fair.fairA : fair.fairB;
                const truePct = trueProb * 100;

                return (
                  <div
                    key={`${o.name}-${i}`}
                    style={{
                      marginTop: i === 0 ? 0 : 10,
                      paddingTop: i === 0 ? 0 : 10,
                      borderTop: i === 0 ? "none" : "1px solid #ddd",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {o.name ?? "N/A"}
                    </div>

                    <div><strong>American:</strong> {decimalToAmerican(decimal)}</div>
                    <div><strong>Decimal:</strong> {formatNumber(decimal)}</div>
                    <div><strong>Fair Probability:</strong> {formatNumber(truePct, 1)}%</div>
                    <div><strong>Book:</strong> {o.bookmaker ?? "N/A"}</div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        <div style={{ opacity: 0.7 }}>No moneyline found.</div>
      )}
    </div>
  );
}