export type MarketSnapshot = {
  ts: number;
  gameId: string | number;
  home: string;
  away: string;

  spreadHome?: number;
  spreadAway?: number;
  total?: number;

  mlHomeDec?: number;
  mlAwayDec?: number;
};

type Store = {
  byGame: Map<string, MarketSnapshot[]>;
};

const g = globalThis as any;

if (!g.__atlasStore) {
  g.__atlasStore = { byGame: new Map() } as Store;
}

const store: Store = g.__atlasStore;

export function pushSnapshot(s: MarketSnapshot) {
  const key = String(s.gameId);
  const arr = store.byGame.get(key) ?? [];

  arr.push(s);

  if (arr.length > 200) arr.splice(0, arr.length - 200);

  store.byGame.set(key, arr);
}

export function getSnapshots(gameId: string | number) {
  return store.byGame.get(String(gameId)) ?? [];
}

export function getLatest(gameId: string | number) {
  const arr = getSnapshots(gameId);
  return arr[arr.length - 1] ?? null;
}

export function getPrevious(gameId: string | number) {
  const arr = getSnapshots(gameId);
  return arr.length >= 2 ? arr[arr.length - 2] : null;
}