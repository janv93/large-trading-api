import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { CandlestickChartModule } from './candlestick-chart/candlestick-chart.module'

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    CandlestickChartModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
