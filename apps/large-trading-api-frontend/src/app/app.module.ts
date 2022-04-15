import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { CandlestickChartModule } from './candlestick-chart/candlestick-chart.module';
import { ProfitChartModule } from './profit-chart/profit-chart.module';
import { IndicatorChartModule } from './indicator-chart/indicator-chart.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    CandlestickChartModule,
    CommonModule,
    ProfitChartModule,
    IndicatorChartModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
