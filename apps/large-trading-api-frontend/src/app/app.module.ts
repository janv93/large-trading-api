import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { CandlestickChartModule } from './candlestick-chart/candlestick-chart.module';
import { ProfitChartModule } from './profit-chart/profit-chart.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    CandlestickChartModule,
    ProfitChartModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
