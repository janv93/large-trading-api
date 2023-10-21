import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { CandlestickChartModule } from './candlestick-chart/candlestick-chart.module';
import { ProfitChartModule } from './profit-chart/profit-chart.module';
import { IndicatorChartModule } from './indicator-chart/indicator-chart.module';
import { MultiChartComponent } from './multi-chart/multi-chart.component';

@NgModule({
  declarations: [
    AppComponent,
    MultiChartComponent
  ],
  imports: [
    BrowserModule,
    CandlestickChartModule,
    CommonModule,
    ProfitChartModule,
    IndicatorChartModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
