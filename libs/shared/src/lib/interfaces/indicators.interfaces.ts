import { TrendLine } from './shared.interfaces';

export enum BollingerBand {
  Lower = 'LOWER',
  Middle = 'MIDDLE',
  Upper = 'UPPER',
}

export interface RsiState {
  avgGain?: number;
  avgLoss?: number;
}

export interface AtrState {
  currentAtr?: number;
}

export interface MacdStepState {
  fastEma?: EmaState;
  slowEma?: EmaState;
  signalEma?: EmaState;
  closesBuffer?: number[];
  macdLineBuffer?: number[];
}

export interface EmaState {
  currentEma?: number;
}

export interface DetectedRsiDivergence extends RsiDivergenceStrengths {
  originTrendLine: TrendLine;
}

export interface RsiDivergenceStrengths {
  regular?: number;
  hidden?: number;
}
