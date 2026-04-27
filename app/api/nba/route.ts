export async function GET() {

  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: "Missing ODDS_API_KEY in .env.local" },
      { status: 500 }
    )
  }

  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals`
  )

  const data = await response.json()

  return Response.json(data)
}