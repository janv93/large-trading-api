import { Bar } from './shared.interfaces';

export interface AlpacaResponse {
  nextPageToken: string;
  bars: Bar[];
}
