import React from "react";
import { fetchAllData } from "../app/actions/api";
import ClientTicker, { ClientTickerProps } from "./ClientTicker";
import type { PredictionRaw, HistoryRaw } from "../types/api";

export default async function TickerDashboard() {
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
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50/30">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
                {/* Page Header */}
                <div className="mb-8 sm:mb-12">
                    <div className="flex flex-col gap-3">
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
                            Asset Analytics
                        </h1>
                        <p className="text-base sm:text-lg text-slate-600 max-w-2xl">
                            Real-time market data visualization and AI-powered price predictions
                        </p>
                    </div>
                </div>

                {/* Dashboard Content */}
                <ClientTicker {...clientProps} />
            </div>
        </div>
    );
}
