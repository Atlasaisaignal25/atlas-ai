export type RankedPick = {
  market: "spreads" | "totals";
  odd: any;
  decimal: number;
  signal: string;
  clv: string;
  confidence: number;
  tier: string;
  score: number;
  valuePriority?: number;
  category?: string;
  againstClosing?: boolean;
  clvTrap?: { trap?: boolean; label?: string };
  fakeSteam?: { label?: string; score?: number };
  smartMoney?: { label?: string; score?: number; sharpCount?: number; sharpLean?: number };
  regime?: { label?: string; score?: number };
  sharpTrap?: { label?: string; score?: number };
  liquidityShock?: { label?: string; score?: number };
};

export type ProcessedGame = {
  game: any;
  smartPick: RankedPick | null;
  rankedCandidates: RankedPick[];
  mlRaw: any[];
  spreadCandidates: RankedPick[];
  totalCandidates: RankedPick[];
  spreadConsensus: any;
  totalConsensus: any;
  spreadSteam: string;
  totalSteam: string;
  spreadSteamStrength: string;
  totalSteamStrength: string;
  spreadRLM: any;
  totalRLM: any;
};