import { Indicator } from './indicator';
import { SMA } from './SMA';
export class EMA extends Indicator {
    constructor(input) {
        super(input);
        var period = input.period;
        var priceArray = input.values;
        var exponent = (input.smoothing / (period + 1));
        var sma;
        this.result = [];
        sma = new SMA({ period: period, values: [] });
        var genFn = (function* () {
            var tick = yield;
            var prevEma;
            while (true) {
                if (prevEma !== undefined && tick !== undefined) {
                    prevEma = ((tick - prevEma) * exponent) + prevEma;
                    tick = yield prevEma;
                }
                else {
                    tick = yield;
                    prevEma = sma.nextValue(tick);
                    if (prevEma)
                        tick = yield prevEma;
                }
            }
        });
        this.generator = genFn();
        this.generator.next();
        this.generator.next();
        priceArray.forEach((tick) => {
            var result = this.generator.next(tick);
            if (result.value != undefined) {
                this.result.push(result.value);
            }
        });
    }
    nextValue(price) {
        var result = this.generator.next(price).value;
        if (result != undefined)
            return result;
    }
    ;
}
EMA.calculate = ema;
export function ema(input) {
    Indicator.reverseInputs(input);
    var result = new EMA(input).result;
    if (input.reversedInput) {
        result.reverse();
    }
    Indicator.reverseInputs(input);
    return result;
}
