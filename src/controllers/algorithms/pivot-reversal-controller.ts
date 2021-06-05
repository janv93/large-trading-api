export default class PivotReversalController {
  constructor() {
  }

  public setSignals(klines: Array<any>, leftBars: number, rightBars: number): Array<any> {
    const klinesCloses = klines.map(kline => kline[4]);
    let pivot = '';

    klines.forEach((kline, index) => {
      if (pivot === '') {   // initial pivot search
        const isLowPivot = this.determinePivot(klinesCloses, index, leftBars, rightBars, 'low');
        const isHighPivot = this.determinePivot(klinesCloses, index, leftBars, rightBars, 'high');

        if (isLowPivot) {
          kline.push(pivot);
          pivot = 'high';
          return kline;
        } else if (isHighPivot) {
          kline.push(pivot)
          pivot = 'low';
          return kline;
        }
      } else if (pivot === 'low') {
        const isPivot = this.determinePivot(klinesCloses, index, leftBars, rightBars, 'low');

        if (isPivot) {
          kline.push(pivot);
          pivot = 'high';
          return kline;
        }
      } else if (pivot === 'high') {
        const isPivot = this.determinePivot(klinesCloses, index, leftBars, rightBars, 'high');

        if (isPivot) {
          kline.push(pivot)
          pivot = 'low';
          return kline;
        }
      }
    });

    return klines;
  }

  private determinePivot(klines: Array<any>, index: number, leftBars: number, rightBars: number, type: string) {
    if (index < leftBars || index + rightBars > klines.length - 1) {
      return null;
    } else {
      const indexClose = Number(klines[index]);
      const klinesInSpanBeforeIndex = klines.slice(index - leftBars, index);
      const klinesInSpanAfterIndex = klines.slice(index + 1, index + rightBars + 1);
      const klinesInSpan = klinesInSpanBeforeIndex.concat(klinesInSpanAfterIndex);

      return klinesInSpan.every(kline => {
        const klineClose = Number(kline);
        if (type === 'high') {
          return klineClose < indexClose;
        } else if (type === 'low') {
          return klineClose > indexClose;
        }
      });
    }
  }
}