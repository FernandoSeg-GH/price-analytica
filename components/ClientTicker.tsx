"use client";

import React, { useEffect, useState, useRef } from "react";
import type { PredictionRaw, HistoryRaw, Prediction, HistoryItem } from "../types/api";
import Select from "./ui/Select";
import Card from "./ui/Card";
import CustomGraph from "./CustomGraph";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"; 
import { Button } from "./ui/button";


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

    // refs to graphs for exporting images
    const historyGraphRef = useRef<HTMLDivElement | null>(null);

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
    function downloadChartImage(chartRef: React.RefObject<HTMLDivElement>, filename: string) {
        const svg = chartRef.current?.querySelector("svg") as SVGElement;
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Activo</span>
                    <Select value={ticker} onChange={setTicker} options={tickers} />
                </div>
                <div className="text-sm text-zinc-600">{loading ? "Cargando..." : "Listo"}</div>
            </div>

            {/* Timeframe selector bar */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Periodo:</span>
                    <Button 
                        variant={useCalendar ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUseCalendar(!useCalendar)}
                    >
                        📅 {useCalendar ? "Calendario" : "Año"}
                    </Button>
                </div>

                {useCalendar ? (
                    // Calendar Date Range Picker
                    <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Desde:</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-32">
                                        {startDate ? startDate.toLocaleDateString() : "Seleccionar"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        disabled={(date) => endDate ? date > endDate : false}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <span className="text-sm text-zinc-400">—</span>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Hasta:</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-32">
                                        {endDate ? endDate.toLocaleDateString() : "Seleccionar"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={setEndDate}
                                        disabled={(date) => startDate ? date < startDate : false}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                                setStartDate(undefined);
                                setEndDate(undefined);
                            }}
                        >
                            Limpiar
                        </Button>
                    </div>
                ) : (
                    // Year-based filtering
                    <div className="flex items-center gap-3">
                        <Select value={startYear} onChange={(v) => setStartYear(v as string)} options={["all", ...yearsFromData]} />
                        <span className="text-sm">—</span>
                        <Select value={endYear} onChange={(v) => setEndYear(v as string)} options={["all", ...yearsFromData]} />
                        <div className="ml-4 text-sm text-zinc-500">Filtrar por año</div>
                        <div className="ml-4 flex items-center gap-2">
                            <button onClick={() => applyPreset("1y")} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">1Y</button>
                            <button onClick={() => applyPreset("5y")} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">5Y</button>
                            <button onClick={() => applyPreset("all")} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">All</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col w-full gap-6">
                <Card className="w-full">
                    <div className="flex items-center justify-between">
                        <h3 className="mb-2 text-sm font-semibold">Histórico y Predicciones (gráfico)</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => downloadChartImage(historyGraphRef as any, `${ticker}-combined.png`)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">Export PNG</button>
                            <button onClick={() => downloadCSV(filteredHistory.map(h => ({ date: h.date, close: h.close })), `${ticker}-history.csv`)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white">Export CSV</button>
                        </div>
                    </div>
                    <div ref={historyGraphRef} className="w-full flex justify-center">
                        <CustomGraph history={filteredHistory} predictions={filteredPreds} ticker={ticker}  />
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
