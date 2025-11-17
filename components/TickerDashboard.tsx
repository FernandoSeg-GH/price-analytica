import React from "react";
import { fetchAllData } from "../app/actions/api";
import ClientTicker, { ClientTickerProps } from "./ClientTicker";
import type { PredictionRaw, HistoryRaw } from "../types/api";

type Props = { params?: Record<string, string> };

export default async function TickerDashboard(_: Props) {
    const defaultTicker = "SPY";
    const data = await fetchAllData(defaultTicker);

    // fetchAllData returns typed { tickers: string[], preds: PredictionRaw[], history: HistoryRaw[] }
    const tickers = Array.isArray(data.tickers) ? data.tickers : [];
    const preds: PredictionRaw[] = Array.isArray(data.preds) ? data.preds : [];
    const history: HistoryRaw[] = Array.isArray(data.history) ? data.history : [];

    const clientProps: ClientTickerProps = {
        initialTickers: tickers.length ? tickers : ["SPY"],
        initialTicker: defaultTicker,
        initialPreds: preds,
        initialHistory: history,
    };

    return (
        <div className="mx-auto w-full max-w-4xl py-12">
            <h2 className="mb-6 text-2xl font-semibold">Dashboard de Activos</h2>
            {/* ClientTicker will fetch on selection changes */}
            <ClientTicker {...clientProps} />
        </div>
    );
}
