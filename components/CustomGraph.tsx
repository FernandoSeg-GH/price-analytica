"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { createChart, ColorType, LineStyle, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { Prediction, HistoryItem } from "../types/api";

interface CustomGraphProps {
  history: HistoryItem[];
  predictions: Prediction[];
  ticker: string;
}

export default function CustomGraph({
  history,
  predictions,
  ticker,
}: CustomGraphProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const historySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const predictionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Prepare data for Lightweight Charts
  const { historyData, predictionData } = useMemo(() => {
    const historyData = history
      .filter((h) => h.close !== null && h.date)
      .map((h) => ({
        time: h.date as Time,
        value: h.close as number,
      }))
      .sort((a, b) => a.time.toString().localeCompare(b.time.toString()));

    const predictionData = predictions
      .filter((p) => p.value !== null && p.date)
      .map((p) => ({
        time: p.date as Time,
        value: p.value as number,
      }))
      .sort((a, b) => a.time.toString().localeCompare(b.time.toString()));

    return { historyData, predictionData };
  }, [history, predictions]);

  // Initialize chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Dynamic height based on viewport
    const getChartHeight = () => {
      if (typeof window === 'undefined') return 400;
      return window.innerWidth < 640 ? 300 : window.innerWidth < 1024 ? 350 : 450;
    };

    const height = getChartHeight();

    // Create chart
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#64748b",
        fontSize: 12,
      },
      width: container.clientWidth,
      height: height,
      grid: {
        vertLines: { color: "#f1f5f9", style: 1 },
        horzLines: { color: "#f1f5f9", style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        borderVisible: true,
      },
      timeScale: {
        borderColor: "#e2e8f0",
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Create history line series (solid)
    const historySeries = chart.addSeries(LineSeries, {
      color: "#0f172a",
      lineWidth: 2,
      title: `${ticker} - History`,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    historySeriesRef.current = historySeries;

    // Create prediction line series (dashed)
    const predictionSeries = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: `${ticker} - Predictions`,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    predictionSeriesRef.current = predictionSeries;

    // Handle resize
    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: getChartHeight(),
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [ticker]);

  // Update data when history or predictions change
  useEffect(() => {
    if (!historySeriesRef.current || !predictionSeriesRef.current) return;

    historySeriesRef.current.setData(historyData);
    predictionSeriesRef.current.setData(predictionData);

    // Fit content to view
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [historyData, predictionData]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">
          {ticker} - Price Analysis
        </h3>
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Scroll to zoom • Drag to pan
        </span>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div ref={chartContainerRef} className="w-full" style={{ position: 'relative' }} />
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 px-4 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-0.5 bg-slate-900 rounded-full"></div>
            <span className="text-xs font-medium text-slate-700">{ticker} History</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-0.5 bg-emerald-500 rounded-full" style={{
              backgroundImage: "repeating-linear-gradient(90deg, #10b981 0, #10b981 5px, transparent 5px, transparent 10px)"
            }}></div>
            <span className="text-xs font-medium text-slate-700">{ticker} Predictions</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {history.length} data points
        </span>
        <span className="text-slate-300">•</span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          {predictions.length} predictions
        </span>
      </div>
    </div>
  );
}
