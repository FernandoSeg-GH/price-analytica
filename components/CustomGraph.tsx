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

    // Create chart
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "#666",
      },
      width: container.clientWidth,
      height: 400,
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: {
        mode: 1, // Normal crosshair mode
      },
      rightPriceScale: {
        borderColor: "#666",
      },
      timeScale: {
        borderColor: "#666",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
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
      color: "#111827",
      lineWidth: 2,
      title: `${ticker} - History`,
      priceLineVisible: false,
      lastValueVisible: true,
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
    });
    predictionSeriesRef.current = predictionSeries;

    // Handle resize
    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
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
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-zinc-900">
          {ticker} - Price History & Predictions
        </h3>
        <span className="text-xs text-zinc-500">🖱️ Scroll to zoom • Click & drag to pan</span>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <div ref={chartContainerRef} style={{ position: 'relative' }} />
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-zinc-900"></div>
            <span className="text-xs text-zinc-600">{ticker} - History</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-emerald-500" style={{ backgroundImage: "repeating-linear-gradient(90deg, #10b981 0, #10b981 5px, transparent 5px, transparent 10px)" }}></div>
            <span className="text-xs text-zinc-600">{ticker} - Predictions</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-zinc-400">
        📊 History points: {history.length} | Prediction points: {predictions.length}
      </div>
    </div>
  );
}
