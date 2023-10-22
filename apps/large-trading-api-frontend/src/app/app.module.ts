import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { IndicatorChartModule } from './indicator-chart/indicator-chart.module';
import { MixedChartComponent } from './mixed-chart/mixed-chart.component';

@NgModule({
  declarations: [
    AppComponent,
    MixedChartComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    IndicatorChartModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
