"use client";

import React, { useEffect, useState, useRef } from "react";
import type { PredictionRaw, HistoryRaw, Prediction, HistoryItem } from "../types/api";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import Select from "./ui/Select";
import Card from "./ui/Card";

ChartJS.register(LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip);

type Pred = { date: string; value: number };
type Hist = { date: string; close: number };

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
        return raw.map((p) => ({ date: p.predict_date_lstm || p.predict_date || p.Date || "", value: p.prediction_lstm ?? p.prediction ?? null }));
    };

    const normalizeHistory = (raw: HistoryRaw[]): HistoryItem[] => {
        if (!raw || !Array.isArray(raw)) return [];
        return raw.map((h) => {
            const maybe = h as unknown as { date?: string; close?: number };
            return { date: h.Date || maybe.date || "", close: h.Close ?? maybe.close ?? null };
        });
    };

    const initialTickersArray = Array.isArray(initialTickers)
        ? initialTickers
        : (Array.isArray((initialTickers as unknown as { tickers?: string[] })?.tickers) ? (initialTickers as unknown as { tickers: string[] }).tickers : ["SPY"]);
    const [tickers, setTickers] = useState<string[]>(initialTickersArray || ["SPY"]);
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
            setPreds(normalizePreds(predR || []));
            setHistory(normalizeHistory(histR || []));
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
        if (s === "all" && e === "all") return true;
        const y = dateStr.slice(0, 4);
        if (!y) return false;
        const start = s === "all" ? y : s;
        const end = e === "all" ? y : e;
        return y >= start && y <= end;
    };

    const filteredHistory = history.filter((h) => inRange(h.date, startYear, endYear));
    const filteredPreds = preds.filter((p) => inRange(p.date, startYear, endYear));

    // Separate labels for each series so each chart focuses on its own timeline
    const historyLabels = Array.from(new Set(filteredHistory.map((h) => h.date))).filter(Boolean).sort();
    const predsDates = Array.from(new Set(filteredPreds.map((p) => p.date))).filter(Boolean).sort();

    // aggregate predictions per target date (avg, min, max) to avoid flat duplicate lines
    type AggPred = { date: string; avg: number | null; min: number | null; max: number | null; count: number };
    const aggregatedPreds: AggPred[] = predsDates.map((d) => {
        const vals = filteredPreds.map((p) => (p.date === d && p.value != null ? p.value : null)).filter((v) => v != null) as number[];
        if (!vals.length) return { date: d, avg: null, min: null, max: null, count: 0 };
        const sum = vals.reduce((s, x) => s + x, 0);
        const avg = sum / vals.length;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        return { date: d, avg, min, max, count: vals.length };
    });

    const predsLabelsAgg = aggregatedPreds.map((a) => a.date);

    const historyChartData = {
        labels: historyLabels,
        datasets: [
            {
                label: `${ticker} Close`,
                data: historyLabels.map((d) => {
                    const item = filteredHistory.find((h) => h.date === d);
                    return item ? item.close : null;
                }),
                borderColor: "#111827",
                backgroundColor: "rgba(17,24,39,0.06)",
                tension: 0.2,
            },
        ],
    };

    const predsChartData = {
        labels: predsLabelsAgg,
        datasets: [
            // average line
            {
                label: `Prediction (avg) (${ticker})`,
                data: aggregatedPreds.map((a) => a.avg),
                borderColor: "#065f46",
                backgroundColor: "rgba(6,95,70,0.06)",
                tension: 0.2,
                pointRadius: 3,
            },
            // min line (dashed)
            {
                label: `Prediction (min)`,
                data: aggregatedPreds.map((a) => a.min),
                borderColor: "#0ea5a4",
                borderDash: [6, 4],
                tension: 0.2,
                pointRadius: 0,
            },
            // max line (dashed)
            {
                label: `Prediction (max)`,
                data: aggregatedPreds.map((a) => a.max),
                borderColor: "#bfdbfe",
                borderDash: [6, 4],
                tension: 0.2,
                pointRadius: 0,
            },
            // optional: raw points (low opacity)
            {
                label: `Prediction (raw)`,
                data: predsLabelsAgg.map((d) => {
                    // flatten raw points for that date; keep first one for scatter (or null)
                    const raw = filteredPreds.find((p) => p.date === d && p.value != null);
                    return raw ? raw.value : null;
                }),
                borderColor: "rgba(6,95,70,0.0)",
                backgroundColor: "rgba(6,95,70,0.12)",
                showLine: false,
                pointRadius: 2,
            },
        ],
    };

    // refs to charts for exporting images
    const historyChartRef = useRef<ChartJS | null>(null);
    const predsChartRef = useRef<ChartJS | null>(null);

    // Chart options with simplified tick formatting and improved tooltips
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true },
            tooltip: { mode: "index", intersect: false },
        },
        scales: {
            x: {
                ticks: {
                    callback: function (value: any, index: number, ticks: any) {
                        // value is an index into labels
                        const label = (this as any).chart.data.labels?.[value] as string | undefined;
                        if (!label) return "";
                        // show year only if label is start of year else show MM-DD
                        const year = label.slice(0, 4);
                        const monthDay = label.slice(5);
                        if (monthDay === "01-01") return year;
                        // show short month-day for readability
                        return monthDay;
                    },
                },
            },
        },
    };

    const historyOptions = { ...commonOptions };
    const predsOptions = { ...commonOptions };

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
    function downloadCSV(rows: Array<Record<string, any>>, filename: string) {
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
    function downloadChartImage(chartRef: React.RefObject<any>, filename: string) {
        const chart = chartRef.current as any;
        const instance = chart?.chartInstance || chart?.instance || chart?.chart;
        // react-chartjs-2 exposes the Chart instance under different props depending on version
        const chartObj = instance || chart?.getChart?.();
        if (!chartObj || !chartObj.toBase64Image) return;
        const url = chartObj.toBase64Image();
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Activo</span>
                    <Select value={ticker} onChange={setTicker} options={tickers} />
                </div>
                <div className="text-sm text-zinc-600">{loading ? "Cargando..." : "Listo"}</div>
            </div>

            {/* Timeframe selector bar */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Periodo:</span>
                <Select value={startYear} onChange={(v) => setStartYear(v as string)} options={["all", ...yearsFromData]} />
                <span className="text-sm">—</span>
                <Select value={endYear} onChange={(v) => setEndYear(v as string)} options={["all", ...yearsFromData]} />
                <div className="ml-4 text-sm text-zinc-500">Filtrar por año (desde / hasta)</div>
                <div className="ml-4 flex items-center gap-2">
                    <button onClick={() => applyPreset("1y")} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">1Y</button>
                    <button onClick={() => applyPreset("5y")} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">5Y</button>
                    <button onClick={() => applyPreset("all")} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">All</button>
                </div>
            </div>

            <div className="flex flex-col w-full gap-6">
                <Card className="w-full">
                    <div className="flex items-center justify-between">
                        <h3 className="mb-2 text-sm font-semibold">Histórico (gráfico)</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => downloadChartImage(historyChartRef as any, `${ticker}-history.png`)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">Export PNG</button>
                            <button onClick={() => downloadCSV(filteredHistory.map(h => ({ date: h.date, close: h.close })), `${ticker}-history.csv`)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">Export CSV</button>
                        </div>
                    </div>
                    <div className="h-60 w-full">
                        <Line className="w-full" ref={historyChartRef as any} data={historyChartData} options={historyOptions as any} />
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between">
                        <h3 className="mb-2 text-sm font-semibold">Predicciones (gráfico)</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => downloadChartImage(predsChartRef as any, `${ticker}-preds.png`)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">Export PNG</button>
                            <button onClick={() => downloadCSV(filteredPreds.map(p => ({ date: p.date, value: p.value })), `${ticker}-preds.csv`)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">Export CSV</button>
                        </div>
                    </div>
                    <div className="h-60">
                        <Line ref={predsChartRef as any} data={predsChartData} options={predsOptions as any} />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                    <h3 className="mb-2 text-sm font-semibold">Predicciones</h3>
                    <div className="overflow-auto max-h-48">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-zinc-500">
                                    <th className="pb-2">Fecha</th>
                                    <th className="pb-2">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPreds && filteredPreds.length ? (
                                    filteredPreds.map((p, index) => (
                                        <tr key={`${p.date}-${index}`} className="border-t">
                                            <td className="py-2">{p.date}</td>
                                            <td className="py-2">{p.value}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="py-2 text-zinc-500">
                                            Sin datos
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <h3 className="mb-2 text-sm font-semibold">Histórico (últimos puntos)</h3>
                    <div className="overflow-auto max-h-48">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-zinc-500">
                                    <th className="pb-2">Fecha</th>
                                    <th className="pb-2">Cierre</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory && filteredHistory.length ? (
                                    filteredHistory.slice().reverse().slice(0, 20).map((h: HistoryItem) => (
                                        <tr key={h.date} className="border-t">
                                            <td className="py-2">{h.date}</td>
                                            <td className="py-2">{h.close}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="py-2 text-zinc-500">
                                            Sin datos
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <Card>
                <h3 className="mb-2 text-sm font-semibold">Explicaciones</h3>
                <p className="text-sm text-zinc-600">Esta vista toma datos desde la API pública y muestra el histórico y predicciones. Seleccioná un activo para actualizar.</p>
            </Card>
        </div>
    );
}
