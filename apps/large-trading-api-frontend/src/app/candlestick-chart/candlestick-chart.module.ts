import { NgModule } from '@angular/core';
import { CandlestickChartComponent } from './candlestick-chart.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    HttpClientModule
  ],
  exports: [
    CandlestickChartComponent
  ],
  declarations: [
    CandlestickChartComponent
  ],
  providers: []
})
export class CandlestickChartModule { }
