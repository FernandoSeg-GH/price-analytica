"use client";

import React, { useMemo, useRef } from "react";
import type { Prediction, HistoryItem } from "../types/api";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend, Filler);

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
  const chartRef = useRef<any>(null);

  // Combine all dates
  const allDates = useMemo(() => {
    return Array.from(
      new Set([...history.map((h) => h.date), ...predictions.map((p) => p.date)])
    )
      .filter(Boolean)
      .sort();
  }, [history, predictions]);

  // Chart data
  const chartData = useMemo(() => {
    return {
      labels: allDates,
      datasets: [
        {
          label: `${ticker} - History`,
          data: allDates.map((date) => {
            const item = history.find((h) => h.date === date);
            return item?.close ?? null;
          }),
          borderColor: "#111827",
          backgroundColor: "rgba(17, 24, 39, 0.05)",
          borderWidth: 2.5,
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: "#111827",
          pointBorderColor: "#fff",
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          borderDash: [],
        },
        {
          label: `${ticker} - Predictions`,
          data: allDates.map((date) => {
            const item = predictions.find((p) => p.date === date);
            return item?.value ?? null;
          }),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2.5,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
          pointHoverRadius: 5,
          borderDash: [5, 5],
        },
      ],
    };
  }, [allDates, history, predictions, ticker]);

  // Chart options with zoom and pan
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: "bold",
          },
        },
      },
      title: {
        display: true,
        text: `${ticker} - Price History & Predictions`,
        font: {
          size: 16,
          weight: "bold",
        },
        padding: 20,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: { size: 12, weight: "bold" },
        bodyFont: { size: 11 },
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += "$" + context.parsed.y.toFixed(2);
            }
            return label;
          },
          afterLabel: function (context: any) {
            const date = context.label;
            return `Date: ${date}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: "Date",
          font: { size: 12, weight: "bold" },
        },
        ticks: {
          maxTicksLimit: 12,
          maxRotation: 45,
          minRotation: 0,
          font: { size: 10 },
          callback: function (value: any): string {
            return String(value);
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: `Price ($)`,
          font: { size: 12, weight: "bold" },
        },
        ticks: {
          font: { size: 10 },
          callback: function (value: any) {
            return "$" + value.toFixed(2);
          },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
          drawBorder: true,
        },
      },
    },
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom?.();
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleResetZoom}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 transition-colors"
        >
          🔄 Reset Zoom
        </button>
        <span className="text-xs text-zinc-500">
          💡 Use mouse wheel to zoom | Drag to pan
        </span>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <div style={{ position: "relative", width: "100%", height: "400px" }}>
          <Line ref={chartRef as any} data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="text-xs text-zinc-400">
        📊 Total dates: {allDates.length} | History points: {history.length} | Prediction points: {predictions.length}
      </div>
    </div>
  );
}
