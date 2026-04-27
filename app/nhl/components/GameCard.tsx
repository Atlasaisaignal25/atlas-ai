import AtlasPickBlock from "./AtlasPickBlock";
import MoneylineBlock from "./MoneylineBlock";
import SpreadsBlock from "./SpreadsBlock";
import TotalsBlock from "./TotalsBlock";

type Props = {
  game: any;
};

export default function GameCard({ game }: Props) {
 
const {
  gameId,
  awayTeam,
  homeTeam,
  startTime,
  smartPick,
  rankedCandidates,
  mlRaw,
  spreadCandidates,
  totalCandidates,
  spreadConsensus,
  totalConsensus,
  spreadSteam,
  totalSteam,
  spreadSteamStrength,
  totalSteamStrength,
  spreadRLM,
  totalRLM,
} = game;

  return (
  <div
    style={{
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
      marginBottom: 14,
      background: "#fff",
    }}
  >
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ margin: 0 }}>
        {game.away_team} vs {game.home_team}
      </h3>

      <div style={{ marginTop: 6, opacity: 0.8 }}>
        Start: {new Date(game.commence_time).toLocaleString()}
      </div>
    </div>

    <div style={{ marginBottom: 14 }}>
      <AtlasPickBlock
  smartPick={smartPick}
  rankedCandidates={[]}
/>
    </div>

    <div style={{ marginBottom: 14 }}>
      <MoneylineBlock mlRaw={mlRaw} />
    </div>

    <div style={{ marginBottom: 14 }}>
      <SpreadsBlock
        spreadConsensus={spreadConsensus}
        spreadSteam={spreadSteam}
        spreadSteamStrength={spreadSteamStrength}
        spreadRLM={spreadRLM}
        spreadCandidates={spreadCandidates}
      />
    </div>

    <div>
      <TotalsBlock
        totalConsensus={totalConsensus}
        totalSteam={totalSteam}
        totalSteamStrength={totalSteamStrength}
        totalRLM={totalRLM}
        totalCandidates={totalCandidates}
      />
    </div>
  </div>
);
}