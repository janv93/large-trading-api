import { NgModule } from '@angular/core';
import { IndicatorChartComponent } from './indicator-chart.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    HttpClientModule
  ],
  exports: [
    IndicatorChartComponent
  ],
  declarations: [
    IndicatorChartComponent
  ],
  providers: []
})
export class IndicatorChartModule { }
