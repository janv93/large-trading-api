/**
 * Created by AAravindan on 5/4/16.
 */
import { Indicator, IndicatorInput } from './indicator';
import { EMA } from './EMA';

export class MACDInput extends IndicatorInput {
    constructor(values) {
        super();
        this.values = values;
        this.SimpleMAOscillator = true;
        this.SimpleMASignal = true;
    }
}
export class MACDOutput {
}
export class MACD extends Indicator {
    constructor(input) {
        super(input);
        var fastMAProducer = new EMA({ period: input.fastPeriod, values: [], format: (v) => { return v; }, smoothing: input.smoothing });
        var slowMAProducer = new EMA({ period: input.slowPeriod, values: [], format: (v) => { return v; }, smoothing: input.smoothing });
        var signalMAProducer = new EMA({ period: input.signalPeriod, values: [], format: (v) => { return v; }, smoothing: input.smoothing });
        this.result = [];
        this.generator = (function* () {
            var index = 0;
            var tick;
            var MACD, signal, histogram, fast, slow;
            while (true) {
                if (index < input.slowPeriod) {
                    tick = yield;
                    fast = fastMAProducer.nextValue(tick);
                    slow = slowMAProducer.nextValue(tick);
                    index++;
                    continue;
                }
                if (fast && slow) { //Just for typescript to be happy
                    MACD = fast - slow;
                    signal = signalMAProducer.nextValue(MACD);
                }
                histogram = MACD - signal;
                tick = yield ({
                    //fast : fast,
                    //slow : slow,
                    MACD: MACD,
                    signal: signal ? signal : undefined,
                    histogram: isNaN(histogram) ? undefined : histogram
                });
                fast = fastMAProducer.nextValue(tick);
                slow = slowMAProducer.nextValue(tick);
            }
        })();
        this.generator.next();
        input.values.forEach((tick) => {
            var result = this.generator.next(tick);
            if (result.value != undefined) {
                this.result.push(result.value);
            }
        });
    }
    nextValue(price) {
        var result = this.generator.next(price).value;
        return result;
    }
    ;
}
MACD.calculate = macd;
export function macd(input) {
    Indicator.reverseInputs(input);
    var result = new MACD(input).result;
    if (input.reversedInput) {
        result.reverse();
    }
    Indicator.reverseInputs(input);
    return result;
}
;
