 import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta ODDS_API_KEY en .env.local" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);

  // Ejemplo: basketball_nba, soccer_epl, etc.
  const sport = searchParams.get("sport") || "basketball_nba";

  // markets: h2h | spreads | totals
  const markets = searchParams.get("markets") || "h2h,spreads,totals";

  // regiones típicas: us, eu, uk, au
  const regions = searchParams.get("regions") || "us";

  // formato de odds: american | decimal
  const oddsFormat = searchParams.get("oddsFormat") || "decimal";

  // fecha: iso
  const dateFormat = searchParams.get("dateFormat") || "iso";

  // OPTIONAL (si lo quieres): lista de bookies separados por coma
  // ej: draftkings,fanduel,betmgm
  const bookmakers = searchParams.get("bookmakers"); 

  const base = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
  const url = new URL(base);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", regions);
  url.searchParams.set("markets", markets);
  url.searchParams.set("oddsFormat", oddsFormat);
  url.searchParams.set("dateFormat", dateFormat);
  if (bookmakers) url.searchParams.set("bookmakers", bookmakers);

  const res = await fetch(url.toString(), { cache: "no-store" });

  // Si falla, devuelve detalle útil
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      {
        error: "Error llamando The Odds API",
        status: res.status,
        details: text,
        requestUrl: url.toString().replace(apiKey, "HIDDEN"),
      },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}