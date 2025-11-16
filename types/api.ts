export interface TickersResponse {
  tickers: string[];
}

export interface PredictionRaw {
  Date?: string;
  prediction_lstm?: number;
  predict_date_lstm?: string;
  predict_date?: string;
  prediction?: number;
  Ticker?: string;
}

export interface HistoryRaw {
  Date?: string;
  Close?: number;
  Ticker?: string;
}

export interface Prediction {
  date: string;
  value: number | null;
}

export interface HistoryItem {
  date: string;
  close: number | null;
}

export interface AllData {
  tickers: string[];
  preds: PredictionRaw[];
  history: HistoryRaw[];
}
