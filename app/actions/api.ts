"use server";

import type {
  TickersResponse,
  PredictionRaw,
  HistoryRaw,
  AllData,
} from "../../types/api";

const BASE = "https://api-data-service-cb4vi2yjma-ew.a.run.app";

export async function fetchTickers(): Promise<string[]> {
  const res = await fetch(`${BASE}/tickers`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tickers");
  // API returns { tickers: string[] }
  const json: TickersResponse = await res.json();
  return Array.isArray(json.tickers) ? json.tickers : [];
}

export async function fetchPredictions(
  ticker: string
): Promise<PredictionRaw[]> {
  const res = await fetch(
    `${BASE}/predictions?ticker=${encodeURIComponent(ticker)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch predictions");
  const json = await res.json();
  return Array.isArray(json) ? (json as PredictionRaw[]) : [];
}

export async function fetchHistory(ticker: string): Promise<HistoryRaw[]> {
  const res = await fetch(
    `${BASE}/history?ticker=${encodeURIComponent(ticker)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  const json = await res.json();
  return Array.isArray(json) ? (json as HistoryRaw[]) : [];
}

export async function fetchAllData(ticker: string): Promise<AllData> {
  const [tickers, preds, history] = await Promise.all([
    fetchTickers(),
    fetchPredictions(ticker),
    fetchHistory(ticker),
  ]);
  return { tickers, preds, history } as AllData;
}
