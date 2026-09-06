export interface ChartCompactCircleMarker {
  time: number;
  price: number;
  side: string;
  color: string;
}

export interface ChartRenderedCompactCircle {
  x: number;
  y: number;
  side: string;
  color: string;
}

export interface ChartTrendLineSegment {
  startTime: number;
  startValue: number;
  endTime: number;
  endValue: number;
  startIndex: number;
  endIndex: number;
}

export interface ChartRenderedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  highlighted: boolean;
}

export interface ChartBacktestStats {
  profit: number; // 1 = 100%
  numberOfTrades: number;
  maxDrawback: number;
}