import { TrendLine } from './shared.interfaces';

export enum BollingerBand {
  Lower = 'LOWER',
  Middle = 'MIDDLE',
  Upper = 'UPPER',
}

export interface DetectedRsiDivergence extends RsiDivergenceStrengths {
  originTrendLine: TrendLine;
}

export interface RsiDivergenceStrengths {
  regular?: number;
  hidden?: number;
}
