import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Bar, Signal, Timeframe } from '@shared';
import Btse from '../../../../exchanges/btse';
import Base from '../../../../../base';

export default class Ema extends Base {
  private indicators = new Indicators();
  private btse = new Btse();
  private tradingPositionOpen = new Map();

  /**
   * sets position signals depending on emas going up or down
   */
  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const periodOpen = Number(params.periodOpen);
    const periodClose = Number(params.periodClose);
    this.indicators.addEma(bars, periodOpen);
    this.indicators.addEma(bars, periodClose);
    const barsWithEma = bars.filter(k => k.indicators?.ema?.[periodOpen] !== undefined && k.indicators?.ema?.[periodClose] !== undefined);

    let lastMoveOpen: string;
    let lastMoveClose: string;
    let lastEmaOpen: number;
    let lastEmaClose: number;
    let positionOpen = false;

    barsWithEma.forEach((bar, i) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;
      const eOpen = bar.indicators!.ema![periodOpen];
      const eClose = bar.indicators!.ema![periodClose];

      // init

      if (i === 0) {
        lastEmaOpen = eOpen;
        lastEmaClose = eClose;
        return;
      }

      const moveOpen = eOpen - lastEmaOpen > 0 ? 'up' : 'down';
      const moveClose = eClose - lastEmaClose > 0 ? 'up' : 'down';

      if (i === 1) {
        lastMoveOpen = moveOpen;
        lastEmaOpen = eOpen;
        lastMoveClose = moveClose;
        lastEmaClose = eClose;
        return;
      }

      const momentumSwitchOpen = moveOpen !== lastMoveOpen;
      const momentumSwitchClose = moveClose !== lastMoveClose;

      // init end

      // set signals

      if (positionOpen && momentumSwitchClose && lastMoveOpen !== moveClose) {
        signals.push({
          signal: Signal.CloseAll,
          price: closePrice
        });

        positionOpen = false;
      }

      if (!positionOpen && momentumSwitchOpen) {
        if (moveOpen === 'up') {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Buy,
            size: 1,
            price: closePrice
          });

          positionOpen = true;
        } else if (moveOpen === 'down') {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Sell,
            size: 1,
            price: closePrice
          });

          positionOpen = true;
        }
      }

      // set signals end

      lastMoveOpen = moveOpen;
      lastEmaOpen = eOpen;
      lastMoveClose = moveClose;
      lastEmaClose = eClose;
    });

  }

  /**
   * run live trading algorithm
   */
  public trade(symbol: string, alreadyOpen?: boolean) {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const timeDiffToNextHour = 60 * 60000 - (minutes * 60000 + seconds * 1000);

    const leverage = 50;
    const timeframe = Timeframe._1Hour;
    const quantityUSD = 2500;
    this.tradingPositionOpen.set(symbol, alreadyOpen);

    console.log(symbol + ' live trading started')

    setTimeout(() => {  // wait for full hour
      this.tradeInterval(symbol, timeframe, quantityUSD, leverage);
      setInterval(() => { // run every hour
        this.tradeInterval(symbol, timeframe, quantityUSD, leverage);
      }, 60 * 60000);
    }, timeDiffToNextHour + 10000);
  }

  /**
   * run trading algorithm in selected interval
   */
  private async tradeInterval(symbol: string, timeframe: Timeframe, quantityUSD: number, leverage: number) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const binance = require('../../../../exchanges/binance').default;
    const bars = await binance.getBars(symbol, timeframe);
    const cryptoQuantity = Number((quantityUSD / bars[bars.length - 1].prices.close)/** .toFixed(2) for binance */);
    bars.splice(-1);  // remove running timeframe
    console.log(bars.slice(-3))
    const emaPeriod = 80;
    this.indicators.addEma(bars, emaPeriod);
    const barsWithEma = bars.filter(k => k.indicators?.ema?.[emaPeriod] !== undefined);
    console.log(barsWithEma.slice(-3))

    const move = barsWithEma[barsWithEma.length - 1].indicators!.ema![emaPeriod] - barsWithEma[barsWithEma.length - 2].indicators!.ema![emaPeriod] > 0 ? 'up' : 'down';
    const lastMove = barsWithEma[barsWithEma.length - 2].indicators!.ema![emaPeriod] - barsWithEma[barsWithEma.length - 3].indicators!.ema![emaPeriod] > 0 ? 'up' : 'down';
    console.log(lastMove);
    console.log(move);

    const momentumSwitch = move !== lastMove;

    if (!this.tradingPositionOpen.get(symbol)) {
      if (momentumSwitch) {
        if (move === 'up') {
          await this.openLong(symbol, cryptoQuantity, leverage);
        } else {
          await this.openShort(symbol, cryptoQuantity, leverage);
        }
      }
    } else {
      if (momentumSwitch) {
        if (move === 'up') {
          await this.closeShortOpenLong(symbol, cryptoQuantity, leverage);
        } else {
          await this.closeLongOpenShort(symbol, cryptoQuantity, leverage);
        }
      }
    }
  }

  private async openLong(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.long(symbol, cryptoQuantity, leverage);
      this.tradingPositionOpen.set(symbol, true);
    } catch (err) {
      this.handleError(err);
    }
  }

  private async openShort(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.short(symbol, cryptoQuantity, leverage);
      this.tradingPositionOpen.set(symbol, true);
    } catch (err) {
      this.handleError(err);
    }
  }

  private async closeShortOpenLong(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.closeOrder(symbol);
      await this.btse.long(symbol, cryptoQuantity, leverage);
    } catch (err) {
      this.handleError(err);
    }
  }

  private async closeLongOpenShort(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.closeOrder(symbol);
      await this.btse.short(symbol, cryptoQuantity, leverage);
    } catch (err) {
      this.handleError(err);
    }
  }

}