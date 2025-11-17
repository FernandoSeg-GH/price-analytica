"use client";

import React, { useEffect, useState, useRef } from "react";
import type { PredictionRaw, HistoryRaw, Prediction, HistoryItem } from "../types/api";

import CustomGraph from "./CustomGraph";


export type ClientTickerProps = {
    initialTickers: string[];
    initialTicker: string;
    initialPreds: PredictionRaw[];
    initialHistory: HistoryRaw[];
};

export default function ClientTicker({ initialTickers, initialTicker, initialPreds, initialHistory }: ClientTickerProps) {
    // normalize incoming props (API returns different key names)
    const normalizePreds = (raw: PredictionRaw[]): Prediction[] => {
        if (!raw || !Array.isArray(raw)) return [];
        const mapped = raw.map((p) => ({
            date: p.predict_date_lstm || p.predict_date || p.Date || "",
            value: p.prediction_lstm ?? p.prediction ?? null
        }));

        // Remove duplicates by date (keep last occurrence)
        const seen = new Map<string, Prediction>();
        mapped.forEach(item => {
            if (item.date) seen.set(item.date, item);
        });

        return Array.from(seen.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    const normalizeHistory = (raw: HistoryRaw[]): HistoryItem[] => {
        if (!raw || !Array.isArray(raw)) return [];
        const mapped = raw.map((h) => {
            const maybe = h as unknown as { date?: string; close?: number };
            return { date: h.Date || maybe.date || "", close: h.Close ?? maybe.close ?? null };
        });

        // Remove duplicates by date (keep last occurrence)
        const seen = new Map<string, HistoryItem>();
        mapped.forEach(item => {
            if (item.date) seen.set(item.date, item);
        });

        return Array.from(seen.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    const initialTickersArray = Array.isArray(initialTickers)
        ? initialTickers
        : (Array.isArray((initialTickers as unknown as { tickers?: string[] })?.tickers) ? (initialTickers as unknown as { tickers: string[] }).tickers : ["SPY"]);
    const [tickers] = useState<string[]>(initialTickersArray || ["SPY"]);
    const [ticker, setTicker] = useState<string>(initialTicker || initialTickersArray?.[0] || "SPY");
    const [preds, setPreds] = useState<Prediction[]>(normalizePreds(initialPreds || []));
    const [history, setHistory] = useState<HistoryItem[]>(normalizeHistory(initialHistory || []));
    const [loading, setLoading] = useState(false);
    // timeframe selection (years)
    const yearsFromData = React.useMemo(() => {
        const allDates = [...history.map((h) => h.date), ...preds.map((p) => p.date)].filter(Boolean);
        const years = Array.from(new Set(allDates.map((d) => (d ? d.slice(0, 4) : "")))).filter(Boolean).sort();
        return years;
    }, [history, preds]);

    const [startYear, setStartYear] = useState<string | "all">(() => (yearsFromData.length ? yearsFromData[0] : "all"));
    const [endYear, setEndYear] = useState<string | "all">(() => (yearsFromData.length ? yearsFromData[yearsFromData.length - 1] : "all"));

    // Calendar date range selection
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [useCalendar, setUseCalendar] = useState(false);

    // Keep selects in sync when data changes
    useEffect(() => {
        if (yearsFromData.length) {
            setStartYear((s) => (s === "all" ? yearsFromData[0] : yearsFromData.includes(s as string) ? s : yearsFromData[0]));
            setEndYear((e) => (e === "all" ? yearsFromData[yearsFromData.length - 1] : yearsFromData.includes(e as string) ? e : yearsFromData[yearsFromData.length - 1]));
        }
    }, [yearsFromData]);

    useEffect(() => {
        setTicker(initialTicker || (tickers.length ? tickers[0] : "SPY"));
    }, [initialTicker, tickers]);

    async function load(t: string) {
        try {
            setLoading(true);
            const [predR, histR] = await Promise.all([
                fetch(`https://api-data-service-cb4vi2yjma-ew.a.run.app/predictions?ticker=${encodeURIComponent(t)}`).then((r) => r.json()),
                fetch(`https://api-data-service-cb4vi2yjma-ew.a.run.app/history?ticker=${encodeURIComponent(t)}`).then((r) => r.json()),
            ]);

            const normalizedPreds = normalizePreds(predR || []);
            const normalizedHistory = normalizeHistory(histR || []);

            console.log(`📊 [${t}] API Response:`);
            console.log(`  History: ${histR?.length || 0} raw → ${normalizedHistory.length} unique`);
            console.log(`  Predictions: ${predR?.length || 0} raw → ${normalizedPreds.length} unique`);

            if (normalizedHistory.length > 0) {
                const firstHist = normalizedHistory[0].date;
                const lastHist = normalizedHistory[normalizedHistory.length - 1].date;
                console.log(`  History range: ${firstHist} → ${lastHist}`);
            }

            if (normalizedPreds.length > 0) {
                const firstPred = normalizedPreds[0].date;
                const lastPred = normalizedPreds[normalizedPreds.length - 1].date;
                console.log(`  Predictions range: ${firstPred} → ${lastPred}`);
            }

            setPreds(normalizedPreds);
            setHistory(normalizedHistory);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // initial load already provided; ensure data for selected ticker
        if (ticker) load(ticker);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticker]);

    // Filter functions by selected year range
    const inRange = (dateStr: string, s: string | "all", e: string | "all") => {
        if (!dateStr) return false;

        // If using calendar dates, filter by actual dates
        if (useCalendar && (startDate || endDate)) {
            const dateParts = dateStr.split("-");
            if (dateParts.length < 3) return false;
            const itemDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));

            if (startDate && itemDate < startDate) return false;
            if (endDate && itemDate > endDate) return false;
            return true;
        }

        // Otherwise use year-based filtering
        if (s === "all" && e === "all") return true;
        const y = dateStr.slice(0, 4);
        if (!y) return false;
        const start = s === "all" ? y : s;
        const end = e === "all" ? y : e;
        return y >= start && y <= end;
    };

    const filteredHistory = history.filter((h) => inRange(h.date, startYear, endYear));
    const filteredPreds = preds.filter((p) => inRange(p.date, startYear, endYear));

    // Debug filtering
    React.useEffect(() => {
        console.log(`Filtering: startYear=${startYear}, endYear=${endYear}, useCalendar=${useCalendar}`);
        console.log(`Total history: ${history.length}, Filtered: ${filteredHistory.length}`);
        console.log(`Total preds: ${preds.length}, Filtered: ${filteredPreds.length}`);
    }, [history.length, filteredHistory.length, preds.length, filteredPreds.length, startYear, endYear, useCalendar]);

    // refs to graphs for exporting images
    const historyGraphRef = useRef<HTMLDivElement>(null);

    // Preset buttons: 1Y, 5Y, All
    const latestYear = yearsFromData.length ? yearsFromData[yearsFromData.length - 1] : null;
    function applyPreset(preset: "1y" | "5y" | "all") {
        if (!latestYear) return;
        if (preset === "all") {
            setStartYear("all");
            setEndYear("all");
            return;
        }
        const ly = Number(latestYear);
        if (preset === "1y") {
            setStartYear(String(ly - 1));
            setEndYear(String(ly));
        } else if (preset === "5y") {
            setStartYear(String(ly - 5));
            setEndYear(String(ly));
        }
    }

    // Export CSV helper
    function downloadCSV(rows: Array<Record<string, string | number | null>>, filename: string) {
        if (!rows || !rows.length) return;
        const keys = Object.keys(rows[0]);
        const csv = [keys.join(";")].concat(rows.map((r) => keys.map((k) => r[k]).join(";"))).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Export chart PNG
    function downloadChartImage(chartRef: React.RefObject<HTMLDivElement | null>, filename: string) {
        const svg = chartRef.current?.querySelector("svg") as SVGElement | null;
        if (!svg) return;

        // Create canvas from SVG
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const svgString = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const url = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgString);
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <label htmlFor="ticker-select" className="text-sm font-semibold text-slate-700">Select Asset</label>
                    <select
                        id="ticker-select"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg bg-white text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors shadow-sm"
                    >
                        {tickers.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    {loading ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm text-slate-600">Loading...</span>
                        </>
                    ) : (
                        <>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className="text-sm text-slate-600 font-medium">Ready</span>
                        </>
                    )}
                </div>
            </div>

            {/* Timeframe selector bar */}
            <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Time Period:</span>
                    <button
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm ${useCalendar
                                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                                : 'border-2 border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                        onClick={() => setUseCalendar(!useCalendar)}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {useCalendar ? "Calendar Mode" : "Year Mode"}
                    </button>
                </div>

                {useCalendar ? (
                    // Calendar Date Range Picker
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-linear-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col gap-2 flex-1">
                            <label htmlFor="start-date" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">From</label>
                            <input
                                id="start-date"
                                type="date"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                                max={endDate ? endDate.toISOString().split('T')[0] : ''}
                            />
                        </div>

                        <div className="hidden sm:flex items-center justify-center px-2">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </div>

                        <div className="flex flex-col gap-2 flex-1">
                            <label htmlFor="end-date" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">To</label>
                            <input
                                id="end-date"
                                type="date"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                                min={startDate ? startDate.toISOString().split('T')[0] : ''}
                            />
                        </div>

                        <button
                            className="sm:mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white hover:text-slate-900 transition-all border border-transparent hover:border-slate-300"
                            onClick={() => {
                                setStartDate(undefined);
                                setEndDate(undefined);
                            }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear
                        </button>
                    </div>
                ) : (
                    // Year-based filtering
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-linear-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col gap-2 flex-1">
                                <label htmlFor="start-year" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">From Year</label>
                                <select
                                    id="start-year"
                                    value={startYear}
                                    onChange={(e) => setStartYear(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                                >
                                    {["all", ...yearsFromData].map((year) => (
                                        <option key={year} value={year}>
                                            {year === "all" ? "All Years" : year}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="hidden sm:flex items-center justify-center px-2 mt-6">
                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>

                            <div className="flex flex-col gap-2 flex-1">
                                <label htmlFor="end-year" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">To Year</label>
                                <select
                                    id="end-year"
                                    value={endYear}
                                    onChange={(e) => setEndYear(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                                >
                                    {["all", ...yearsFromData].map((year) => (
                                        <option key={year} value={year}>
                                            {year === "all" ? "All Years" : year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quick Select:</span>
                            <button
                                onClick={() => applyPreset("1y")}
                                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-all shadow-sm hover:shadow-md"
                            >
                                1 Year
                            </button>
                            <button
                                onClick={() => applyPreset("5y")}
                                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-all shadow-sm hover:shadow-md"
                            >
                                5 Years
                            </button>
                            <button
                                onClick={() => applyPreset("all")}
                                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-all shadow-sm hover:shadow-md"
                            >
                                All Time
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Chart Section */}
            <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 bg-linear-to-r from-slate-50 to-white border-b border-slate-200">
                    <h3 className="text-base font-semibold text-slate-900">Price Chart & Predictions</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => downloadChartImage(historyGraphRef, `${ticker}-combined.png`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-medium text-white transition-all shadow-sm hover:shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Export PNG
                        </button>
                        <button
                            onClick={() => downloadCSV(filteredHistory.map(h => ({ date: h.date, close: h.close })), `${ticker}-history.csv`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition-all shadow-sm hover:shadow-md"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                        </button>
                    </div>
                </div>
                <div ref={historyGraphRef} className="w-full p-6">
                    <CustomGraph history={filteredHistory} predictions={filteredPreds} ticker={ticker} />
                </div>
            </div>

            {/* Data Tables Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Predictions Table */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-linear-to-r from-emerald-50 to-white border-b border-slate-200">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            Predictions
                        </h3>
                    </div>
                    <div className="overflow-auto max-h-80 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr className="text-left">
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPreds && filteredPreds.length ? (
                                    filteredPreds.map((p, index) => (
                                        <tr key={`${p.date}-${index}`} className="hover:bg-emerald-50/50 transition-colors">
                                            <td className="px-6 py-3 text-sm text-slate-900 font-medium">{p.date}</td>
                                            <td className="px-6 py-3 text-sm text-emerald-700 font-semibold text-right">${p.value?.toFixed(2)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                </svg>
                                                No data available
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* History Table */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-linear-to-r from-blue-50 to-white border-b border-slate-200">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Historical Data (Recent)
                        </h3>
                    </div>
                    <div className="overflow-auto max-h-80 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr className="text-left">
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Close</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredHistory && filteredHistory.length ? (
                                    filteredHistory.slice().reverse().slice(0, 20).map((h: HistoryItem) => (
                                        <tr key={h.date} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-6 py-3 text-sm text-slate-900 font-medium">{h.date}</td>
                                            <td className="px-6 py-3 text-sm text-blue-700 font-semibold text-right">${h.close?.toFixed(2)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                </svg>
                                                No data available
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Info Section */}
            <div className="rounded-xl border border-blue-200 bg-linear-to-br from-blue-50 to-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="shrink-0 p-2 bg-blue-100 rounded-lg">
                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-slate-900 mb-2">About This Dashboard</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            This dashboard provides real-time market data and AI-powered predictions. Select an asset to view historical prices and future forecasts. Use the time period filters to analyze specific date ranges or years.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
